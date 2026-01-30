/**
 * Background processing - receives chunks and raw conversations
 * Stores them and kicks off embedding
 * 
 * Note: For very large imports, this may hit Vercel's 4.5MB body limit.
 * In that case, the client should batch-upload via save-chunks instead.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Return immediately - the actual work happens in the background
    const responsePromise = NextResponse.json({ 
      started: true,
      message: 'Background processing started',
    });

    // Process in background (fire and forget)
    processInBackground(user.id, request).catch(err => {
      console.error('[ProcessBackground] Error:', err);
    });

    return responsePromise;

  } catch (error) {
    console.error('[ProcessBackground] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

async function processInBackground(userId: string, request: Request) {
  const adminSupabase = getSupabaseAdmin();
  
  let body;
  try {
    body = await request.json();
  } catch {
    console.log('[ProcessBackground] No body or failed to parse - checking for existing data');
    return;
  }

  const { chunks = [], rawConversations = [] } = body;
  
  console.log(`[ProcessBackground] Starting for user ${userId}`);
  console.log(`[ProcessBackground] Chunks: ${chunks.length}, Raw: ${rawConversations.length}`);

  // Update status
  await adminSupabase
    .from('user_profiles')
    .update({ 
      embedding_status: 'processing',
      embedding_progress: 0,
      total_chunks: chunks.length,
    })
    .eq('user_id', userId);

  // Save chunks in batches
  const CHUNK_BATCH = 100;
  for (let i = 0; i < chunks.length; i += CHUNK_BATCH) {
    const batch = chunks.slice(i, i + CHUNK_BATCH).map((chunk: any) => ({
      user_id: userId,
      title: chunk.title,
      content: chunk.content,
      conversation_id: chunk.conversationId,
      message_index: chunk.messageIndex,
      is_recent: chunk.isRecent || false,
      created_at: chunk.createdAt || new Date().toISOString(),
    }));

    const { error } = await adminSupabase
      .from('conversation_chunks')
      .insert(batch);

    if (error) {
      console.error('[ProcessBackground] Chunk insert error:', error);
    }

    // Update progress
    const progress = Math.round((i / chunks.length) * 50); // 0-50% for chunks
    await adminSupabase
      .from('user_profiles')
      .update({ embedding_progress: progress })
      .eq('user_id', userId);
  }

  // Save raw conversations in batches
  const RAW_BATCH = 50;
  for (let i = 0; i < rawConversations.length; i += RAW_BATCH) {
    const batch = rawConversations.slice(i, i + RAW_BATCH).map((conv: any) => ({
      user_id: userId,
      conversation_id: conv.id || conv.title,
      title: conv.title,
      messages: conv.messages,
      created_at: conv.createdAt || new Date().toISOString(),
    }));

    const { error } = await adminSupabase
      .from('raw_conversations')
      .insert(batch);

    if (error) {
      console.error('[ProcessBackground] Raw insert error:', error);
    }
  }

  console.log('[ProcessBackground] Chunks and raw saved, starting embeddings...');

  // Now embed everything
  await embedAllChunks(userId, adminSupabase);
}

async function embedAllChunks(userId: string, adminSupabase: any) {
  const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
  
  const bedrockClient = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  const BATCH_SIZE = 50;
  let hasMore = true;
  let processed = 0;

  // Get total count
  const { count: totalCount } = await adminSupabase
    .from('conversation_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  while (hasMore) {
    const { data: chunks, error } = await adminSupabase
      .from('conversation_chunks')
      .select('id, content')
      .eq('user_id', userId)
      .is('embedding', null)
      .limit(BATCH_SIZE);

    if (error || !chunks || chunks.length === 0) {
      hasMore = false;
      break;
    }

    try {
      const texts = chunks.map((c: any) => c.content.slice(0, 128000));
      
      const command = new InvokeModelCommand({
        modelId: 'cohere.embed-v4',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          texts,
          input_type: 'search_document',
          embedding_types: ['float'],
          truncate: 'END',
        }),
      });

      const response = await bedrockClient.send(command);
      const result = JSON.parse(new TextDecoder().decode(response.body));
      const embeddings = result.embeddings.float;

      for (let i = 0; i < chunks.length; i++) {
        await adminSupabase
          .from('conversation_chunks')
          .update({ embedding: embeddings[i] })
          .eq('id', chunks[i].id);
      }

      processed += chunks.length;
      const progress = 50 + Math.round((processed / (totalCount || 1)) * 50); // 50-100% for embeddings
      
      await adminSupabase
        .from('user_profiles')
        .update({ 
          embedding_progress: progress,
          processed_chunks: processed,
        })
        .eq('user_id', userId);

      console.log(`[ProcessBackground] Embedded ${processed}/${totalCount}`);

    } catch (embedError) {
      console.error('[ProcessBackground] Embed error:', embedError);
    }
  }

  // Mark complete
  await adminSupabase
    .from('user_profiles')
    .update({ 
      embedding_status: 'complete',
      embedding_progress: 100,
    })
    .eq('user_id', userId);

  console.log(`[ProcessBackground] Complete for user ${userId}`);
}
