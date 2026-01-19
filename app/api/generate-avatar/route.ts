import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const KIE_API_KEY = process.env.KIE_API_KEY || '6efc289cb78bed900085851c51be6b9a';
const KIE_API_URL = 'https://api.kie.ai/api/v1/jobs/createTask';
const KIE_TASK_URL = 'https://api.kie.ai/api/v1/jobs/recordInfo';

// Generate image prompt from soulprint data using OpenAI
async function generateImagePrompt(soulprintData: Record<string, unknown>): Promise<string> {
    const openai = new OpenAI();

    const archetype = soulprintData.archetype || 'Unknown';
    const identitySignature = soulprintData.identity_signature || '';
    const pillars = soulprintData.pillars as Record<string, { summary?: string }> || {};
    const voiceVectors = soulprintData.voice_vectors as Record<string, string> || {};
    const flinchWarnings = soulprintData.flinch_warnings as string[] || [];

    // Extract key personality traits
    const communicationStyle = pillars.communication_style?.summary || '';
    const emotionalAlignment = pillars.emotional_alignment?.summary || '';
    const decisionMaking = pillars.decision_making?.summary || '';
    const cognitiveProcessing = pillars.cognitive_processing?.summary || '';

    const systemPrompt = `You are a creative art director specializing in abstract digital art and profile avatars. Your task is to create detailed image generation prompts.`;

    const userPrompt = `Based on this personality profile, create a detailed image generation prompt for an abstract, artistic profile avatar that captures their essence WITHOUT depicting a human face or figure.

=== PERSONALITY DATA ===
Archetype: ${archetype}
Identity Signature: ${identitySignature}

Communication Style: ${communicationStyle}
Emotional Alignment: ${emotionalAlignment}
Decision Making: ${decisionMaking}
Cognitive Processing: ${cognitiveProcessing}

Voice Characteristics:
- Cadence: ${voiceVectors.cadence_speed || 'moderate'}
- Tone Warmth: ${voiceVectors.tone_warmth || 'neutral'}
- Sentence Structure: ${voiceVectors.sentence_structure || 'balanced'}

Flinch Points (sensitivities): ${flinchWarnings.join(', ') || 'None specified'}

=== YOUR TASK ===
Create an image prompt that generates a UNIQUE abstract avatar reflecting this personality:

1. **Color Palette**: Choose 2-4 colors that match their energy
   - Warm tones for empathetic/warm personalities
   - Cool tones for analytical/reserved types
   - Vibrant for expressive, muted for introspective

2. **Patterns & Shapes**:
   - Geometric/sharp for analytical minds
   - Organic/flowing for creative souls
   - Layered/complex for deep thinkers
   - Clean/minimal for direct communicators

3. **Mood & Atmosphere**:
   - Ethereal/dreamy for intuitive types
   - Bold/striking for assertive personalities
   - Soft/calming for nurturing types
   - Dynamic/energetic for action-oriented

4. **Style**: Abstract digital art, suitable as a profile picture, square format, no text, no human faces or figures

OUTPUT ONLY THE IMAGE PROMPT - no explanations, no markdown, just the prompt text ready to send to an image generator. Keep it under 200 words.`;

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 300,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
    });

    return response.choices[0]?.message?.content || 'Abstract digital art, ethereal colors, geometric patterns, profile avatar style';
}

