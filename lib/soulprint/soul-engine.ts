import { SupabaseClient } from '@supabase/supabase-js';
import { SoulPrintData } from './types';
import { ChatMessage } from '@/lib/llm/local-client';
import { constructDynamicSystemPrompt } from './generator';
import { inferContext, retrieveContext } from './memory/retrieval';

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

        // 3. Agentic Memory Loop (The "Thinking" Step)
        console.log(`[SoulEngine] Thinking... (Input: "${content.slice(0, 20)}...")`);

        try {
            // A. Infer Context
            const contextTopic = await inferContext(recentMessages);
            console.log(`[SoulEngine] Latent Context: "${contextTopic}"`);

            // B. Retrieve Memories (Vector Search)
            // We combine the topic with the actual message to ground the search
            const searchQuery = `${contextTopic}: ${content}`;
            const memories = await retrieveContext(this.supabase, this.userId, searchQuery);

            // 4. Inject Memory into Prompt
            if (memories.length > 0) {
                prompt += `\n\n## LONG-TERM MEMORY (Context: "${contextTopic}")\n`;
                prompt += `The following are relevant memories from your past interactions with this user:\n`;
                memories.forEach((m, i) => prompt += `[Memory ${i + 1}] ${m}\n`);
                prompt += `\nINSTRUCTION: Utilize these memories to inform your response. Do NOT explicitly say "I looked up my memory". Just speak as if you already knew this context.`;
            } else {
                console.log(`[SoulEngine] No relevant memories found.`);
            }

        } catch (e) {
            console.error("[SoulEngine] Cognitive Loop Failed (Falling back to base persona):", e);
            // Fallback is just the base prompt, which we already have.
        }

        return prompt;
    }
}
