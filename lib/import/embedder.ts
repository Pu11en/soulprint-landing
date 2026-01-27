/**
 * Embedder - Uses AWS Bedrock Titan to create embeddings
 * and stores them in Supabase
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { createClient } from '@supabase/supabase-js';
import { Chunk } from './chunker';

// Batch size for embedding requests (Titan supports up to ~8k tokens per request)
const EMBEDDING_BATCH_SIZE = 10;
const STORE_BATCH_SIZE = 50;

interface EmbeddedChunk extends Chunk {
  embedding: number[];
}

/**
 * Create Bedrock client
 */
function getBedrockClient(): BedrockRuntimeClient {
  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

/**
 * Create Supabase admin client (for service role operations)
 */
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/**
 * Embed a single text using Titan
 */
async function embedText(
  client: BedrockRuntimeClient,
  text: string
): Promise<number[]> {
  const modelId = process.env.BEDROCK_EMBEDDING_MODEL_ID || 'amazon.titan-embed-text-v2:0';
  
  const command = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      inputText: text,
      // Titan v2 supports different dimensions: 256, 512, 1024
      dimensions: 1024,
      normalize: true,
    }),
  });
  
  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  
  return responseBody.embedding;
}

/**
 * Embed multiple chunks in batches
 */
export async function embedChunks(
  chunks: Chunk[],
  onProgress?: (processed: number, total: number) => void
): Promise<EmbeddedChunk[]> {
  const client = getBedrockClient();
  const embeddedChunks: EmbeddedChunk[] = [];
  
  // Process in batches to avoid rate limits
  for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
    
    // Embed each chunk in the batch (could parallelize but being conservative)
    const embeddings = await Promise.all(
      batch.map(async (chunk) => {
        const embedding = await embedText(client, chunk.content);
        return { ...chunk, embedding };
      })
    );
    
    embeddedChunks.push(...embeddings);
    
    if (onProgress) {
      onProgress(embeddedChunks.length, chunks.length);
    }
    
    // Small delay between batches to avoid throttling
    if (i + EMBEDDING_BATCH_SIZE < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return embeddedChunks;
}

/**
 * Store embedded chunks in Supabase
 */
export async function storeChunks(
  userId: string,
  importJobId: string,
  embeddedChunks: EmbeddedChunk[],
  onProgress?: (stored: number, total: number) => void
): Promise<void> {
  const supabase = getSupabaseAdmin();
  
  // Insert in batches for efficiency
  for (let i = 0; i < embeddedChunks.length; i += STORE_BATCH_SIZE) {
    const batch = embeddedChunks.slice(i, i + STORE_BATCH_SIZE);
    
    const records = batch.map(chunk => ({
      user_id: userId,
      import_job_id: importJobId,
      content: chunk.content,
      embedding: JSON.stringify(chunk.embedding), // Supabase pgvector accepts JSON array
      metadata: chunk.metadata,
    }));
    
    const { error } = await supabase
      .from('memory_chunks')
      .insert(records);
    
    if (error) {
      throw new Error(`Failed to store chunks: ${error.message}`);
    }
    
    if (onProgress) {
      onProgress(Math.min(i + STORE_BATCH_SIZE, embeddedChunks.length), embeddedChunks.length);
    }
  }
}

/**
 * Create a query embedding for search
 */
export async function createQueryEmbedding(text: string): Promise<number[]> {
  const client = getBedrockClient();
  return embedText(client, text);
}

/**
 * Search memories by similarity
 */
export async function searchMemories(
  userId: string,
  queryText: string,
  limit: number = 10,
  threshold: number = 0.7
): Promise<Array<{
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}>> {
  const supabase = getSupabaseAdmin();
  const queryEmbedding = await createQueryEmbedding(queryText);
  
  const { data, error } = await supabase.rpc('search_memories', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_user_id: userId,
    match_count: limit,
    match_threshold: threshold,
  });
  
  if (error) {
    throw new Error(`Memory search failed: ${error.message}`);
  }
  
  return data || [];
}
