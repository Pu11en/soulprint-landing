import { NextRequest, NextResponse } from 'next/server';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { handleAPIError } from '@/lib/api/error-handler';
import { parseRequestBody, generateTitleSchema } from '@/lib/api/schemas';
import { checkRateLimit } from '@/lib/rate-limit';

// Initialize Bedrock client
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// POST - Auto-generate conversation title from first exchange
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit check
    const rateLimited = await checkRateLimit(user.id, 'standard');
    if (rateLimited) return rateLimited;

    // Parse and validate request body
    const result = await parseRequestBody(request, generateTitleSchema);
    if (result instanceof Response) return result;
    const { userMessage, aiMessage } = result;

    // Extract conversation ID from route params
    const { id } = await params;

    const adminSupabase = getSupabaseAdmin();

    // Verify conversation belongs to user
    const { data: conversation, error: fetchError } = await adminSupabase
      .from('conversations')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Generate title using Bedrock Haiku (fast and cheap)
    let cleanedTitle: string;

    try {
      const command = new ConverseCommand({
        modelId: 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
        messages: [{
          role: 'user',
          content: [{
            text: `Summarize this conversation in 3-8 words for a sidebar title. Return ONLY the title, no quotes, no punctuation at the end, no explanation.

User: ${userMessage.slice(0, 300)}
Assistant: ${aiMessage.slice(0, 300)}`
          }],
        }],
        inferenceConfig: {
          maxTokens: 30,
          temperature: 0.3,
        },
      });

      const response = await bedrockClient.send(command);
      const titleText = response.output?.message?.content?.[0];

      if (titleText && 'text' in titleText && titleText.text) {
        // Clean title: remove quotes, trim, limit to 100 chars
        cleanedTitle = titleText.text
          .trim()
          .replace(/^["']|["']$/g, '') // Remove surrounding quotes
          .replace(/[.!?]+$/, '') // Remove trailing punctuation
          .slice(0, 100);
      } else {
        throw new Error('No text in Bedrock response');
      }
    } catch (error) {
      console.warn('[Conversations] Title generation failed, using fallback:', error);

      // Fallback: use first 5 words of user message + "..."
      const words = userMessage.trim().split(/\s+/).slice(0, 5);
      cleanedTitle = words.join(' ') + (words.length < userMessage.split(/\s+/).length ? '...' : '');
      cleanedTitle = cleanedTitle.slice(0, 100);
    }

    // Ensure we have a valid title
    if (!cleanedTitle || cleanedTitle.length === 0) {
      cleanedTitle = 'New Chat';
    }

    // Update conversation with generated title
    const { error: updateError } = await adminSupabase
      .from('conversations')
      .update({ title: cleanedTitle })
      .eq('id', id)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[Conversations] Title update error:', updateError);
      return NextResponse.json({ error: 'Failed to update title' }, { status: 500 });
    }

    return NextResponse.json({ title: cleanedTitle });

  } catch (error) {
    return handleAPIError(error, 'API:Conversations:Title:POST');
  }
}
