/**
 * Save client-generated soulprint to database
 * No file upload needed - just receives the analyzed results
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

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
    // Set import_status to 'processing' - will be marked 'locked' only after ALL embeddings are complete
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
        // Queue for background embedding - will be processed fully before marking complete
        embedding_status: 'pending',
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

    // Save conversation chunks for RLM
    if (conversationChunks && conversationChunks.length > 0) {
      console.log(`[SaveSoulprint] Saving ${conversationChunks.length} conversation chunks...`);
      
      // Delete existing chunks for this user first
      await adminSupabase
        .from('conversation_chunks')
        .delete()
        .eq('user_id', user.id);
      
      // Insert new chunks in batches
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
          title: chunk.title,
          content: chunk.content,
          message_count: chunk.messageCount,
          created_at: chunk.createdAt,
          is_recent: chunk.isRecent,
        }));
        
        const { error: chunkError } = await adminSupabase
          .from('conversation_chunks')
          .insert(batch);
        
        if (chunkError) {
          console.error('[SaveSoulprint] Chunk insert error:', chunkError);
          // Don't fail the whole request, just log
        }
      }
      
      console.log(`[SaveSoulprint] Chunks saved!`);
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
