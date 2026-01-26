/**
 * Memory Query - Direct function (no HTTP)
 * Call this directly from server-side code instead of going through the API route.
 */

import { createClient } from '@supabase/supabase-js';
import { invokeBedrockModel } from '@/lib/aws/bedrock';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface MemoryResult {
    content: string;
    significance: 'high' | 'medium' | 'low' | 'unknown';
    context?: string;
}

export interface MemoryResponse {
    relevant_memories: MemoryResult[];
    patterns_detected: string[];
    user_context: string;
    success: boolean;
    error?: string;
}

const MEMORY_EXTRACTION_PROMPT = `You are a memory extraction agent. Your task is to find information in a user's conversation history that is relevant to their query.

USER QUERY: {query}

CONVERSATION HISTORY:
{history}

---

Analyze the history and extract ALL relevant information. Consider:
1. Direct mentions of the query topic
2. Related topics and context
3. Patterns and recurring themes

Respond with a JSON object in this EXACT format:
{
    "relevant_memories": [
        {"content": "exact relevant quote or summary", "significance": "high/medium/low", "context": "why this is relevant"}
    ],
    "patterns_detected": ["list of patterns you noticed"],
    "user_context": "brief summary of what this reveals about the user"
}

Return ONLY valid JSON. No other text.`;

/**
 * Query memory directly (no HTTP call)
 */
export async function queryMemory(
    userId: string,
    query: string,
    providedHistory?: string
): Promise<MemoryResponse> {
    try {
        // Get history if not provided
        let history = providedHistory;
        if (!history) {
            history = await getUserHistory(userId, 100);
        }

        // Truncate if too long
        if (history.length > 50000) {
            history = history.substring(0, 50000);
        }

        // Skip if no meaningful history
        if (history.length < 100 || history === 'No conversation history available.') {
            return {
                relevant_memories: [],
                patterns_detected: [],
                user_context: '',
                success: true,
            };
        }

        // Build prompt
        const prompt = MEMORY_EXTRACTION_PROMPT
            .replace('{query}', query)
            .replace('{history}', history);

        console.log(`[Memory] Querying for: "${query.substring(0, 50)}..."`);

        // Call Bedrock
        const response = await invokeBedrockModel([
            { role: 'user', content: prompt }
        ]);

        console.log(`[Memory] Got response (${response.length} chars)`);

        // Parse JSON response
        try {
            const start = response.indexOf('{');
            const end = response.lastIndexOf('}') + 1;
            if (start >= 0 && end > start) {
                const parsed = JSON.parse(response.substring(start, end));
                return {
                    relevant_memories: parsed.relevant_memories || [],
                    patterns_detected: parsed.patterns_detected || [],
                    user_context: parsed.user_context || '',
                    success: true,
                };
            }
        } catch (parseError) {
            console.warn('[Memory] JSON parse error');
        }

        return {
            relevant_memories: [{ content: response, significance: 'unknown' }],
            patterns_detected: [],
            user_context: '',
            success: true,
        };

    } catch (error) {
        console.error('[Memory] Error:', error);
        return {
            relevant_memories: [],
            patterns_detected: [],
            user_context: '',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Get user's conversation history from database
 */
async function getUserHistory(userId: string, limit: number): Promise<string> {
    let history = '';

    // Get imported chats (GPT history)
    const { data: imported } = await supabaseAdmin
        .from('imported_chats')
        .select('role, content')
        .eq('user_id', userId)
        .order('original_timestamp', { ascending: false })
        .limit(limit);

    if (imported && imported.length > 0) {
        history += '=== IMPORTED HISTORY ===\n';
        for (const msg of imported.reverse()) {
            history += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
        }
    }

    // Get native chats
    const { data: native } = await supabaseAdmin
        .from('chat_logs')
        .select('role, content')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (native && native.length > 0) {
        history += '\n=== RECENT CONVERSATIONS ===\n';
        for (const msg of native.reverse()) {
            history += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
        }
    }

    return history || 'No conversation history available.';
}

/**
 * Format memories for injection into system prompt
 */
export function formatMemoriesForPrompt(response: MemoryResponse): string {
    if (!response.success || response.relevant_memories.length === 0) {
        return '';
    }

    let block = '\n### MEMORY CONTEXT\n';

    for (const mem of response.relevant_memories) {
        const sigTag = mem.significance !== 'unknown' ? `[${mem.significance.toUpperCase()}]` : '';
        block += `${sigTag} "${mem.content}"`;
        if (mem.context) {
            block += ` — ${mem.context}`;
        }
        block += '\n';
    }

    if (response.patterns_detected.length > 0) {
        block += '\n**Patterns:** ' + response.patterns_detected.join(', ') + '\n';
    }

    if (response.user_context) {
        block += `\n**Context:** ${response.user_context}\n`;
    }

    return block;
}
