import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

// Timeout constants for reliability
const MEMORY_SEARCH_TIMEOUT_MS = 10000; // 10 seconds per search
const EMBEDDING_TIMEOUT_MS = 15000; // 15 seconds for embedding

/**
 * Wrap a promise with timeout - returns null on timeout instead of throwing
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T | null> {
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => {
      console.warn(`[Memory] ${operationName} timed out after ${timeoutMs}ms`);
      resolve(null);
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

export interface MemoryChunk {
  id: string;
  title: string;
  content: string;
  created_at: string;
  similarity: number;
  layer_index: number;
}

export interface LearnedFactResult {
  fact: string;
  category: string;
  similarity: number;
}

// Database row types for proper typing
interface ChunkRpcRow {
  id: string;
  title: string | null;
  content: string;
  created_at: string;
  similarity: number;
  layer_index: number | null;
}

interface ChunkTableRow {
  id: string;
  title: string | null;
  content: string;
  created_at: string;
  layer_index: number | null;
}

interface LearnedFactRow {
  fact: string;
  category: string;
  similarity: number;
}


// Helper to get lazy client
function getBedrockClient() {
  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Embed a query using Cohere Embed v3 (with timeout protection)
 */
export async function embedQuery(text: string): Promise<number[]> {
  const client = getBedrockClient();

  const command = new InvokeModelCommand({
    modelId: 'cohere.embed-english-v3',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      texts: [text.slice(0, 128000)], // Cohere v3 supports context
      input_type: 'search_query', // Critical for v3
      embedding_types: ['float'],
      truncate: 'END',
    }),
  });

  const embedPromise = async (): Promise<number[]> => {
    const response = await client.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.body));
    return result.embeddings.float[0];
  };

  try {
    const result = await withTimeout(embedPromise(), EMBEDDING_TIMEOUT_MS, 'embedQuery');
    if (result === null) {
      throw new Error('Embedding timed out');
    }
    return result;
  } catch (error) {
    console.error('[Embed] Cohere v3 error:', error);
    throw new Error(`Cohere embedding error: ${error}`);
  }
}

/**
 * Batch embed multiple texts
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const client = getBedrockClient();
  const BATCH_SIZE = 96;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map(t => t.slice(0, 128000));

    const command = new InvokeModelCommand({
      modelId: 'cohere.embed-english-v3',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        texts: batch,
        input_type: 'search_document',
        embedding_types: ['float'],
        truncate: 'END',
      }),
    });

    try {
      const response = await client.send(command);
      const result = JSON.parse(new TextDecoder().decode(response.body));
      allEmbeddings.push(...result.embeddings.float);
    } catch (error) {
      console.error('[Embed] Cohere v3 batch error:', error);
      throw new Error(`Cohere batch embedding error: ${error}`);
    }
  }

  return allEmbeddings;
}

/**
 * Search conversation_chunks by vector similarity with Layer Filtering (with timeout)
 */
export async function searchMemoryLayered(
  userId: string,
  query: string,
  topK: number = 5,
  minSimilarity: number = 0.3,
  layerIndex?: number,  // New RLM param
  queryEmbed?: number[] // Optimization: Reuse embedding if available
): Promise<MemoryChunk[]> {
  // Embed the query if not provided
  const queryEmbedding = queryEmbed || await embedQuery(query);

  const supabase = await createClient();

  const searchPromise = async (): Promise<MemoryChunk[]> => {
    // Call the NEW layered search function
    let rpcName = 'match_conversation_chunks_layered';

    // Try the layered RPC first
    let { data, error } = await supabase.rpc(rpcName, {
      query_embedding: queryEmbedding,
      match_user_id: userId,
      match_count: topK,
      match_threshold: minSimilarity,
      match_layer: layerIndex || null // Pass null to search all layers
    });

    if (error) {
      // If function doesn't exist, try the old one (fallback for safety)
      if (error.code === '42883') { // Undefined function
        console.warn('[Memory] Layered RPC missing, falling back to basic search');
        const fallback = await supabase.rpc('match_conversation_chunks', {
          query_embedding: queryEmbedding,
          match_user_id: userId,
          match_count: topK,
          match_threshold: minSimilarity,
        });
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        console.error('Memory search error:', error);
        throw new Error(`Failed to search memory: ${error.message}`);
      }
    }

    return (data || []).map((row: ChunkRpcRow) => ({
      id: row.id,
      title: row.title || 'Untitled',
      content: row.content,
      created_at: row.created_at,
      similarity: row.similarity,
      layer_index: row.layer_index || 1, // Default to 1 if missing
    }));
  };

  const result = await withTimeout(
    searchPromise(),
    MEMORY_SEARCH_TIMEOUT_MS,
    `searchMemoryLayered(layer=${layerIndex || 'all'})`
  );

  // Return empty array on timeout (graceful degradation)
  return result || [];
}

