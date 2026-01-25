import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  Message,
  SystemContentBlock
} from "@aws-sdk/client-bedrock-runtime";

const REGION = process.env.AWS_REGION || "us-east-1";

let _client: BedrockRuntimeClient | null = null;
let _lastConnectionError: number | null = null;
const CONNECTION_RESET_WINDOW = 30000; // 30 seconds

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mark connection as errored - will force client reset on next call
 */
export function markConnectionError() {
  _lastConnectionError = Date.now();
}

function getClient() {
  // Reset client if recent connection error (within 30s)
  if (_lastConnectionError && Date.now() - _lastConnectionError < CONNECTION_RESET_WINDOW) {
    console.log("[Bedrock] Resetting client due to recent connection error");
    _client = null;
    _lastConnectionError = null;
  }

  if (!_client) {
    _client = new BedrockRuntimeClient({
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
        sessionToken: process.env.AWS_SESSION_TOKEN || undefined,
      },
    });
  }
  return _client;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function invokeBedrockModel(
  messages: ChatMessage[],
  options?: { maxRetries?: number; initialDelay?: number }
): Promise<string> {
  // Default to Claude 3.5 Haiku (Fast & high quality)
  // Ensure you requested access to this model in AWS Bedrock Console
  const modelId = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-3-5-haiku-20241022-v1:0";
  const maxRetries = options?.maxRetries ?? 5;
  const initialDelay = options?.initialDelay ?? 1000;

  // 1. Separate System Prompt
  const systemPrompts: SystemContentBlock[] = messages
    .filter(m => m.role === 'system')
    .map(m => ({ text: m.content }));

  // 2. Format Conversation for Bedrock
  const conversation: Message[] = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: [{ text: m.content }]
    }));

  // Retry loop for throttling
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const command = new ConverseCommand({
        modelId,
        messages: conversation,
        system: systemPrompts.length > 0 ? systemPrompts : undefined,
        inferenceConfig: {
          maxTokens: 2048,
          temperature: 0.7,
        }
      });

      const response = await getClient().send(command);

      // Parse Response
      if (response.output?.message?.content?.[0]?.text) {
        return response.output.message.content[0].text;
      }

      return "";

    } catch (error: unknown) {
      const isThrottling = error instanceof Error &&
        (error.name === 'ThrottlingException' ||
         error.message.includes('Too many requests') ||
         error.message.includes('throttl'));

      if (isThrottling && attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`[Bedrock Chat] Throttled, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(delay);
        continue;
      }

      console.error("AWS Bedrock Error:", error);
      markConnectionError(); // Reset client on next call
      throw error;
    }
  }

  return "";
}

/**
 * Stream responses from AWS Bedrock using ConverseStreamCommand.
 * Yields chunks of generated text as they arrive.
 * Includes retry logic with exponential backoff for throttling.
 */
export async function* invokeBedrockModelStream(
  messages: ChatMessage[],
  options?: { maxRetries?: number; initialDelay?: number }
): AsyncGenerator<string, void, unknown> {
  const modelId = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-3-5-haiku-20241022-v1:0";
  const maxRetries = options?.maxRetries ?? 5;
  const initialDelay = options?.initialDelay ?? 1000;

  // 1. Separate System Prompt
  const systemPrompts: SystemContentBlock[] = messages
    .filter(m => m.role === 'system')
    .map(m => ({ text: m.content }));

  // 2. Format Conversation for Bedrock
  const conversation: Message[] = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: [{ text: m.content }]
    }));

  // Retry loop for throttling
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const command = new ConverseStreamCommand({
        modelId,
        messages: conversation,
        system: systemPrompts.length > 0 ? systemPrompts : undefined,
        inferenceConfig: {
          maxTokens: 2048,
          temperature: 0.7,
        }
      });

      const response = await getClient().send(command);

      if (!response.stream) {
        throw new Error("No stream returned from Bedrock");
      }

      // Process the stream
      for await (const event of response.stream) {
        // contentBlockDelta contains the streaming text chunks
        if (event.contentBlockDelta?.delta?.text) {
          yield event.contentBlockDelta.delta.text;
        }
      }

      // Success - exit the retry loop
      return;

    } catch (error: unknown) {
      const isThrottling = error instanceof Error &&
        (error.name === 'ThrottlingException' ||
         error.message.includes('Too many requests') ||
         error.message.includes('throttl'));

      if (isThrottling && attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`[Bedrock Chat] Throttled, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(delay);
        continue;
      }

      console.error("AWS Bedrock Streaming Error:", error);
      markConnectionError(); // Reset client on next call
      throw error;
    }
  }
}
