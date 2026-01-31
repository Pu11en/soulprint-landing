/**
 * Background embedding - processes chunks with embeddings
 * This runs synchronously within its 300s limit
 * 
 * Called by process-server or can be triggered manually/via cron
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

// Lazy initialization to avoid build-time errors
let _bedrockClient: BedrockRuntimeClient | null = null;
function getBedrockClient(): BedrockRuntimeClient {
  if (!_bedrockClient) {
    _bedrockClient = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _bedrockClient;
}

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

  const response = await getBedrockClient().send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.embeddings.float;
}

export async function POST(request: Request) {
  const adminSupabase = getSupabaseAdmin();
  let userId: string | null = null;
  
  try {
    // Support both normal auth and internal server-to-server calls
    const internalUserId = request.headers.get('X-Internal-User-Id');
    if (internalUserId) {
      userId = internalUserId;
    } else {
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      userId = user.id;
    }

    console.log(`[EmbedBackground] Starting for user ${userId}`);
    
    const BATCH_SIZE = 50;
    let processed = 0;
    let hasMore = true;
    const startTime = Date.now();
    const MAX_RUNTIME_MS = 280000; // 280s safety margin

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
      // Check if we're running out of time
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log(`[EmbedBackground] Time limit approaching, pausing at ${processed}/${totalCount}`);
        // Mark as incomplete so it can resume
        await adminSupabase
          .from('user_profiles')
          .update({ 
            embedding_status: 'pending',
            embedding_progress: totalCount ? Math.round((processed / totalCount) * 100) : 0,
            processed_chunks: processed,
          })
          .eq('user_id', userId);
        
        return NextResponse.json({ 
          success: true,
          complete: false,
          processed,
          total: totalCount,
          message: 'Paused - will resume on next trigger',
        });
      }
      
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

        // Update chunks with embeddings in parallel
        await Promise.all(chunks.map((chunk, i) => 
          adminSupabase
            .from('conversation_chunks')
            .update({ embedding: embeddings[i] })
            .eq('id', chunk.id)
        ));

        processed += chunks.length;
        const progress = totalCount ? Math.round((processed / totalCount) * 100) : 0;

        // Update progress periodically (every 100 chunks)
        if (processed % 100 === 0 || !hasMore) {
          await adminSupabase
            .from('user_profiles')
            .update({ 
              embedding_progress: progress,
              processed_chunks: processed,
            })
            .eq('user_id', userId);
        }

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

    console.log(`[EmbedBackground] Complete for user ${userId}: ${processed} chunks embedded`);

    return NextResponse.json({ 
      success: true,
      complete: true,
      processed,
      total: totalCount,
    });

  } catch (error) {
    console.error('[EmbedBackground] Error:', error);
    
    // Try to update status
    if (userId) {
      await adminSupabase
        .from('user_profiles')
        .update({ 
          embedding_status: 'failed',
        })
        .eq('user_id', userId);
    }
    
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
