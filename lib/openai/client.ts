import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

// Load env if running server-side (Next.js automatically does this, but good for scripts)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Initialize OpenAI Client
// Use process.env directly; Next.js will expose it on server side
const apiKey = process.env.OPENAI_API_KEY;

let openai: OpenAI | null = null;

if (apiKey) {
    openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true // ONLY if using client-side, but we are using this in API routes (server-side)
    });
}

export type ChatMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string;
};

export async function chatCompletion(messages: ChatMessage[], options: { model?: string, temperature?: number } = {}) {
    if (!openai) throw new Error("OpenAI API Key not configured.");

    const completion = await openai.chat.completions.create({
        model: options.model || "gpt-4o",
        messages: messages,
        temperature: options.temperature || 0.7,
    });

    return completion.choices[0].message.content || "";
}

export async function* streamChatCompletion(messages: ChatMessage[], options: { model?: string, temperature?: number } = {}) {
    if (!openai) throw new Error("OpenAI API Key not configured.");

    const stream = await openai.chat.completions.create({
        model: options.model || "gpt-4o",
        messages: messages,
        temperature: options.temperature || 0.7,
        stream: true,
    });

    for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
            yield content;
        }
    }
}
