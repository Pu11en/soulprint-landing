/**
 * Background Embedding Processor
 * Embeds conversation_chunks using OpenAI text-embedding-3-small
 * Stores embeddings directly in the conversation_chunks table
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors
let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

// Configuration
const BATCH_SIZE = 50;       // Chunks to embed per batch (OpenAI limit is 2048)
const PARALLEL_BATCHES = 2;  // Number of parallel API calls

interface ConversationChunk {
  id: string;
  user_id: string;
  content: string;
}

/**
 * Generate embeddings using OpenAI text-embedding-3-small
 * Returns array of embeddings in same order as input
 */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  // Truncate texts to safe limit
  const truncated = texts.map(t => t.slice(0, 8000));

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: truncated,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI embedding error: ${error}`);
  }

  const data = await response.json();
  
  // Sort by index to maintain order
  return data.data
    .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
    .map((item: { embedding: number[] }) => item.embedding);
}

/**
 * Process a batch of chunks - embed and update
 */
async function processBatch(chunks: ConversationChunk[]): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  try {
    // Generate embeddings for all chunks in batch
    const embeddings = await generateEmbeddings(chunks.map(c => c.content));

    // Update each chunk with its embedding
    for (let i = 0; i < chunks.length; i++) {
      const { error } = await getSupabase()
        .from('conversation_chunks')
        .update({ embedding: embeddings[i] })
        .eq('id', chunks[i].id);

      if (error) {
        console.error(`[Embed] Error updating chunk ${chunks[i].id}:`, error.message);
        failed++;
      } else {
        success++;
      }
    }
  } catch (error) {
    console.error('[Embed] Batch embedding error:', error);
    failed = chunks.length;
  }

  return { success, failed };
}

/**
 * Process all unembedded chunks for a user
 */
async function processUserChunks(userId: string, limit: number): Promise<{ processed: number; failed: number; total: number }> {
  // Get chunks without embeddings
  const { data: chunks, error: fetchError } = await getSupabase()
    .from('conversation_chunks')
    .select('id, user_id, content')
    .eq('user_id', userId)
    .is('embedding', null)
    .limit(limit);

  if (fetchError) {
    console.error('[Embed] Error fetching chunks:', fetchError);
    throw fetchError;
  }

  if (!chunks || chunks.length === 0) {
    // All done! Update user status
    // NOTE: soulprint_locked=true means "initial import complete", NOT "no more updates"
    // The soulprint will continue to learn and evolve from conversations
    await getSupabase()
      .from('user_profiles')
      .update({ 
        embedding_status: 'complete',
        embedding_progress: 100,
        import_status: 'complete',
        soulprint_locked: true, // Marks initial import as done (can't re-import)
        locked_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    
    console.log(`[Embed] User ${userId} complete - all chunks embedded, soulprint will continue to evolve`);
    return { processed: 0, failed: 0, total: 0 };
  }

  console.log(`[Embed] Processing ${chunks.length} chunks for user ${userId}`);

  let totalProcessed = 0;
  let totalFailed = 0;

  // Process in batches
  for (let i = 0; i < chunks.length; i += BATCH_SIZE * PARALLEL_BATCHES) {
    const batchGroup = chunks.slice(i, i + BATCH_SIZE * PARALLEL_BATCHES);
    
    // Split into parallel batches
    const batches: ConversationChunk[][] = [];
    for (let j = 0; j < batchGroup.length; j += BATCH_SIZE) {
      batches.push(batchGroup.slice(j, j + BATCH_SIZE));
    }

    // Process batches in parallel
    const results = await Promise.all(batches.map(batch => processBatch(batch)));
    
    results.forEach(r => {
      totalProcessed += r.success;
      totalFailed += r.failed;
    });
  }

  // Update progress
  const { count: totalCount } = await getSupabase()
    .from('conversation_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const { count: embeddedCount } = await getSupabase()
    .from('conversation_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('embedding', 'is', null);

  const total = totalCount || 0;
  const embedded = embeddedCount || 0;
  const progress = total > 0 ? Math.round((embedded / total) * 100) : 0;
  const isComplete = embedded >= total;

  // NOTE: soulprint_locked=true means "initial import complete", NOT "no more updates"
  // The soulprint will continue to learn and evolve from conversations
  await getSupabase()
    .from('user_profiles')
    .update({
      embedding_status: isComplete ? 'complete' : 'processing',
      embedding_progress: progress,
      processed_chunks: embedded,
      import_status: isComplete ? 'complete' : 'processing',
      soulprint_locked: isComplete, // Marks initial import as done (can't re-import)
      ...(isComplete && { locked_at: new Date().toISOString() }),
    })
    .eq('user_id', userId);

  console.log(`[Embed] User ${userId}: ${embedded}/${total} (${progress}%) - processed ${totalProcessed}, failed ${totalFailed}`);

  return { processed: totalProcessed, failed: totalFailed, total };
}

export async function POST(request: NextRequest) {
  try {
    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { userId, limit = BATCH_SIZE * 2 } = body;

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
    // Skip 'importing' status - that means save-soulprint is still writing chunks
    const { data: pendingUsers } = await getSupabase()
      .from('user_profiles')
      .select('user_id')
      .or('embedding_status.eq.pending,embedding_status.eq.processing')
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
  return POST(new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ limit: BATCH_SIZE * 2 }),
  }));
}
