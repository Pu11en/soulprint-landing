/**
 * Save conversation chunks in batches
 * Called after save-soulprint to handle large imports
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

interface ChunkInput {
  id: string;
  title: string;
  content: string;
  messageCount: number;
  createdAt: string;
  isRecent: boolean;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const adminSupabase = getSupabaseAdmin();
    const body = await request.json();
    const { chunks, batchIndex, totalBatches } = body;

    if (!chunks || !Array.isArray(chunks)) {
      return NextResponse.json({ error: 'Chunks array required' }, { status: 400 });
    }

    console.log(`[SaveChunks] User ${user.id} - batch ${batchIndex + 1}/${totalBatches} (${chunks.length} chunks)`);

    // Insert chunks
    const batch = chunks.map((chunk: ChunkInput) => ({
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
      console.error('[SaveChunks] Insert error:', chunkError);
      return NextResponse.json({ error: chunkError.message }, { status: 500 });
    }

    // Update progress
    const progress = Math.round(((batchIndex + 1) / totalBatches) * 100);
    
    // If this is the last batch, mark as ready for embedding
    if (batchIndex + 1 >= totalBatches) {
      await adminSupabase
        .from('user_profiles')
        .update({ 
          embedding_status: 'pending',
          total_chunks: chunks.length * totalBatches, // Approximate
        })
        .eq('user_id', user.id);
    }

    return NextResponse.json({ 
      success: true,
      batchIndex,
      totalBatches,
      progress,
      chunksInserted: chunks.length,
    });

  } catch (error) {
    console.error('[SaveChunks] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
