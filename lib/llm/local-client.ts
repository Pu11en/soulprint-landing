/**
 * Local LLM Client - Ollama + Hermes 3
 * Replaces Gemini for human-like conversation when available
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = 'hermes3';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * Check if Ollama is running and the model is available
 */
export async function checkHealth(): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000); // 1s timeout

        const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
            headers: { 'ngrok-skip-browser-warning': 'true' },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) return false;

        const data = await res.json();
        // Check if hermes3 (or similar) is in the list
        const hasModel = data.models?.some((m: any) => m.name.includes('hermes3'));
        return hasModel;
    } catch (e) {
        return false;
    }
}

/**
 * Stream chat completion from Ollama
 */
export async function* streamChatCompletion(
    messages: ChatMessage[],
    model: string = DEFAULT_MODEL
): AsyncGenerator<string, void, unknown> {
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({
                model,
                messages,
                stream: true,
                options: {
                    temperature: 0.8, // Higher for more "human" creativity
                    num_ctx: 4096     // Context window
                }
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
                } catch (e) {
                    console.error('Error parsing Ollama chunk:', e);
                }
            }
        }
    } catch (error) {
        console.error('Local LLM Stream Error:', error);
        throw error;
    }
}

/**
 * Non-streaming chat completion
 */
export async function chatCompletion(
    messages: ChatMessage[],
    model: string = DEFAULT_MODEL
): Promise<string> {
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
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
    } catch (error) {
        console.error('Local LLM Error:', error);
        throw error;
    }
}
