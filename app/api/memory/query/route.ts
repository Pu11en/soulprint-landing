import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { invokeBedrockModel } from '@/lib/aws/bedrock';

// Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MEMORY_EXTRACTION_PROMPT = `You are a memory extraction agent. Your task is to find information in a user's conversation history that is relevant to their query.

USER QUERY: {query}

CONVERSATION HISTORY:
{history}

---

Analyze the history and extract ALL relevant information. Consider:
1. Direct mentions of the query topic
2. Related topics and context
3. Patterns and recurring themes

Respond with a JSON object in this EXACT format:
{
    "relevant_memories": [
        {"content": "exact relevant quote or summary", "significance": "high/medium/low", "context": "why this is relevant"}
    ],
    "patterns_detected": ["list of patterns you noticed"],
    "user_context": "brief summary of what this reveals about the user"
}

Return ONLY valid JSON. No other text.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, query, history, max_results = 10 } = body;

    if (!user_id || !query) {
      return NextResponse.json(
        { error: 'user_id and query required' },
        { status: 400 }
      );
    }

    // Get history if not provided
    let historyText = history;
    if (!historyText) {
      historyText = await getUserHistory(user_id, 100);
    }

    // Truncate history if too long (keep under 50k chars)
    if (historyText.length > 50000) {
      historyText = historyText.substring(0, 50000);
    }

    // Build prompt
    const prompt = MEMORY_EXTRACTION_PROMPT
      .replace('{query}', query)
      .replace('{history}', historyText);

    console.log(`[Memory] Query: "${query.substring(0, 50)}..."`);

    // Call Bedrock
    const response = await invokeBedrockModel([
      { role: 'user', content: prompt }
    ]);

    console.log(`[Memory] Response: ${response.substring(0, 100)}...`);

    // Parse JSON response
    try {
      const start = response.indexOf('{');
      const end = response.lastIndexOf('}') + 1;
      if (start >= 0 && end > start) {
        const parsed = JSON.parse(response.substring(start, end));
        return NextResponse.json({
          relevant_memories: parsed.relevant_memories || [],
          patterns_detected: parsed.patterns_detected || [],
          user_context: parsed.user_context || '',
          success: true,
        });
      }
    } catch (parseError) {
      console.warn('[Memory] JSON parse error:', parseError);
    }

    // Fallback - return raw response
    return NextResponse.json({
      relevant_memories: [{ content: response, significance: 'unknown' }],
      patterns_detected: [],
      user_context: '',
      success: true,
    });

  } catch (error) {
    console.error('[Memory] Error:', error);
    return NextResponse.json({
      relevant_memories: [],
      patterns_detected: [],
      user_context: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

async function getUserHistory(userId: string, limit: number): Promise<string> {
  let history = '';

  // Get imported chats
  const { data: imported } = await supabaseAdmin
    .from('imported_chats')
    .select('role, content')
    .eq('user_id', userId)
    .order('original_timestamp', { ascending: false })
    .limit(limit);

  if (imported && imported.length > 0) {
    history += '=== IMPORTED HISTORY ===\n';
    for (const msg of imported.reverse()) {
      history += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
    }
  }

  // Get native chats
  const { data: native } = await supabaseAdmin
    .from('chat_logs')
    .select('role, content')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (native && native.length > 0) {
    history += '\n=== RECENT CONVERSATIONS ===\n';
    for (const msg of native.reverse()) {
      history += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
    }
  }

  return history || 'No conversation history available.';
}

// Health check
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'memory-api' });
}