/**
 * Fallback keyword search (with timeout)
 */
async function keywordSearch(
  userId: string,
  query: string,
  limit: number = 5
): Promise<MemoryChunk[]> {
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 5);

  if (keywords.length === 0) return [];

  const searchPromise = async (): Promise<MemoryChunk[]> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('conversation_chunks')
      .select('id, title, content, created_at, layer_index')
      .eq('user_id', userId)
      .or(keywords.map(k => `content.ilike.%${k}%`).join(','))
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.log('[Memory] Keyword search error:', error.message);
      return [];
    }

    return (data || []).map((row: ChunkTableRow, i: number) => ({
      id: row.id,
      title: row.title || 'Untitled',
      content: row.content,
      created_at: row.created_at,
      similarity: 0.5 - (i * 0.05),
      layer_index: row.layer_index || 1,
    }));
  };

  const result = await withTimeout(searchPromise(), MEMORY_SEARCH_TIMEOUT_MS, 'keywordSearch');
  return result || [];
}

/**
 * Search learned facts (with timeout)
 */
async function searchLearnedFacts(
  userId: string,
  queryEmbedding: number[],
  limit: number = 5,
  threshold: number = 0.5
): Promise<LearnedFactResult[]> {
  const searchPromise = async (): Promise<LearnedFactResult[]> => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('match_learned_facts', {
      query_embedding: queryEmbedding,
      match_user_id: userId,
      match_count: limit,
      match_threshold: threshold,
    });
    if (error) {
      console.log('[Memory] Learned facts retrieval failed:', error.message);
      return [];
    }
    return (data || []).map((row: LearnedFactRow) => ({
      fact: row.fact,
      category: row.category,
      similarity: row.similarity,
    }));
  };

  try {
    const result = await withTimeout(searchPromise(), MEMORY_SEARCH_TIMEOUT_MS, 'searchLearnedFacts');
    return result || [];
  } catch (e) {
    console.log('[Memory] Learned facts access error:', e);
    return [];
  }
}

// Overall timeout for entire memory context fetch (30s)
const MEMORY_CONTEXT_TIMEOUT_MS = 30000;

/**
 * Get Hierarchical (RLM) Context
 * Searches multiple layers to build a deep context window
 * Has overall timeout protection - returns empty context rather than hanging
 */
