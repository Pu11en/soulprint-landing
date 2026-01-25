/**
 * LLM Client - Smart Fallback System
 * 
 * Priority Order:
 * 1. AWS Bedrock (Claude Haiku) - PRODUCTION (secure, stays in AWS)
 * 2. SageMaker - Legacy AWS option
 * 3. Ollama Hermes3 - LOCAL BACKUP (development/offline work)
 * 
 * Hermes3 ensures you can always work, even without internet/AWS
 */
import { invokeSoulPrintModel } from '@/lib/aws/sagemaker';
import { invokeBedrockModel, invokeBedrockModelStream, ChatMessage } from '@/lib/aws/bedrock';

export type { ChatMessage };

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = 'hermes3'; // Local development backup


function isServerless(): boolean {
    return !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL_ENV);
}

// Check if Bedrock is configured (Preferred AWS Method)
function isBedrockConfigured(): boolean {
    if (process.env.NEXT_PUBLIC_FORCE_LOCAL_LLM === 'true') return false;
    return !!process.env.BEDROCK_MODEL_ID;
}

// Check if SageMaker is configured (Legacy AWS Method)
function isSageMakerConfigured(): boolean {
    if (process.env.NEXT_PUBLIC_FORCE_LOCAL_LLM === 'true') return false;
    return !!(
        process.env.AWS_ACCESS_KEY_ID &&
        process.env.AWS_SECRET_ACCESS_KEY &&
        process.env.SAGEMAKER_ENDPOINT_NAME
    );
}

export async function checkOllamaHealth(): Promise<boolean> {
    if (isServerless()) return false;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);
        const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) return false;
        const data = await res.json();
        return data.models?.some((m: { name: string }) => m.name.includes('hermes3'));
    } catch {
        return false;
    }
}

function formatChatML(messages: ChatMessage[]): string {
    let prompt = "";
    for (const m of messages) {
        prompt += `<|im_start|>${m.role}\n${m.content}\n<|im_end|>\n`;
    }
    prompt += "<|im_start|>assistant\n";
    return prompt;
}

export async function* streamChatCompletion(
    messages: ChatMessage[],
    model: string = DEFAULT_MODEL
): AsyncGenerator<string, void, unknown> {
    const configStatus = {
        bedrock: isBedrockConfigured(),
        sagemaker: isSageMakerConfigured(),
        serverless: isServerless()
    };

    console.log('[LLM] Configuration Check:', configStatus);
    
    // 1. AWS Bedrock (PRODUCTION - Claude Haiku) - TRUE STREAMING
    if (configStatus.bedrock) {
        try {
            console.log('[LLM] 🚀 Using AWS Bedrock...');
            for await (const chunk of invokeBedrockModelStream(messages)) {
                yield chunk;
            }
            return;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error('[LLM] ⚠️ Bedrock failed, trying fallbacks...', {
                error: err.message,
                stack: err.stack
            });
        }
    }

    // 2. AWS SageMaker (Legacy Cloud Option)
    if (configStatus.sagemaker) {
        try {
            console.log('[LLM] 🔧 Using AWS SageMaker...');
            const prompt = formatChatML(messages);
            const response = await invokeSoulPrintModel({
                inputs: prompt,
                parameters: { max_new_tokens: 512, temperature: 0.7, details: false }
            });

            let fullText = '';
            if (Array.isArray(response) && response[0]?.generated_text) {
                fullText = response[0].generated_text;
                if (fullText.startsWith(prompt)) fullText = fullText.substring(prompt.length);
            } else if (typeof response === 'string') {
                fullText = response;
            } else {
                fullText = JSON.stringify(response);
            }

            const words = fullText.trim().split(' ');
            for (let i = 0; i < words.length; i++) {
                yield words[i] + (i < words.length - 1 ? ' ' : '');
            }
            return;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error('[LLM] SageMaker failed:', {
                error: err.message,
                serverless: configStatus.serverless
            });
            if (configStatus.serverless) throw error;
        }
    }

    // 3. Ollama Hermes3 (LOCAL BACKUP - Development/Offline)
    console.log('[LLM] 🏠 Checking Ollama availability...');
    const ollamaAvailable = await checkOllamaHealth();
    if (!ollamaAvailable) {
        const errorMessage = `❌ No LLM service available. Configuration status:
- Bedrock: ${configStatus.bedrock ? '✅ Configured' : '❌ Missing credentials'}
- SageMaker: ${configStatus.sagemaker ? '✅ Configured' : '❌ Missing endpoint'}  
- Ollama: ${ollamaAvailable ? '✅ Running' : '❌ Not available'}

Solution: Add AWS credentials to Vercel environment or run Ollama locally for development.`;
        
        console.error('[LLM] Configuration Error:', errorMessage);
        yield "🤖 I'm currently experiencing technical difficulties with my AI backend. Please try again in a few minutes or contact support if this issue persists.";
        throw new Error(errorMessage);
    }

    try {
        console.log('[LLM] 🦙 Using Ollama local model...');
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

        if (!response.ok) throw new Error(`Ollama Error: ${response.statusText}`);
        
        const reader = response.body?.getReader();
        if (reader) {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split('\n').filter(line => line.trim() !== '');
                for (const line of lines) {
                    try {
                        const json = JSON.parse(line);
                        if (json.message?.content) yield json.message.content;
                        if (json.done) return;
                    } catch { /* ignore parse errors */ }
                }
            }
        }
    } catch (error) {
        console.error('[LLM] Ollama failed:', error);
        yield "🤖 Connection to local AI service failed. Please check your setup and try again.";
        throw error;
    }
}

/**
 * Non-streaming chat completion - SageMaker primary, Ollama fallback
 */
export async function chatCompletion(
    messages: ChatMessage[],
    model: string = DEFAULT_MODEL
): Promise<string> {
   if (isBedrockConfigured()) {
       return await invokeBedrockModel(messages);
   }

   // Fallback logic for non-streaming...
   if (isSageMakerConfigured()) {
       const prompt = formatChatML(messages);
       const response = await invokeSoulPrintModel({
           inputs: prompt,
           parameters: { max_new_tokens: 512 }
       });
       if (Array.isArray(response) && response[0]?.generated_text) {
           return response[0].generated_text;
       }
       return JSON.stringify(response);
   }

   const ollamaAvailable = await checkOllamaHealth();
   if (!ollamaAvailable) throw new Error("No LLM Available");

   const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
           model,
           messages,
           stream: false
       }),
   });
   const data = await response.json();
   return data.message?.content || "";
}

export async function checkHealth(): Promise<boolean> {
    if (isBedrockConfigured()) return true;
    if (isSageMakerConfigured()) return true;
    return checkOllamaHealth();
}
