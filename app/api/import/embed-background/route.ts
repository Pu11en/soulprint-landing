/**
 * Background embedding - processes ALL chunks without blocking
 * Returns immediately, processes in background via waitUntil-like pattern
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min max for Vercel

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const command = new InvokeModelCommand({
    modelId: 'cohere.embed-v4',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      texts: texts.map(t => t.slice(0, 128000)),
      input_type: 'search_document',
      embedding_types: ['float'],
      truncate: 'END',
    }),
  });

  const response = await bedrockClient.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.embeddings.float;
}

async function processAllEmbeddings(userId: string) {
  const adminSupabase = getSupabaseAdmin();
  const BATCH_SIZE = 50;
  let processed = 0;
  let hasMore = true;

  console.log(`[EmbedBackground] Starting for user ${userId}`);

  // Set status to processing
  await adminSupabase
    .from('user_profiles')
    .update({ embedding_status: 'processing', embedding_progress: 0 })
    .eq('user_id', userId);

  // Get total count
  const { count: totalCount } = await adminSupabase
    .from('conversation_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  while (hasMore) {
    // Get next batch of unembedded chunks
    const { data: chunks, error } = await adminSupabase
      .from('conversation_chunks')
      .select('id, content')
      .eq('user_id', userId)
      .is('embedding', null)
      .order('created_at', { ascending: false })
      .limit(BATCH_SIZE);

    if (error) {
      console.error('[EmbedBackground] Fetch error:', error);
      break;
    }

    if (!chunks || chunks.length === 0) {
      hasMore = false;
      break;
    }

    try {
      // Generate embeddings
      const texts = chunks.map(c => c.content);
      const embeddings = await embedBatch(texts);

      // Update chunks with embeddings
      for (let i = 0; i < chunks.length; i++) {
        await adminSupabase
          .from('conversation_chunks')
          .update({ embedding: embeddings[i] })
          .eq('id', chunks[i].id);
      }

      processed += chunks.length;
      const progress = totalCount ? Math.round((processed / totalCount) * 100) : 0;

      // Update progress
      await adminSupabase
        .from('user_profiles')
        .update({ 
          embedding_progress: progress,
          processed_chunks: processed,
        })
        .eq('user_id', userId);

      console.log(`[EmbedBackground] Processed ${processed}/${totalCount} (${progress}%)`);

    } catch (embedError) {
      console.error('[EmbedBackground] Batch error:', embedError);
      // Continue with next batch
    }
  }

  // Mark complete
  await adminSupabase
    .from('user_profiles')
    .update({ 
      embedding_status: 'complete',
      embedding_progress: 100,
      processed_chunks: totalCount || processed,
    })
    .eq('user_id', userId);

  console.log(`[EmbedBackground] Complete for user ${userId}`);
}

export async function POST(request: Request) {
  try {
    // Support both normal auth and internal server-to-server calls
    let userId: string;
    
    const internalUserId = request.headers.get('X-Internal-User-Id');
    if (internalUserId) {
      // Internal call from process-server
      userId = internalUserId;
    } else {
      // Normal authenticated request
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      userId = user.id;
    }

    // Fire and forget - process in background
    // Note: On Vercel, this will run until maxDuration or completion
    // The response returns immediately
    processAllEmbeddings(userId).catch(err => {
      console.error('[EmbedBackground] Background process error:', err);
    });

    return NextResponse.json({ 
      started: true,
      message: 'Embedding started in background',
    });

  } catch (error) {
    console.error('[EmbedBackground] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
