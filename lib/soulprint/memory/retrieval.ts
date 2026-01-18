import { chatCompletion, ChatMessage } from '@/lib/llm/local-client';
import { SupabaseClient } from '@supabase/supabase-js';

import OpenAI from 'openai';

// Initialize OpenAI for embeddings - SERVER-ONLY
// This module should only be imported from API routes/server actions
let openaiInstance: OpenAI | null = null;

function getOpenAIClient() {
    if (!openaiInstance) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY environment variable is not set. This is required for embedding generation.');
        }
        openaiInstance = new OpenAI({ apiKey });
    }
    return openaiInstance;
}

/**
 * Generates vector embeddings for semantic search.
 * Uses text-embedding-3-small (1536 dimensions) to match Supabase schema.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    try {
        const openai = getOpenAIClient();
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text.replace(/\n/g, ' '),
            dimensions: 1536
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error("Embedding generation failed:", error);
        return []; // Return empty on failure to not block chat, though search will fail
    }
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
