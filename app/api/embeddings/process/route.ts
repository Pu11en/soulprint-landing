/**
 * Background Embedding Processor
 * Runs parallel embedding jobs for users with pending chunks
 * Can be triggered by Vercel Cron or manual API call
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });

// Configuration
const PARALLEL_WORKERS = 5;  // Number of parallel embedding requests
const BATCH_SIZE = 50;       // Chunks to process per API call
const RATE_LIMIT_MS = 50;    // Delay between batches to respect rate limits

interface ConversationChunk {
  id: string;
  user_id: string;
  conversation_id: string;
  title: string;
  content: string;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const command = new InvokeModelCommand({
    modelId: 'amazon.titan-embed-text-v2:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      inputText: text.slice(0, 8000), // Titan limit
    }),
  });

  const response = await bedrock.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.embedding;
}

async function processChunk(chunk: ConversationChunk): Promise<boolean> {
  try {
    // Check if already embedded
    const { data: existing } = await supabase
      .from('memory_chunks')
      .select('id')
      .eq('conversation_id', chunk.conversation_id)
      .eq('user_id', chunk.user_id)
      .limit(1);

    if (existing && existing.length > 0) {
      return true; // Already embedded
    }

    // Generate embedding
    const embedding = await generateEmbedding(chunk.content);

    // Store in memory_chunks
    const { error } = await supabase.from('memory_chunks').insert({
      user_id: chunk.user_id,
      conversation_id: chunk.conversation_id,
      content: chunk.content,
      embedding,
      metadata: {
        title: chunk.title,
        source: 'conversation_chunk',
        embedded_at: new Date().toISOString(),
      },
    });

    if (error) {
      console.error(`[Embed] Error storing chunk ${chunk.conversation_id}:`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[Embed] Error processing chunk ${chunk.conversation_id}:`, error);
    return false;
  }
}

async function processUserChunks(userId: string, limit: number): Promise<{ processed: number; failed: number }> {
  // Get unembedded chunks for this user
  const { data: allChunks } = await supabase
    .from('conversation_chunks')
    .select('id, user_id, conversation_id, title, content')
    .eq('user_id', userId)
    .limit(limit * 2); // Get extra in case some are already done

  if (!allChunks || allChunks.length === 0) {
    return { processed: 0, failed: 0 };
  }

  // Filter out already embedded chunks
  const { data: existingEmbeddings } = await supabase
    .from('memory_chunks')
    .select('conversation_id')
    .eq('user_id', userId);

  const embeddedIds = new Set(existingEmbeddings?.map(e => e.conversation_id) || []);
  const chunksToProcess = allChunks.filter(c => !embeddedIds.has(c.conversation_id)).slice(0, limit);

  if (chunksToProcess.length === 0) {
    // All done! Lock the soulprint permanently
    const totalEmbedded = embeddedIds.size;
    const totalChunks = allChunks.length;
    
    await supabase
      .from('user_profiles')
      .update({ 
        embedding_status: 'complete',
        embedding_progress: 100,
        import_status: 'locked',
        soulprint_locked: true,
        locked_at: new Date().toISOString(),
        embeddings_completed_at: new Date().toISOString(),
        processed_chunks: totalChunks,
      })
      .eq('user_id', userId);
    
    console.log(`[Embed] User ${userId} soulprint LOCKED - all ${totalEmbedded} chunks embedded (no remaining)`);
    return { processed: 0, failed: 0 };
  }

  // Process in parallel batches
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < chunksToProcess.length; i += PARALLEL_WORKERS) {
    const batch = chunksToProcess.slice(i, i + PARALLEL_WORKERS);
    
    const results = await Promise.all(batch.map(chunk => processChunk(chunk)));
    
    results.forEach(success => {
      if (success) processed++;
      else failed++;
    });

    // Rate limit delay
    if (i + PARALLEL_WORKERS < chunksToProcess.length) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
    }
  }

  // Update progress
  const { data: totalChunks } = await supabase
    .from('conversation_chunks')
    .select('id', { count: 'exact' })
    .eq('user_id', userId);

  const { data: embeddedCount } = await supabase
    .from('memory_chunks')
    .select('id', { count: 'exact' })
    .eq('user_id', userId);

  const total = totalChunks?.length || 0;
  const embedded = (embeddedCount?.length || 0) + processed;
  const progress = total > 0 ? Math.round((embedded / total) * 100) : 0;
  const isComplete = embedded >= total && total > 0;

  // When all embeddings are complete, lock the soulprint permanently
  // This prevents any re-imports - one soulprint per account, finalized
  if (isComplete) {
    await supabase
      .from('user_profiles')
      .update({
        embedding_status: 'complete',
        embedding_progress: 100,
        import_status: 'locked',  // Finalize the import
        soulprint_locked: true,   // Lock the soulprint permanently
        locked_at: new Date().toISOString(),
        embeddings_completed_at: new Date().toISOString(),
        processed_chunks: total,
      })
      .eq('user_id', userId);
    
    console.log(`[Embed] User ${userId} soulprint LOCKED - all ${total} chunks embedded`);
  } else {
    await supabase
      .from('user_profiles')
      .update({
        embedding_status: 'processing',
        embedding_progress: progress,
        processed_chunks: embedded,
      })
      .eq('user_id', userId);
  }

  return { processed, failed };
}

export async function POST(request: NextRequest) {
  try {
    const { userId, limit = BATCH_SIZE } = await request.json();

    if (userId) {
      // Process specific user
      const result = await processUserChunks(userId, limit);
      return NextResponse.json({
        success: true,
        userId,
        ...result,
      });
    }

    // Process all users with pending embeddings
    const { data: pendingUsers } = await supabase
      .from('user_profiles')
      .select('user_id')
      .or('embedding_status.is.null,embedding_status.eq.pending,embedding_status.eq.processing')
      .limit(10);

    if (!pendingUsers || pendingUsers.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending users' });
    }

    const results = [];
    for (const user of pendingUsers) {
      const result = await processUserChunks(user.user_id, limit);
      results.push({ userId: user.user_id, ...result });
    }

    return NextResponse.json({
      success: true,
      processed: results,
    });

  } catch (error) {
    console.error('[Embed API] Error:', error);
    return NextResponse.json(
      { error: 'Embedding process failed', details: String(error) },
      { status: 500 }
    );
  }
}

// GET endpoint for Vercel Cron
export async function GET(request: NextRequest) {
  // Verify cron secret if configured
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Trigger processing for all pending users
  const response = await POST(new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ limit: BATCH_SIZE }),
  }));

  return response;
}
