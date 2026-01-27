/**
 * Generate/Get AI avatar using Gemini image generation
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function getR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

// GET - retrieve AI avatar URL
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = getSupabaseAdmin();
    const { data: profile } = await adminSupabase
      .from('user_profiles')
      .select('ai_avatar_url, ai_name')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({ 
      avatarUrl: profile?.ai_avatar_url || null,
      aiName: profile?.ai_name || null,
      hasAvatar: !!profile?.ai_avatar_url,
    });
  } catch (error) {
    console.error('Error getting AI avatar:', error);
    return NextResponse.json({ error: 'Failed to get AI avatar' }, { status: 500 });
  }
}

// POST - generate new AI avatar
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const customPrompt = body.prompt as string | undefined;

    // Get the AI name for personalized avatar
    const adminSupabase = getSupabaseAdmin();
    const { data: profile } = await adminSupabase
      .from('user_profiles')
      .select('ai_name')
      .eq('user_id', user.id)
      .single();

    const aiName = profile?.ai_name || 'AI Assistant';

    // Build the image prompt
    const defaultPrompt = `A sleek, modern AI avatar profile picture for an AI named "${aiName}". 
Abstract, futuristic, friendly. Soft gradients with orange and dark tones. 
Clean, minimal, professional. No text. Centered composition. Square format.`;
    
    const imagePrompt = customPrompt || defaultPrompt;

    // Call Gemini API to generate image
    const geminiKey = process.env.GEMINI_API_KEY || process.env.KIE_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: 'Image generation not configured' }, { status: 500 });
    }

    console.log('Generating avatar for:', aiName);

    // Use Gemini's imagen API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: imagePrompt }]
          }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          }
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('Gemini API error:', errText);
      return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
    }

    const geminiData = await geminiResponse.json();
    console.log('Gemini response:', JSON.stringify(geminiData).slice(0, 500));

    // Extract image from response
    let imageBase64: string | null = null;
    let mimeType = 'image/png';

    for (const candidate of geminiData.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if (part.inlineData?.data) {
          imageBase64 = part.inlineData.data;
          mimeType = part.inlineData.mimeType || 'image/png';
          break;
        }
      }
      if (imageBase64) break;
    }

    if (!imageBase64) {
      console.error('No image in Gemini response');
      return NextResponse.json({ error: 'No image generated' }, { status: 500 });
    }

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
    const fileName = `avatars/${user.id}/${Date.now()}.${ext}`;

    // Upload to R2
    const r2 = getR2Client();
    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: imageBuffer,
      ContentType: mimeType,
    }));

    // Construct public URL (assuming R2 public bucket or custom domain)
    // For now, we'll store the key and construct URL later, or use a signed URL approach
    const avatarUrl = `https://pub-soulprint.r2.dev/${fileName}`;

    // Save to user profile
    const { error: updateError } = await adminSupabase
      .from('user_profiles')
      .update({ 
        ai_avatar_url: avatarUrl, 
        updated_at: new Date().toISOString() 
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error saving avatar URL:', updateError);
      return NextResponse.json({ error: 'Failed to save avatar' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      avatarUrl,
      aiName,
    });
  } catch (error) {
    console.error('Error generating AI avatar:', error);
    return NextResponse.json({ error: 'Failed to generate avatar' }, { status: 500 });
  }
}
