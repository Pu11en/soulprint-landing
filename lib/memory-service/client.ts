/**
 * Memory Service Client
 * Calls the internal /api/memory/query endpoint for intelligent memory retrieval.
 */

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

/**
 * Query memory for relevant context - calls internal API
 */
export async function queryMemoryService(
    userId: string,
    query: string,
    history: string,
    maxResults: number = 10
): Promise<MemoryResponse> {
    try {
        // Call internal API route
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        
        const response = await fetch(`${baseUrl}/api/memory/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                query,
                history,
                max_results: maxResults,
            }),
        });

        if (!response.ok) {
            throw new Error(`Memory API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('[Memory] Query failed:', error);
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
 * Format memory response for injection into system prompt
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

/**
 * Get user's conversation history from database
 * Note: This is now handled by the API route, but kept for direct access if needed
 */
export async function getUserHistoryForMemory(
    supabase: any,
    userId: string,
    limit: number = 100
): Promise<string> {
    try {
        let history = '';

        const { data: imported } = await supabase
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

        const { data: native } = await supabase
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
    } catch (error) {
        console.error('[Memory] Failed to get history:', error);
        return 'Error retrieving history.';
    }
}
