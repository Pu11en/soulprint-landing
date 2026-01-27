import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { createClient } from '@/lib/supabase/server';

// Initialize Bedrock client
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export interface MemoryChunk {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
  similarity: number;
}

/**
 * Embed a query using Amazon Titan Embeddings V2
 */
export async function embedQuery(text: string): Promise<number[]> {
  const command = new InvokeModelCommand({
    modelId: process.env.BEDROCK_EMBEDDING_MODEL_ID || 'amazon.titan-embed-text-v2:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      inputText: text,
      dimensions: 1024,
      normalize: true,
    }),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  
  return responseBody.embedding;
}

/**
 * Search memory_chunks by vector similarity
 * Returns top-k relevant chunks filtered by user_id
 */
export async function searchMemory(
  userId: string,
  query: string,
  topK: number = 5,
  minSimilarity: number = 0.5
): Promise<MemoryChunk[]> {
  // Embed the query
  const queryEmbedding = await embedQuery(query);
  
  // Create Supabase client
  const supabase = await createClient();
  
  // Call the vector similarity search function
  // Uses pgvector's cosine similarity via a stored function
  const { data, error } = await supabase.rpc('match_memory_chunks', {
    query_embedding: queryEmbedding,
    match_user_id: userId,
    match_count: topK,
    match_threshold: minSimilarity,
  });

  if (error) {
    console.error('Memory search error:', error);
    throw new Error(`Failed to search memory: ${error.message}`);
  }

  return (data || []).map((row: {
    id: string;
    content: string;
    metadata: Record<string, unknown>;
    created_at: string;
    similarity: number;
  }) => ({
    id: row.id,
    content: row.content,
    metadata: row.metadata,
    created_at: row.created_at,
    similarity: row.similarity,
  }));
}

/**
 * Get memory context formatted for chat
 */
export async function getMemoryContext(
  userId: string,
  query: string,
  maxChunks: number = 5
): Promise<{ chunks: MemoryChunk[]; contextText: string }> {
  const chunks = await searchMemory(userId, query, maxChunks);
  
  if (chunks.length === 0) {
    return { chunks: [], contextText: '' };
  }

  const contextText = chunks
    .map((chunk, i) => `[Memory ${i + 1}] ${chunk.content}`)
    .join('\n\n');

  return { chunks, contextText };
}
