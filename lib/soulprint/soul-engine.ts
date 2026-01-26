import { SupabaseClient } from '@supabase/supabase-js';
import { SoulPrintData } from './types';
import { ChatMessage } from '@/lib/llm/local-client';
import { constructDynamicSystemPrompt } from './generator';
// Context inference - simple keyword extraction
async function inferContext(messages: ChatMessage[]): Promise<string> {
    const lastUserMsg = messages.filter(m => m.role === 'user').pop();
    if (!lastUserMsg) return 'general';
    // Return first 50 chars as context topic
    return lastUserMsg.content.substring(0, 50);
}
import { getDisplayName } from './name-generator';
import { searchWeb, formatResultsForLLM } from '@/lib/tavily';
import { 
    queryMemoryService, 
    formatMemoriesForPrompt, 
    getUserHistoryForMemory,
    checkMemoryServiceHealth 
} from '@/lib/memory-service/client';

/**
 * SOUL ENGINE V1
 * The agentic core that orchestrates Personality + Memory + Context.
 */
export class SoulEngine {
    private supabase: SupabaseClient;
    private userId: string;
    private soulprint: SoulPrintData;

    constructor(supabase: SupabaseClient, userId: string, soulprint: SoulPrintData) {
        this.supabase = supabase;
        this.userId = userId;
        this.soulprint = soulprint;
    }

    /**
     * Updates the SoulPrint data (e.g., when name changes)
     */
    updateSoulprint(newSoulprint: SoulPrintData): void {
        this.soulprint = newSoulprint;
    }

    /**
     * Gets the current companion name
     */
    getCompanionName(): string {
        return getDisplayName(this.soulprint);
    }

    /**
     * dynamically assembles the system prompt for the current turn.
     * Implements "Short-Circuit" logic for speed vs "Deep Thought" for substance.
     */
    async constructSystemPrompt(recentMessages: ChatMessage[]): Promise<string> {
        // 1. Generate Base Persona (The "Soul")
        // Reuse the existing visual formatting logic
        let prompt = constructDynamicSystemPrompt(this.soulprint);

        // 2. Short Circuit Optimization (Latency Guard)
        const lastMsg = recentMessages[recentMessages.length - 1];

        // If no user message (start of chat) or just system/assistant, return base.
        if (!lastMsg || lastMsg.role !== 'user') return prompt;

        const content = lastMsg.content.trim();
        // Fast path for short greetings/acks
        const isPhatic = content.length < 15 || /^(hi|hello|hey|thanks|ok|cool|good|yes|no)$/i.test(content);

        if (isPhatic) {
            // Return plain prompt to trigger fast response
            return prompt;
        }

        // 3. Intelligent Memory Retrieval (via Memory Service)
        try {
            // A. Infer Context for the query
            const contextTopic = await inferContext(recentMessages);
            const searchQuery = `${contextTopic}: ${content}`;
            
            console.log(`[SoulEngine] Memory query: "${searchQuery.substring(0, 50)}..."`);

            // B. Get user's conversation history for memory service
            const userHistory = await getUserHistoryForMemory(this.supabase, this.userId, 100);
            
            // C. Query the memory service (LLM-powered extraction)
            const memoryResponse = await queryMemoryService(
                this.userId,
                searchQuery,
                userHistory,
                10
            );

            // D. Inject Memory into Prompt
            if (memoryResponse.success && memoryResponse.relevant_memories.length > 0) {
                const memoryBlock = formatMemoriesForPrompt(memoryResponse);
                
                // Replace placeholder if it exists, otherwise append
                if (prompt.includes('### L3: ACTIVE MEMORY LAYER (Placeholder)')) {
                    prompt = prompt.replace(
                        '### L3: ACTIVE MEMORY LAYER (Placeholder)\n(Dynamic context will be injected here at runtime)\n', 
                        memoryBlock
                    );
                } else {
                    prompt += memoryBlock;
                }
                
                console.log(`[SoulEngine] Injected ${memoryResponse.relevant_memories.length} memories`);
            } else {
                // Clean up placeholder if no memories
                if (prompt.includes('### L3: ACTIVE MEMORY LAYER (Placeholder)')) {
                    prompt = prompt.replace(
                        '### L3: ACTIVE MEMORY LAYER (Placeholder)\n(Dynamic context will be injected here at runtime)\n', 
                        ''
                    );
                }
                
                if (!memoryResponse.success) {
                    console.warn('[SoulEngine] Memory service error:', memoryResponse.error);
                }
            }

        } catch (e) {
            console.error("[SoulEngine] Memory retrieval failed:", e);
            // Continue without memory - base prompt is still valid
        }

        return prompt;
    }

    /**
     * Searches the web for real-time information.
     * Call this when the user asks about current events, facts, or anything 
     * that requires up-to-date information beyond training data.
     */
    async searchWeb(query: string): Promise<string> {
        if (!process.env.TAVILY_API_KEY) {
            return '';
        }

        try {
            const results = await searchWeb(query, {
                maxResults: 5,
                includeAnswer: true,
                searchDepth: 'basic',
            });
            return formatResultsForLLM(results);
        } catch (e) {
            console.error('[SoulEngine] Web search failed:', e);
            return '';
        }
    }

    /**
     * Determines if a query requires web search based on content analysis.
     * Returns true for questions about current events, prices, news, etc.
     */
    needsWebSearch(content: string): boolean {
        const webSearchIndicators = [
            /\b(current|latest|recent|today|now|2024|2025|2026)\b/i,
            /\b(news|stock|price|weather|score|result)\b/i,
            /\b(who is|what is|when did|where is)\b/i,
            /\b(happening|released|announced|launched)\b/i,
            /\?/,  // Questions often need current info
        ];
        return webSearchIndicators.some(pattern => pattern.test(content));
    }
}