// Create image task with kie.ai
async function createImageTask(prompt: string, model: 'ideogram' | 'flux2' = 'ideogram'): Promise<string> {
    const modelPath = model === 'ideogram' 
        ? 'ideogram/v3-text-to-image'
        : 'flux-2/pro-text-to-image';

    const body = model === 'ideogram' 
        ? {
            model: modelPath,
            input: {
                prompt: prompt,
                rendering_speed: 'BALANCED',
                style: 'AUTO',
                expand_prompt: false,
                image_size: 'square_hd',
                num_images: '1',
                negative_prompt: 'human face, person, portrait, text, words, letters, blurry, low quality'
            }
        }
        : {
            model: modelPath,
            input: {
                prompt: prompt,
                aspect_ratio: '1:1',
                resolution: '1K'
            }
        };

    const response = await fetch(KIE_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${KIE_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    const result = await response.json();
    
    if (result.code !== 200) {
        throw new Error(result.msg || 'Failed to create image task');
    }

    return result.data.taskId;
}

// Poll for task completion
async function waitForTask(taskId: string, maxAttempts = 60): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

        const response = await fetch(`${KIE_TASK_URL}?taskId=${taskId}`, {
            headers: {
                'Authorization': `Bearer ${KIE_API_KEY}`,
            },
        });

        const result = await response.json();
        
        if (result.code === 200 && result.data) {
            const status = result.data.status;
            
            if (status === 'completed' || status === 'success') {
                // Extract image URL from result
                const output = result.data.output;
                if (output?.images?.[0]?.url) {
                    return output.images[0].url;
                }
                if (output?.image_url) {
                    return output.image_url;
                }
                if (typeof output === 'string') {
                    return output;
                }
                // Try to find URL in nested structure
                const outputStr = JSON.stringify(output);
                const urlMatch = outputStr.match(/https?:\/\/[^"'\s]+\.(png|jpg|jpeg|webp)/i);
                if (urlMatch) {
                    return urlMatch[0];
                }
                throw new Error('Could not find image URL in response');
            }
            
            if (status === 'failed' || status === 'error') {
                throw new Error(result.data.error || 'Image generation failed');
            }
        }
    }
    
    throw new Error('Image generation timed out');
}

// POST: Generate prompt from soulprint
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { action, soulprintId, customPrompt, model } = body;

        if (action === 'generate-prompt') {
            // Get soulprint data
            const { data: soulprint, error } = await supabase
                .from('soulprints')
                .select('soulprint_data')
                .eq('id', soulprintId)
                .eq('user_id', user.id)
                .single();

            if (error || !soulprint) {
                return NextResponse.json({ error: 'Soulprint not found' }, { status: 404 });
            }

            // Generate prompt using LLM
            const imagePrompt = await generateImagePrompt(soulprint.soulprint_data);
            
            return NextResponse.json({ 
                success: true, 
                prompt: imagePrompt 
            });
        }

        if (action === 'generate-image') {
            // Use custom prompt or require one
            if (!customPrompt) {
                return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
            }

            // Create image task
            const taskId = await createImageTask(customPrompt, model || 'ideogram');
            
            // Wait for completion
            const imageUrl = await waitForTask(taskId);

            return NextResponse.json({ 
                success: true, 
                imageUrl,
                taskId 
            });
        }

        if (action === 'save-avatar') {
            const { imageUrl } = body;
            
            if (!imageUrl) {
                return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
            }

            // Download image and upload to Supabase storage
            const imageResponse = await fetch(imageUrl);
            const imageBlob = await imageResponse.blob();
            const arrayBuffer = await imageBlob.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            const fileName = `avatars/${user.id}/${Date.now()}.png`;
            
            const { error: uploadError } = await supabase.storage
                .from('soulprint-assets')
                .upload(fileName, buffer, {
                    contentType: 'image/png',
                    upsert: true,
                });

            if (uploadError) {
                console.error('Upload error:', uploadError);
                // If bucket doesn't exist, just use the external URL
                await supabase
                    .from('profiles')
                    .update({ avatar_url: imageUrl })
                    .eq('id', user.id);
                    
                return NextResponse.json({ 
                    success: true, 
                    savedUrl: imageUrl,
                    note: 'Saved external URL (storage bucket not configured)'
                });
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('soulprint-assets')
                .getPublicUrl(fileName);

            // Update profile
            await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id);

            return NextResponse.json({ 
                success: true, 
                savedUrl: publicUrl 
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Avatar generation error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to process request' },
            { status: 500 }
        );
    }
}
