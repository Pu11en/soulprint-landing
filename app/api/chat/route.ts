import { NextRequest } from 'next/server';
import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { createClient } from '@/lib/supabase/server';
import { getMemoryContext } from '@/lib/memory/query';

// Initialize Bedrock client
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await request.json();
    const { message, history = [] } = body as {
      message: string;
      history?: ChatMessage[];
    };

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Query memory for relevant context
    const { chunks, contextText } = await getMemoryContext(user.id, message, 3);
    const hasMemoryContext = chunks.length > 0;

    // Build system prompt with memory context
    const systemPrompt = buildSystemPrompt(contextText, hasMemoryContext);

    // Build conversation messages
    const messages = [
      ...history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user' as const,
        content: message,
      },
    ];

    // Create streaming response
    const command = new InvokeModelWithResponseStreamCommand({
      modelId: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4096,
        system: systemPrompt,
        messages,
      }),
    });

    const response = await bedrockClient.send(command);

    // Create a readable stream for the response
    const stream = new ReadableStream({
      async start(controller) {
        // Send metadata first (memory context indicator)
        const metadata = JSON.stringify({
          type: 'metadata',
          hasMemoryContext,
          memoryChunksUsed: chunks.length,
        }) + '\n';
        controller.enqueue(new TextEncoder().encode(metadata));

        try {
          if (response.body) {
            for await (const event of response.body) {
              if (event.chunk?.bytes) {
                const chunkData = JSON.parse(
                  new TextDecoder().decode(event.chunk.bytes)
                );
                
                if (chunkData.type === 'content_block_delta') {
                  const text = chunkData.delta?.text || '';
                  if (text) {
                    const data = JSON.stringify({ type: 'text', text }) + '\n';
                    controller.enqueue(new TextEncoder().encode(data));
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream error:', error);
          const errorData = JSON.stringify({ type: 'error', error: 'Stream failed' }) + '\n';
          controller.enqueue(new TextEncoder().encode(errorData));
        }

        // Signal completion
        const done = JSON.stringify({ type: 'done' }) + '\n';
        controller.enqueue(new TextEncoder().encode(done));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function buildSystemPrompt(contextText: string, hasContext: boolean): string {
  const basePrompt = `You are SoulPrint, an AI assistant with memory. You help users by providing personalized, contextual responses based on their conversation history and memories.

Be helpful, conversational, and natural. Remember that you have access to the user's memories and past conversations - use this context to give more relevant and personalized responses.

Guidelines:
- Be warm and personable
- Reference relevant memories naturally when appropriate
- Don't overwhelm with information - be concise
- If you don't have relevant context, just be helpful in the moment
- Never make up memories or context you don't have`;

  if (hasContext && contextText) {
    return `${basePrompt}

RELEVANT MEMORIES FROM USER'S HISTORY:
${contextText}

Use these memories to inform your response, but don't explicitly say "according to your memories" unless it's natural to do so. Weave the context into your response naturally.`;
  }

  return basePrompt;
}
