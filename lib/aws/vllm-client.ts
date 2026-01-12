/**
 * AWS vLLM Client
 * OpenAI-compatible client for self-hosted Qwen 2.5 72B on AWS
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const AWS_LLM_ENDPOINT = process.env.AWS_LLM_ENDPOINT || 'http://localhost:8000';
const AWS_LLM_API_KEY = process.env.AWS_LLM_API_KEY || 'sk-soulprint-internal';
const DEFAULT_MODEL = process.env.AWS_LLM_MODEL || 'Qwen/Qwen2.5-72B-Instruct';

/**
 * Check if AWS vLLM server is healthy
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${AWS_LLM_ENDPOINT}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch (error) {
    console.warn('AWS vLLM health check failed:', error);
    return false;
  }
}

/**
 * Get available models from vLLM server
 */
export async function listModels(): Promise<string[]> {
  try {
    const response = await fetch(`${AWS_LLM_ENDPOINT}/v1/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AWS_LLM_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`);
    }

    const data = await response.json();
    return data.data.map((m: { id: string }) => m.id);
  } catch (error) {
    console.error('Failed to list models:', error);
    return [];
  }
}

/**
 * Non-streaming chat completion
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<string> {
  const {
    model = DEFAULT_MODEL,
    temperature = 0.7,
    max_tokens = 4096,
    top_p = 0.9,
    frequency_penalty = 0,
    presence_penalty = 0,
  } = options;

  const response = await fetch(`${AWS_LLM_ENDPOINT}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AWS_LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
      top_p,
      frequency_penalty,
      presence_penalty,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AWS vLLM error: ${response.status} - ${error}`);
  }

  const data: ChatCompletionResponse = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Streaming chat completion
 */
export async function* streamChatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): AsyncGenerator<string, void, unknown> {
  const {
    model = DEFAULT_MODEL,
    temperature = 0.7,
    max_tokens = 4096,
    top_p = 0.9,
    frequency_penalty = 0,
    presence_penalty = 0,
  } = options;

  const response = await fetch(`${AWS_LLM_ENDPOINT}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AWS_LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
      top_p,
      frequency_penalty,
      presence_penalty,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AWS vLLM stream error: ${response.status} - ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Chat completion with full response object
 */
export async function chatCompletionFull(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResponse> {
  const {
    model = DEFAULT_MODEL,
    temperature = 0.7,
    max_tokens = 4096,
    top_p = 0.9,
    frequency_penalty = 0,
    presence_penalty = 0,
  } = options;

  const response = await fetch(`${AWS_LLM_ENDPOINT}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AWS_LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
      top_p,
      frequency_penalty,
      presence_penalty,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AWS vLLM error: ${response.status} - ${error}`);
  }

  return response.json();
}
