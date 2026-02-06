/**
 * AWS Bedrock Client for Claude models
 * Shared utility for all LLM calls
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';

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
