/**
 * UNIFIED IMPORT PROCESSOR
 * Single endpoint that handles the entire import flow reliably.
 * 
 * Flow:
 * 1. Receive conversations from client
 * 2. Generate soulprint via OpenAI (reliable fallback)
 * 3. Generate AI name
 * 4. Save everything to DB
 * 5. Return success
 * 
 * No background jobs. No coordination. Just works.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { gzipSync } from 'zlib';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

// Lazy-load OpenAI client to avoid build-time errors
function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

interface ConversationChunk {
  id: string;
  title: string;
  content: string;
  messageCount: number;
  createdAt: string;
  isRecent: boolean;
}

interface ImportRequest {
  conversations: Array<{
    title: string;
    content?: string;
    messages?: string;
    message_count?: number;
  }>;
  chunks: ConversationChunk[];
  stats: {
    totalConversations: number;
    totalMessages: number;
  };
  rawJson?: string; // Original conversations.json for storage
}

export async function POST(request: Request) {
  console.log('[Import] Starting unified import...');
  
  try {
    // 1. Authenticate
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('[Import] Auth failed:', authError);
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    console.log(`[Import] User: ${user.id}`);

    // 2. Parse request
    const body: ImportRequest = await request.json();
    const { conversations, chunks, stats } = body;
    
    if (!conversations?.length && !chunks?.length) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 });
    }
    
    console.log(`[Import] Received ${conversations?.length || 0} conversations, ${chunks?.length || 0} chunks`);

    const adminSupabase = getSupabaseAdmin();

    // 3. Check if already imported
    const { data: existing } = await adminSupabase
      .from('user_profiles')
      .select('soulprint_locked')
      .eq('user_id', user.id)
      .single();
    
    if (existing?.soulprint_locked) {
      return NextResponse.json({ 
        error: 'Already imported',
        code: 'ALREADY_IMPORTED'
      }, { status: 409 });
    }

    // 4. Generate soulprint
    console.log('[Import] Generating soulprint...');
    const soulprintResult = await generateSoulprint(conversations, stats);
    console.log(`[Import] Soulprint generated - Archetype: ${soulprintResult.archetype}`);

    // 5. Generate AI name
    console.log('[Import] Generating AI name...');
    const aiName = await generateAIName(soulprintResult.soulprintText);
    console.log(`[Import] AI name: ${aiName}`);

    // 6. Save profile
    console.log('[Import] Saving profile...');
    const { error: profileError } = await adminSupabase
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        soulprint_text: soulprintResult.soulprintText,
        archetype: soulprintResult.archetype,
        ai_name: aiName,
        import_status: 'complete',
        total_conversations: stats.totalConversations,
        total_messages: stats.totalMessages,
        soulprint_generated_at: new Date().toISOString(),
        soulprint_locked: true,
        embedding_status: 'pending',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (profileError) {
      console.error('[Import] Profile save failed:', profileError);
      throw new Error(`Failed to save profile: ${profileError.message}`);
    }

    // 7. Delete old chunks and save new ones
    console.log('[Import] Saving chunks...');
    await adminSupabase
      .from('conversation_chunks')
      .delete()
      .eq('user_id', user.id);

    if (chunks?.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE).map(chunk => ({
          user_id: user.id,
          conversation_id: chunk.id,
          title: chunk.title || 'Untitled',
          content: chunk.content,
          message_count: chunk.messageCount || 0,
          created_at: chunk.createdAt || new Date().toISOString(),
          is_recent: chunk.isRecent ?? false,
        }));
        
        const { error: chunkError } = await adminSupabase
          .from('conversation_chunks')
          .insert(batch);
        
        if (chunkError) {
          console.warn('[Import] Chunk batch failed:', chunkError);
        }
      }
      console.log(`[Import] Saved ${chunks.length} chunks`);
    }

    // 8. Store raw JSON (compressed) if provided
    let rawExportPath: string | null = null;
    if (body.rawJson) {
      try {
        console.log(`[Import] Compressing raw JSON (${body.rawJson.length} chars)...`);
        const compressed = gzipSync(Buffer.from(body.rawJson, 'utf-8'));
        const compressionRatio = ((1 - compressed.length / body.rawJson.length) * 100).toFixed(1);
        console.log(`[Import] Compressed to ${compressed.length} bytes (${compressionRatio}% reduction)`);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        rawExportPath = `${user.id}/conversations-${timestamp}.json.gz`;

        const { error: uploadError } = await adminSupabase.storage
          .from('user-exports')
          .upload(rawExportPath, compressed, {
            contentType: 'application/gzip',
            upsert: false,
          });

        if (uploadError) {
          console.warn('[Import] Raw JSON upload failed:', uploadError);
          rawExportPath = null;
        } else {
          console.log(`[Import] Raw JSON stored at: ${rawExportPath}`);
          
          // Update profile with storage path
          await adminSupabase
            .from('user_profiles')
            .update({ raw_export_path: rawExportPath })
            .eq('user_id', user.id);
        }
      } catch (storageError) {
        console.warn('[Import] Raw JSON storage failed:', storageError);
      }
    }

    // 9. Success!
    console.log('[Import] Complete!');
    return NextResponse.json({
      success: true,
      aiName,
      archetype: soulprintResult.archetype,
      chunksStored: chunks?.length || 0,
      rawExportStored: !!rawExportPath,
    });

  } catch (error) {
    console.error('[Import] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Import failed'
    }, { status: 500 });
  }
}

async function generateSoulprint(
  conversations: ImportRequest['conversations'],
  stats: ImportRequest['stats']
): Promise<{ soulprintText: string; archetype: string }> {
  // Prepare conversation samples
  const samples = conversations
    .slice(0, 50)
    .map(c => {
      const content = c.content || c.messages || '';
      return `=== ${c.title || 'Conversation'} ===\n${content.slice(0, 800)}`;
    })
    .join('\n\n')
    .slice(0, 35000);

  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1500,
      messages: [
        {
          role: 'system',
          content: `You are analyzing a user's ChatGPT conversation history to create their personality profile (SoulPrint).

Based on the conversations provided, write a personality profile (3-4 paragraphs) that describes:
1. Their communication style - casual/formal, concise/verbose, emoji usage, signature phrases
2. How they approach problems and think through challenges
3. Their main interests and topics they engage with
4. Unique traits, patterns, or quirks that make them distinctive

Write in second person ("You..."). Be specific and insightful based on actual patterns you observe. Avoid generic statements.

After the profile, on a new line write exactly:
**Archetype: [2-4 word label]**

Example archetypes: "The Systematic Builder", "The Creative Problem-Solver", "The Curious Explorer"`
        },
        {
          role: 'user',
          content: `Analyze these ${stats.totalConversations} conversations (${stats.totalMessages} messages) and create the user's SoulPrint:\n\n${samples}`
        }
      ],
    });

    const fullText = response.choices[0]?.message?.content || '';
    
    // Extract archetype
    const archetypeMatch = fullText.match(/\*\*Archetype:\s*(.+?)\*\*/i);
    const archetype = archetypeMatch?.[1]?.trim() || 'The Unique Individual';
    
    return { soulprintText: fullText, archetype };
  } catch (error) {
    console.error('[Import] OpenAI soulprint generation failed:', error);
    
    // Fallback to basic soulprint
    return {
      soulprintText: `Based on ${stats.totalConversations} conversations and ${stats.totalMessages} messages, you engage thoughtfully with a wide range of topics. Your communication style reflects curiosity and a desire for practical solutions.`,
      archetype: 'The Unique Individual',
    };
  }
}

async function generateAIName(soulprintText: string): Promise<string> {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 50,
      messages: [
        {
          role: 'system',
          content: `Generate a unique, memorable AI assistant name based on the user's personality profile. The name should be:
- Short (1-2 words, max 15 characters)
- Friendly and approachable
- Reflect their communication style or archetype
- NOT generic names like "Assistant", "Helper", "AI", "Bot"
- Can be playful, mythological, nature-inspired, or abstract

Reply with ONLY the name, nothing else.`
        },
        {
          role: 'user',
          content: `Based on this personality profile, generate a perfect AI name:\n\n${soulprintText.slice(0, 1000)}`
        }
      ],
    });

    const name = response.choices[0]?.message?.content?.trim().replace(/['"]/g, '') || 'Echo';
    return name.slice(0, 20);
  } catch (error) {
    console.error('[Import] AI name generation failed:', error);
    return 'Echo';
  }
}