export async function getMemoryContext(
  userId: string,
  query: string,
  maxChunks: number = 5 // Not strictly used for all layers, but as a base
): Promise<{ chunks: MemoryChunk[]; contextText: string; method: string; learnedFacts: LearnedFactResult[] }> {
  const emptyResult = { chunks: [], contextText: '', method: 'timeout', learnedFacts: [] };

  const fetchContext = async () => {
    let chunks: MemoryChunk[] = [];
    let learnedFacts: LearnedFactResult[] = [];
    let method = 'none';
    let queryEmbedding: number[] | null = null;
    const usedChunksIDs = new Set<string>();

    try {
      queryEmbedding = await embedQuery(query);

      // 1. MACRO Layer (Layer 5) - Get high-level context
      // Broad, thematic chunks (5000 chars) that set the scene
      const macroChunks = await searchMemoryLayered(userId, query, 2, 0.25, 5, queryEmbedding);
      macroChunks.forEach(c => {
        if (!usedChunksIDs.has(c.id)) {
          chunks.push(c);
          usedChunksIDs.add(c.id);
        }
      });

      // 2. THEMATIC Layer (Layer 3) - Mid-level details
      // 1000 chars, standard chunks
      const thematicChunks = await searchMemoryLayered(userId, query, 3, 0.35, 3, queryEmbedding);
      thematicChunks.forEach(c => {
        if (!usedChunksIDs.has(c.id)) {
          chunks.push(c);
          usedChunksIDs.add(c.id);
        }
      });

      // 3. MICRO Layer (Layer 1) - Specific details
      // 200 chars, very precise matching
      const microChunks = await searchMemoryLayered(userId, query, 4, 0.45, 1, queryEmbedding);
      microChunks.forEach(c => {
        if (!usedChunksIDs.has(c.id)) {
          chunks.push(c);
          usedChunksIDs.add(c.id);
        }
      });

      // 4. Also get general chunks if we missed stuff (optional, search all layers)
      if (chunks.length < 3) {
        const generalChunks = await searchMemoryLayered(userId, query, 3, 0.3, undefined, queryEmbedding); // All layers
        generalChunks.forEach(c => {
          if (!usedChunksIDs.has(c.id)) {
            chunks.push(c);
            usedChunksIDs.add(c.id);
          }
        });
      }

      method = chunks.length > 0 ? 'hierarchical_vector' : 'none';
      console.log(`[RLM] Found ${chunks.length} chunks across layers (Macro:${macroChunks.length}, Thematic:${thematicChunks.length}, Micro:${microChunks.length})`);

      // Learned facts
      if (queryEmbedding) {
        learnedFacts = await searchLearnedFacts(userId, queryEmbedding, 10, 0.4);
      }

    } catch (error) {
      console.log('[RLM] Vector search failed:', error);
      // Fallback
      chunks = await keywordSearch(userId, query, 5);
      method = chunks.length > 0 ? 'keyword' : 'none';
    }

    // Deduplicate again just in case
    // Sort chunks by layer index (High to Low -> 5, then 3, then 1) to provide context from broad to narrow
    chunks.sort((a, b) => b.layer_index - a.layer_index);

    if (chunks.length === 0 && learnedFacts.length === 0) {
      return { chunks: [], contextText: '', method, learnedFacts: [] };
    }

    // Format Context
    const contextParts: string[] = [];

    // Facts first
    if (learnedFacts.length > 0) {
      const factsText = learnedFacts
        .map(f => `• [Fact] ${f.fact}`)
        .join('\n');
      contextParts.push(`[Learned Facts]\n${factsText}`);
    }

    // Memories organized by layer
    if (chunks.length > 0) {
      const formattedChunks = chunks.map(chunk => {
        const layerName = chunk.layer_index === 5 ? 'MACRO' : chunk.layer_index === 3 ? 'THEME' : chunk.layer_index === 1 ? 'MICRO' : 'MEMORY';
        // Truncate based on layer size slightly to ensure we don't blow context
        const maxLen = chunk.layer_index === 5 ? 2000 : 1000;
        return `[${layerName} Context: ${chunk.title}]\n${chunk.content.slice(0, maxLen)}...`;
      }).join('\n\n');
      contextParts.push(formattedChunks);
    }

    return {
      chunks,
      contextText: contextParts.join('\n\n---\n\n'),
      method,
      learnedFacts
    };
  }; // End of fetchContext

  // Wrap entire memory fetch with overall timeout
  const result = await withTimeout(fetchContext(), MEMORY_CONTEXT_TIMEOUT_MS, 'getMemoryContext');
  if (result === null) {
    console.warn('[Memory] Entire memory context fetch timed out, proceeding without memory');
    return emptyResult;
  }
  return result;
}
