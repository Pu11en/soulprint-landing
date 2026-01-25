import { chatCompletion, ChatMessage } from '@/lib/llm/local-client';
import { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

// Use AWS Bedrock Titan for embeddings instead of OpenAI
import { generateEmbedding } from '@/lib/aws/embeddings';

// Re-export for backward compatibility
export { generateEmbedding };

// ============================================================
// RLM Query Cache - In-memory cache with TTL for speed
// ============================================================

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

// In-memory cache (per-process)
const queryCache = new Map<string, CacheEntry<MemoryResult[]>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 500;
let lastCleanup = 0;
const CLEANUP_INTERVAL = 60 * 1000; // Clean every 60 seconds max

/**
 * Clean expired entries from cache to prevent memory leak
 */
function cleanExpiredCache(): void {
    const now = Date.now();

    // Only clean periodically to avoid performance hit
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;

    let cleaned = 0;
    for (const [key, entry] of queryCache.entries()) {
        if (now > entry.expiresAt) {
            queryCache.delete(key);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        console.log(`[MemoryCache] Cleaned ${cleaned} expired entries, ${queryCache.size} remaining`);
    }
}

function generateQueryHash(userId: string, query: string): string {
    return createHash('sha256').update(`${userId}:${query.toLowerCase().trim()}`).digest('hex');
}

function getCachedResult(hash: string): MemoryResult[] | null {
    // Clean expired entries periodically
    cleanExpiredCache();

    const entry = queryCache.get(hash);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
        queryCache.delete(hash);
        return null;
    }

    return entry.data;
}

function setCacheResult(hash: string, results: MemoryResult[]): void {
    // Clean expired entries periodically
    cleanExpiredCache();

    // Evict oldest entries if cache is full
    if (queryCache.size >= MAX_CACHE_SIZE) {
        const firstKey = queryCache.keys().next().value;
        if (firstKey) queryCache.delete(firstKey);
    }

    queryCache.set(hash, {
        data: results,
        expiresAt: Date.now() + CACHE_TTL_MS
    });
}

// Query type detection for tiered depth
type QueryType = 'phatic' | 'standard' | 'complex';

function detectQueryType(query: string, context?: string): QueryType {
    const lowerQuery = query.toLowerCase();
    const lowerContext = context?.toLowerCase() || '';

    // Phatic: greetings, small talk
    const phaticPatterns = [
        /^(hi|hello|hey|sup|yo|good morning|good evening|how are you|what'?s up)/i,
        /phatic/i,
    ];
    if (phaticPatterns.some(p => p.test(lowerQuery)) || lowerContext === 'phatic') {
        return 'phatic';
    }

    // Complex: emotional, deep, reflective queries
    const complexPatterns = [
        /\b(feel|feeling|felt|emotion|sad|happy|anxious|worried|scared|love|hate|angry|depressed|stressed)\b/i,
        /\b(why do i|help me understand|struggle with|dealing with|cope with)\b/i,
        /\b(relationship|family|work|career|life|meaning|purpose|identity)\b/i,
        /\b(remember when|think about|reflect on|reminds me of)\b/i,
    ];
    if (complexPatterns.some(p => p.test(lowerQuery))) {
        return 'complex';
    }

    return 'standard';
}

function getDepthForQueryType(type: QueryType): { limit: number; threshold: number } {
    switch (type) {
        case 'phatic':
            return { limit: 3, threshold: 0.75 };
        case 'complex':
            return { limit: 15, threshold: 0.55 };
        case 'standard':
        default:
            return { limit: 8, threshold: 0.6 };
    }
}

// Types for unified memory retrieval
export interface MemoryResult {
    content: string;
    source: 'native' | 'chatgpt' | 'claude' | 'other';
    similarity: number;
    timestamp?: string;
}

/**
 * infers the "Latent Context" of a conversation.
 * Example: User says "It happened again." -> Context: "Recurring marital conflict."
 */
export async function inferContext(recentMessages: ChatMessage[]): Promise<string> {
    // 1. Prepare a concise transcript
    const transcript = recentMessages.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n');

    // 2. Ask LLM to Identify Latent Topic
    const systemPrompt = `Analyze the conversation transcript below.
Identify the LATENT TOPIC or SUBTEXT that the user is referring to.
Be specific but concise (under 10 words).
If the user is just saying hello or small talk, return "Phatic".
If the context is unclear, return "General".`;

    try {
        const context = await chatCompletion([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: transcript }
        ], 'hermes3'); // Use fast local model

        return context.trim();
    } catch (e) {
        console.error("Context inference failed:", e);
        return "General";
    }
}

/**
 * Retrieves relevant past interactions from Supabase based on semantic similarity.
 */
export async function retrieveContext(
    supabase: SupabaseClient,
    userId: string,
    query: string
): Promise<string[]> {
    if (!query || query === "Phatic" || query === "General") return [];

    const embedding = await generateEmbedding(query);
    if (embedding.length === 0) return [];

    // Call Supabase RPC or direct vector comparison
    // Assuming 1536 dim vector in 'embedding' column
    const { data, error } = await supabase.rpc('match_chat_logs', {
        query_embedding: embedding,
        match_threshold: 0.7, // Only distinct matches
        match_count: 5,
        match_user_id: userId
    });

    if (error) {
        // Fallback: Try raw SQL if RPC doesn't exist (though RPC is best for vector)
        console.error("Vector search error (check if match_chat_logs RPC exists):", error);
        return [];
    }

    return (data || []).map((row: { content: string }) => row.content);
}

/**
 * Retrieves relevant context from BOTH native chat logs AND imported chats.
 * This is the "higher self" memory that combines all sources.
 *
 * @param options.useCache - Whether to use query caching (default: true)
 * @param options.queryType - Override automatic query type detection
 */
export async function retrieveUnifiedContext(
    supabase: SupabaseClient,
    userId: string,
    query: string,
    limit?: number,
    options?: { useCache?: boolean; queryType?: QueryType; inferredContext?: string }
): Promise<MemoryResult[]> {
    if (!query || query === "Phatic" || query === "General") return [];

    const useCache = options?.useCache ?? true;
    const queryType = options?.queryType ?? detectQueryType(query, options?.inferredContext);
    const depth = getDepthForQueryType(queryType);
    const effectiveLimit = limit ?? depth.limit;

    // Check cache first
    const cacheHash = generateQueryHash(userId, query);
    if (useCache) {
        const cached = getCachedResult(cacheHash);
        if (cached) {
            console.log(`[RLM Cache] HIT for query type "${queryType}"`);
            return cached.slice(0, effectiveLimit);
        }
    }

    console.log(`[RLM Cache] MISS - fetching ${effectiveLimit} results (${queryType} query)`);

    const embedding = await generateEmbedding(query);
    if (embedding.length === 0) return [];

    // Search both native and imported chats in parallel
    const [nativeResults, importedResults] = await Promise.all([
        // Native chat logs
        supabase.rpc('match_chat_logs', {
            query_embedding: embedding,
            match_threshold: depth.threshold,
            match_count: Math.ceil(effectiveLimit / 2) + 2, // Fetch a bit extra for merging
            match_user_id: userId
        }),
        // Imported chats (GPT, Claude, etc.)
        supabase.rpc('match_imported_chats', {
            query_embedding: embedding,
            match_threshold: depth.threshold,
            match_count: Math.ceil(effectiveLimit / 2) + 2,
            match_user_id: userId
        })
    ]);

    const results: MemoryResult[] = [];

    // Add native results
    if (!nativeResults.error && nativeResults.data) {
        for (const row of nativeResults.data) {
            results.push({
                content: row.content,
                source: 'native',
                similarity: row.similarity,
            });
        }
    }

    // Add imported results
    if (!importedResults.error && importedResults.data) {
        for (const row of importedResults.data) {
            results.push({
                content: row.content,
                source: row.source as 'chatgpt' | 'claude' | 'other',
                similarity: row.similarity,
                timestamp: row.original_timestamp,
            });
        }
    }

    // Sort by similarity (highest first) and return top N
    results.sort((a, b) => b.similarity - a.similarity);
    const finalResults = results.slice(0, effectiveLimit);

    // Cache the results (fire and forget)
    if (useCache && finalResults.length > 0) {
        setCacheResult(cacheHash, finalResults);
    }

    return finalResults;
}

/**
 * Smart RLM retrieval with automatic query type detection and caching.
 * This is the recommended function for chat contexts.
 *
 * - Phatic queries (greetings): 3 results, high threshold
 * - Standard queries: 8 results, medium threshold
 * - Complex/emotional queries: 15 results, lower threshold
 */
export async function smartRetrieve(
    supabase: SupabaseClient,
    userId: string,
    query: string,
    recentMessages?: ChatMessage[]
): Promise<{ results: MemoryResult[]; queryType: QueryType; cached: boolean }> {
    // Infer context from recent messages if available
    let inferredContext = '';
    if (recentMessages && recentMessages.length > 0) {
        try {
            inferredContext = await inferContext(recentMessages);
        } catch {
            // Ignore inference errors
        }
    }

    const queryType = detectQueryType(query, inferredContext);
    const cacheHash = generateQueryHash(userId, query);
    const cached = getCachedResult(cacheHash);

    if (cached) {
        return {
            results: cached,
            queryType,
            cached: true
        };
    }

    const results = await retrieveUnifiedContext(
        supabase,
        userId,
        query,
        undefined,
        { useCache: true, queryType, inferredContext }
    );

    return {
        results,
        queryType,
        cached: false
    };
}

/**
 * Clear the in-memory query cache.
 * Useful after importing new data.
 */
export function clearQueryCache(): void {
    queryCache.clear();
    console.log('[RLM Cache] Cleared');
}

/**
 * Get cache statistics for monitoring.
 */
export function getCacheStats(): { size: number; maxSize: number } {
    return {
        size: queryCache.size,
        maxSize: MAX_CACHE_SIZE
    };
}

/**
 * Gets the full chat history for RLM exploration.
 * Combines native and imported chats, ordered by timestamp.
 */
export async function getFullChatHistory(
    supabase: SupabaseClient,
    userId: string,
    limit: number = 1000
): Promise<{ source: string; role: string; content: string; created_at: string }[]> {
    const { data, error } = await supabase.rpc('get_full_chat_history', {
        p_user_id: userId,
        p_limit: limit
    });

    if (error) {
        console.error("Error fetching full chat history:", error);
        return [];
    }

    return data || [];
}

/**
 * Gets user's total message stats across all sources.
 */
export async function getUserMessageStats(
    supabase: SupabaseClient,
    userId: string
): Promise<{ native_count: number; imported_count: number; total_count: number }> {
    const { data, error } = await supabase.rpc('get_user_message_stats', {
        p_user_id: userId
    });

    if (error) {
        console.error("Error fetching message stats:", error);
        return { native_count: 0, imported_count: 0, total_count: 0 };
    }

    return data || { native_count: 0, imported_count: 0, total_count: 0 };
}
