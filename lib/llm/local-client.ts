/**
 * LLM Client - SageMaker + Ollama Fallback
 * 
 * Production: Uses AWS SageMaker (Hermes-2-Pro-Llama-3)
 * Development: Falls back to local Ollama if SageMaker unavailable
 */

import { invokeSoulPrintModel, invokeSoulPrintModelStream } from '@/lib/aws/sagemaker';

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = 'hermes3';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * Check if we're in a serverless environment (Vercel, AWS Lambda, etc.)
 */
function isServerless(): boolean {
    return !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL_ENV);
}

/**
 * Check if Ollama is running locally (for development)
 */
export async function checkOllamaHealth(): Promise<boolean> {
    if (isServerless()) return false; // Don't even try in serverless

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);

        const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) return false;

        const data = await res.json();
        const hasModel = data.models?.some((m: { name: string }) => m.name.includes('hermes3'));
        return hasModel;
    } catch {
        return false;
    }
}

/**
 * Check if SageMaker is configured
 */
function isSageMakerConfigured(): boolean {
    return !!(
        process.env.AWS_ACCESS_KEY_ID &&
        process.env.AWS_SECRET_ACCESS_KEY &&
        process.env.SAGEMAKER_ENDPOINT_NAME
    );
}

/**
 * Format messages for SageMaker (ChatML format for Hermes)
 */
function formatChatML(messages: ChatMessage[]): string {
    let prompt = "";
    for (const m of messages) {
        prompt += `<|im_start|>${m.role}\n${m.content}\n<|im_end|>\n`;
    }
    prompt += "<|im_start|>assistant\n";
    return prompt;
}

/**
 * Stream chat completion - SageMaker primary, Ollama fallback
 * Note: Uses non-streaming SageMaker with simulated streaming for better reliability
 */
export async function* streamChatCompletion(
    messages: ChatMessage[],
    model: string = DEFAULT_MODEL
): AsyncGenerator<string, void, unknown> {
    // Try SageMaker first (production)
    if (isSageMakerConfigured()) {
        console.log('[LLM] Using SageMaker (simulated streaming)');
        try {
            const prompt = formatChatML(messages);

            // Use NON-STREAMING call for reliability, then simulate streaming
            const response = await invokeSoulPrintModel({
                inputs: prompt,
                parameters: {
                    max_new_tokens: 512,
                    temperature: 0.7,
                    details: false
                }
            });

            // Parse TGI response
            let fullText = '';
            if (Array.isArray(response) && response[0]?.generated_text) {
                fullText = response[0].generated_text;
                // Strip echoed prompt if present
                if (fullText.startsWith(prompt)) {
                    fullText = fullText.substring(prompt.length);
                }
            } else if (typeof response === 'string') {
                fullText = response;
            } else {
                fullText = JSON.stringify(response);
            }

            fullText = fullText.trim();

            // Simulate streaming by yielding words with small delays
            const words = fullText.split(' ');
            for (let i = 0; i < words.length; i++) {
                const word = words[i] + (i < words.length - 1 ? ' ' : '');
                yield word;
            }
            return;
        } catch (error) {
            console.error('[LLM] SageMaker failed:', error);
            // Fall through to Ollama if in dev
            if (isServerless()) throw error;
        }
    }

    // Fallback to Ollama (development only)
    const ollamaAvailable = await checkOllamaHealth();
    if (!ollamaAvailable) {
        throw new Error('No LLM available. SageMaker not configured and Ollama not running.');
    }

    console.log('[LLM] Using Ollama (streaming)');
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages,
            stream: true,
            options: { temperature: 0.8, num_ctx: 4096 }
        }),
    });

    if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
    }

    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
            try {
                const json = JSON.parse(line);
                if (json.message?.content) {
                    yield json.message.content;
                }
                if (json.done) {
                    return;
                }
            } catch {
                // Skip parse errors
            }
        }
    }
}

/**
 * Non-streaming chat completion - SageMaker primary, Ollama fallback
 */
export async function chatCompletion(
    messages: ChatMessage[],
    model: string = DEFAULT_MODEL
): Promise<string> {
    // Try SageMaker first (production)
    if (isSageMakerConfigured()) {
        console.log('[LLM] Using SageMaker (non-streaming)');
        try {
            const prompt = formatChatML(messages);
            const response = await invokeSoulPrintModel({
                inputs: prompt,
                parameters: {
                    max_new_tokens: 512,
                    temperature: 0.7,
                    details: false
                }
            });

            // Parse TGI response
            if (Array.isArray(response) && response[0]?.generated_text) {
                let text = response[0].generated_text;
                if (text.startsWith(prompt)) {
                    text = text.substring(prompt.length);
                }
                return text.trim();
            }

            return typeof response === 'string' ? response : JSON.stringify(response);
        } catch (error) {
            console.error('[LLM] SageMaker failed:', error);
            if (isServerless()) throw error;
            // Fall through to Ollama if in dev
        }
    }

    // Fallback to Ollama (development only)
    const ollamaAvailable = await checkOllamaHealth();
    if (!ollamaAvailable) {
        throw new Error('No LLM available. SageMaker not configured and Ollama not running.');
    }

    console.log('[LLM] Using Ollama (non-streaming)');
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages,
            stream: false,
            options: { temperature: 0.8 }
        }),
    });

    if (!response.ok) throw new Error('Ollama API failed');

    const data = await response.json();
    return data.message?.content || '';
}

/**
 * Legacy health check - returns true if any LLM is available
 */
export async function checkHealth(): Promise<boolean> {
    if (isSageMakerConfigured()) return true;
    return checkOllamaHealth();
}
