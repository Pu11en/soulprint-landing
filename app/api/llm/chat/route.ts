import { NextRequest, NextResponse } from 'next/server';
import { invokeSageMaker, checkEndpointStatus, ChatMessage } from '@/lib/aws/sagemaker';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, temperature, max_tokens } = body as {
      messages: ChatMessage[];
      temperature?: number;
      max_tokens?: number;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'messages array is required' },
        { status: 400 }
      );
    }

    // Invoke SageMaker endpoint
    const responseText = await invokeSageMaker(messages, {
      temperature: temperature ?? 0.7,
      maxTokens: max_tokens ?? 512,
    });

    // Return response in OpenAI-compatible format
    return NextResponse.json({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'hermes-2-pro-llama-3-8b',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: responseText,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    });
  } catch (error: any) {
    console.error('LLM chat error:', error);

    // Check if endpoint is not running
    if (error.name === 'ValidationException' || error.message?.includes('endpoint')) {
      const status = await checkEndpointStatus().catch(() => ({ status: 'Unknown', isReady: false }));

      return NextResponse.json(
        {
          error: 'SageMaker endpoint not available',
          endpoint_status: status.status,
          details: 'The LLM endpoint may not be deployed. Deploy it first using the deployment script.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to generate response',
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check status
export async function GET() {
  try {
    const status = await checkEndpointStatus();
    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to check endpoint status' },
      { status: 500 }
    );
  }
}
