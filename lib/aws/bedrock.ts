import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  Message,
  SystemContentBlock
} from "@aws-sdk/client-bedrock-runtime";

const REGION = process.env.AWS_REGION || "us-east-1";

let _client: BedrockRuntimeClient | null = null;

function getClient() {
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

export async function invokeBedrockModel(messages: ChatMessage[]) {
  // Default to Llama 3 8B (Cost efficient)
  // Ensure you requested access to this model in AWS Bedrock Console
  const modelId = process.env.BEDROCK_MODEL_ID || "meta.llama3-8b-instruct-v1:0";

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

  try {
    const command = new ConverseCommand({
      modelId,
      messages: conversation,
      system: systemPrompts.length > 0 ? systemPrompts : undefined,
      inferenceConfig: {
        maxTokens: 512,
        temperature: 0.7,
        topP: 0.9,
      }
    });

    const response = await getClient().send(command);

    // Parse Response
    if (response.output?.message?.content?.[0]?.text) {
      return response.output.message.content[0].text;
    }
    
    return "";

  } catch (error) {
    console.error("AWS Bedrock Error:", error);
    throw error;
  }
}

/**
 * Stream responses from AWS Bedrock using ConverseStreamCommand.
 * Yields chunks of generated text as they arrive.
 */
export async function* invokeBedrockModelStream(
  messages: ChatMessage[]
): AsyncGenerator<string, void, unknown> {
  const modelId = process.env.BEDROCK_MODEL_ID || "meta.llama3-8b-instruct-v1:0";

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

  try {
    const command = new ConverseStreamCommand({
      modelId,
      messages: conversation,
      system: systemPrompts.length > 0 ? systemPrompts : undefined,
      inferenceConfig: {
        maxTokens: 512,
        temperature: 0.7,
        topP: 0.9,
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

  } catch (error) {
    console.error("AWS Bedrock Streaming Error:", error);
    throw error;
  }
}
