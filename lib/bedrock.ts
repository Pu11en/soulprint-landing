/**
 * AWS Bedrock Client for Claude models
 * Shared utility for all LLM calls
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  ConverseCommand,
  ConverseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { bedrockEmbedResponseSchema } from '@/lib/api/schemas';

// Lazy initialization
let _client: BedrockRuntimeClient | null = null;

export function getBedrockClient(): BedrockRuntimeClient {
  if (!_client) {
    _client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _client;
}

// Available Claude models on Bedrock
export const CLAUDE_MODELS = {
  SONNET: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  HAIKU: 'anthropic.claude-3-5-haiku-20241022-v1:0',
  HAIKU_45: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  OPUS: 'anthropic.claude-3-opus-20240229-v1:0',
} as const;

export type ClaudeModel = keyof typeof CLAUDE_MODELS;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface BedrockChatOptions {
  model?: ClaudeModel;
  system?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

/**
 * Chat completion using Bedrock Converse API
 */
export async function bedrockChat(options: BedrockChatOptions): Promise<string> {
  const {
    model = 'SONNET',
    system,
    messages,
    maxTokens = 4096,
    temperature = 0.7,
  } = options;

  const client = getBedrockClient();
  const modelId = CLAUDE_MODELS[model];

  const command = new ConverseCommand({
    modelId,
    system: system ? [{ text: system }] : undefined,
    messages: messages.map(m => ({
      role: m.role,
      content: [{ text: m.content }],
    })),
    inferenceConfig: {
      maxTokens,
      temperature,
    },
  });

  const response = await client.send(command);
  
  const content = response.output?.message?.content;
  if (!content || content.length === 0) {
    throw new Error('No response from Bedrock');
  }

  // Extract text from content blocks
  const text = content
    .filter((block): block is { text: string } => 'text' in block)
    .map(block => block.text)
    .join('');

  return text;
}

/**
 * JSON completion - parses response as JSON
 * NOTE: The `as T` cast is deliberate for generic usage where callers provide the expected type.
 * This is a generic utility function that cannot validate specific types at runtime.
 */
export async function bedrockChatJSON<T = unknown>(
  options: BedrockChatOptions
): Promise<T> {
  const response = await bedrockChat(options);

  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = response.trim();

  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }

  jsonStr = jsonStr.trim();

  try {
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    console.error('Failed to parse JSON from Bedrock response:', response);
    throw new Error('Invalid JSON response from Bedrock');
  }
}

/**
 * Streaming chat completion using Bedrock ConverseStream API
 * Returns an async iterator of text chunks
 */
export async function* bedrockChatStream(
  options: BedrockChatOptions
): AsyncGenerator<string> {
  const {
    model = 'SONNET',
    system,
    messages,
    maxTokens = 4096,
    temperature = 0.7,
  } = options;

  const client = getBedrockClient();
  const modelId = CLAUDE_MODELS[model];

  const command = new ConverseStreamCommand({
    modelId,
    system: system ? [{ text: system }] : undefined,
    messages: messages.map(m => ({
      role: m.role,
      content: [{ text: m.content }],
    })),
    inferenceConfig: {
      maxTokens,
      temperature,
    },
  });

  const response = await client.send(command);
  
  if (!response.stream) {
    throw new Error('No stream in Bedrock response');
  }

  for await (const event of response.stream) {
    if (event.contentBlockDelta?.delta && 'text' in event.contentBlockDelta.delta) {
      yield event.contentBlockDelta.delta.text || '';
    }
  }
}

/**
 * Generate embedding using Titan v2
 */
export async function bedrockEmbed(text: string, dimensions = 768): Promise<number[]> {
  const client = getBedrockClient();

  // Truncate to safe limit
  const truncated = text.slice(0, 8000);

  const command = new InvokeModelCommand({
    modelId: 'amazon.titan-embed-text-v2:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      inputText: truncated,
      dimensions,
      normalize: true,
    }),
  });

  const response = await client.send(command);

  // Parse response as unknown first, then validate with Zod
  const rawResult: unknown = JSON.parse(new TextDecoder().decode(response.body));
  const validationResult = bedrockEmbedResponseSchema.safeParse(rawResult);

  if (!validationResult.success) {
    console.error('[bedrockEmbed] Invalid response from Bedrock:', validationResult.error.issues);
    throw new Error('Invalid embedding response from Bedrock');
  }

  return validationResult.data.embedding;
}
