/**
 * Save client-generated soulprint to database
 * No file upload needed - just receives the analyzed results
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Increase body size limit for large chat exports (Vercel Pro: up to 50MB)
export const maxDuration = 60; // 60 second timeout
export const dynamic = 'force-dynamic';

// Route segment config for body size
export const fetchCache = 'force-no-store';

// For App Router, we need to configure this in next.config.ts or use streaming
// But we can at least handle the error gracefully

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: Request) {
  try {
    // Get current user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const adminSupabase = getSupabaseAdmin();

    // Check if user already has an imported soulprint (can't re-import)
    // NOTE: soulprint_locked means "initial import done" not "no more learning"
    // The soulprint continues to evolve from conversations
    const { data: existingProfile } = await adminSupabase
      .from('user_profiles')
      .select('soulprint_locked, import_status')
      .eq('user_id', user.id)
      .single();

    if (existingProfile?.soulprint_locked) {
      return NextResponse.json({ 
        error: 'You have already imported your ChatGPT history. Your SoulPrint will continue to learn from new conversations.',
        code: 'ALREADY_IMPORTED'
      }, { status: 409 });
    }

    // Also check if import is already complete (additional safeguard)
    if (existingProfile?.import_status === 'complete' || existingProfile?.import_status === 'locked') {
      return NextResponse.json({ 
        error: 'You have already imported your ChatGPT history. Your SoulPrint will continue to learn from new conversations.',
        code: 'ALREADY_IMPORTED'
      }, { status: 409 });
    }

    const body = await request.json();
    const { soulprint, conversationChunks } = body;

    if (!soulprint) {
      return NextResponse.json({ error: 'Soulprint data required' }, { status: 400 });
    }

    console.log(`[SaveSoulprint] Saving for user ${user.id}`);
    console.log(`[SaveSoulprint] Stats:`, soulprint.stats);
    console.log(`[SaveSoulprint] Chunks:`, conversationChunks?.length || 0);

    // Generate soulprint text for chat context
    const soulprintText = generateSoulprintText(soulprint);

    // Upsert user profile with soulprint
    // Set embedding_status to 'importing' while we write chunks (prevents race with cron)
    const { error: profileError } = await adminSupabase
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        soulprint: soulprint,
        soulprint_text: soulprintText,
        import_status: 'processing', // Not 'complete' until all embeddings done
        total_conversations: soulprint.stats.totalConversations,
        total_messages: soulprint.stats.totalMessages,
        soulprint_generated_at: new Date().toISOString(),
        // 'importing' prevents embedding cron from running while we write chunks
        embedding_status: 'importing',
        embedding_progress: 0,
        total_chunks: conversationChunks?.length || 0,
        processed_chunks: 0,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (profileError) {
      console.error('[SaveSoulprint] Profile upsert error:', profileError);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    // Delete existing chunks for this user (fresh import)
    await adminSupabase
      .from('conversation_chunks')
      .delete()
      .eq('user_id', user.id);

    // Handle legacy path: if chunks are provided in this request, save them
    // New path: chunks sent via /api/import/save-chunks in batches
    if (conversationChunks && conversationChunks.length > 0) {
      console.log(`[SaveSoulprint] Legacy path: Saving ${conversationChunks.length} conversation chunks...`);
      
      const BATCH_SIZE = 50;
      for (let i = 0; i < conversationChunks.length; i += BATCH_SIZE) {
        interface ChunkInput {
          id: string;
          title: string;
          content: string;
          messageCount: number;
          createdAt: string;
          isRecent: boolean;
        }
        const batch = conversationChunks.slice(i, i + BATCH_SIZE).map((chunk: ChunkInput) => ({
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
          console.error('[SaveSoulprint] Chunk insert error:', chunkError);
        }
      }
      
      // Legacy path: mark as pending since all chunks are here
      await adminSupabase
        .from('user_profiles')
        .update({ embedding_status: 'pending' })
        .eq('user_id', user.id);
      
      console.log(`[SaveSoulprint] Chunks saved!`);
    } else {
      // New chunked upload path: chunks will be sent via /api/import/save-chunks
      // Keep status as 'importing' - save-chunks will set to 'pending' when done
      console.log(`[SaveSoulprint] Awaiting chunked upload via /api/import/save-chunks`);
    }

    console.log(`[SaveSoulprint] Success!`);

    return NextResponse.json({ 
      success: true,
      message: 'SoulPrint saved successfully',
      chunksStored: conversationChunks?.length || 0,
    });

  } catch (error) {
    console.error('[SaveSoulprint] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

interface Soulprint {
  aiPersona: { soulMd: string };
  stats: { totalConversations: number; totalMessages: number };
  interests: string[];
  facts: string[];
  relationships?: Array<{ name: string; context: string }>;
}

function generateSoulprintText(soulprint: Soulprint): string {
  const lines: string[] = [
    soulprint.aiPersona.soulMd,
    '',
    '---',
    '',
    '## User Context',
    '',
    `**Conversations analyzed:** ${soulprint.stats.totalConversations.toLocaleString()} (${soulprint.stats.totalMessages.toLocaleString()} messages)`,
    '',
    '### Interests',
    soulprint.interests.map((i) => `- ${i}`).join('\n') || '- Unknown',
    '',
    '### Key Facts',
    soulprint.facts.slice(0, 10).map((f) => `- ${f}`).join('\n') || '- None extracted',
  ];
  
  if (soulprint.relationships?.length) {
    lines.push('', '### People Mentioned');
    for (const rel of soulprint.relationships.slice(0, 5)) {
      lines.push(`- ${rel.name} (${rel.context})`);
    }
  }
  
  return lines.join('\n');
}
