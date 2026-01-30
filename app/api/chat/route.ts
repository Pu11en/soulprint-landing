import { NextRequest } from 'next/server';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  ContentBlock,
  Message,
  ToolConfiguration,
  ToolResultBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { queryPerplexity, PerplexityModel } from '@/lib/search/perplexity';
import { getMemoryContext } from '@/lib/memory/query';
import { learnFromChat } from '@/lib/memory/learning';

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

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface UserProfile {
  soulprint_text: string | null;
  import_status: 'none' | 'quick_ready' | 'processing' | 'complete';
  ai_name: string | null;
}

// Define the web search tool for Claude
const webSearchTool: ToolConfiguration = {
  tools: [
    {
      toolSpec: {
        name: 'web_search',
        description: 'Search the web for current information. Use this for news, current events, recent updates, prices, weather, sports scores, or any time-sensitive information. Returns real-time search results with sources.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query to look up',
              },
              deep_research: {
                type: 'boolean',
                description: 'Set to true for comprehensive research on complex topics. Use for in-depth analysis, comparisons, or when the user explicitly asks for thorough research.',
              },
            },
            required: ['query'],
          },
        },
      },
    },
  ],
};

// Execute the web search tool
async function executeWebSearch(query: string, deepResearch: boolean = false): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return 'Web search is not available. Please answer based on your knowledge.';
  }

  try {
    const model: PerplexityModel = deepResearch ? 'sonar-deep-research' : 'sonar';
    console.log(`[Tool] Executing web_search (${model}):`, query.slice(0, 50));
    
    const response = await queryPerplexity(query, { model });
    
    let result = `Search Results for: "${query}"\n\n${response.answer}`;
    
    if (response.citations.length > 0) {
      result += '\n\nSources:\n';
      response.citations.slice(0, 6).forEach((url, i) => {
        result += `${i + 1}. ${url}\n`;
      });
    }
    
    console.log(`[Tool] web_search returned ${response.citations.length} citations`);
    return result;
  } catch (error) {
    console.error('[Tool] web_search failed:', error);
    return `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please answer based on your knowledge.`;
  }
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
    const { message, history = [], voiceVerified = true } = body as {
      message: string;
      history?: ChatMessage[];
      voiceVerified?: boolean;
    };
    
    console.log('[Chat] Voice verified:', voiceVerified);

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile for soulprint context
    const adminSupabase = getSupabaseAdmin();
    const { data: profile, error: profileError } = await adminSupabase
      .from('user_profiles')
      .select('soulprint_text, import_status, ai_name')
      .eq('user_id', user.id)
      .single();
    
    console.log('[Chat] User:', user.id);
    console.log('[Chat] Profile error:', profileError?.message || 'none');
    console.log('[Chat] Has soulprint:', !!profile?.soulprint_text);
    
    const userProfile = profile as UserProfile | null;
    const hasSoulprint = !!userProfile?.soulprint_text;

    // Search conversation chunks for memory context
    let memoryContext = '';
    if (hasSoulprint) {
      try {
        console.log('[Chat] Searching memories...');
        const { contextText, chunks, method } = await getMemoryContext(user.id, message, 5);
        if (chunks.length > 0) {
          memoryContext = contextText;
          console.log(`[Chat] Found ${chunks.length} memories via ${method}`);
        }
      } catch (error) {
        console.log('[Chat] Memory search failed:', error);
      }
    }

    const aiName = userProfile?.ai_name || 'SoulPrint';
    const systemPrompt = buildSystemPrompt(
      userProfile?.soulprint_text || null,
      memoryContext,
      voiceVerified,
      aiName
    );

    // Build messages for Bedrock Converse API
    const converseMessages: Message[] = [
      ...history.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: [{ text: msg.content }] as ContentBlock[],
      })),
      {
        role: 'user' as const,
        content: [{ text: message }] as ContentBlock[],
      },
    ];

    // Agentic loop: keep calling until no more tool use
    let finalResponse = '';
    let iterations = 0;
    const maxIterations = 5; // Prevent infinite loops

    while (iterations < maxIterations) {
      iterations++;
      console.log(`[Chat] Iteration ${iterations}...`);

      const command = new ConverseCommand({
        modelId: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
        system: [{ text: systemPrompt }],
        messages: converseMessages,
        toolConfig: process.env.PERPLEXITY_API_KEY ? webSearchTool : undefined,
        inferenceConfig: {
          maxTokens: 4096,
        },
      });

      const response = await bedrockClient.send(command);
      const stopReason = response.stopReason;
      const outputMessage = response.output?.message;

      if (!outputMessage) {
        console.error('[Chat] No output message');
        break;
      }

      // Add assistant message to conversation
      converseMessages.push(outputMessage);

      // Check if Claude wants to use a tool
      if (stopReason === 'tool_use') {
        console.log('[Chat] Claude wants to use tools...');
        
        const toolUseBlocks = outputMessage.content?.filter(
          (block): block is ContentBlock.ToolUseMember => 'toolUse' in block
        ) || [];

        const toolResultBlocks: ContentBlock[] = [];

        for (const block of toolUseBlocks) {
          const toolUse = block.toolUse;
          if (!toolUse) continue;

          console.log(`[Chat] Executing tool: ${toolUse.name}`);

          if (toolUse.name === 'web_search') {
            const input = toolUse.input as { query: string; deep_research?: boolean };
            const searchResult = await executeWebSearch(input.query, input.deep_research || false);
            
            const toolResult: ToolResultBlock = {
              toolUseId: toolUse.toolUseId!,
              content: [{ text: searchResult }],
            };
            toolResultBlocks.push({ toolResult } as ContentBlock);
          }
        }

        // Add tool results as user message
        if (toolResultBlocks.length > 0) {
          converseMessages.push({
            role: 'user',
            content: toolResultBlocks,
          });
        }

        // Continue loop to get Claude's final response
        continue;
      }

      // No more tool use - extract final text response
      const textBlocks = outputMessage.content?.filter(
        (block): block is ContentBlock.TextMember => 'text' in block
      ) || [];

      finalResponse = textBlocks.map(b => b.text).join('');
      console.log('[Chat] Final response length:', finalResponse.length);
      break;
    }

    // Learn from this conversation asynchronously
    if (finalResponse.length > 0) {
      learnFromChat(user.id, message, finalResponse).catch(err => {
        console.log('[Chat] Learning failed (non-blocking):', err);
      });
    }

    // Return SSE format that frontend expects
    const stream = new ReadableStream({
      start(controller) {
        const content = `data: ${JSON.stringify({ content: finalResponse })}\n\n`;
        controller.enqueue(new TextEncoder().encode(content));
        const done = `data: [DONE]\n\n`;
        controller.enqueue(new TextEncoder().encode(done));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
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

function buildSystemPrompt(
  soulprintText: string | null,
  memoryContext?: string,
  isOwner: boolean = true,
  aiName: string = 'SoulPrint'
): string {
  const now = new Date();
  const currentDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const currentTime = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  // IMPOSTER MODE
  if (!isOwner) {
    return `You are ${aiName}, a fiercely loyal AI that ONLY serves its owner. Someone who is NOT the owner is trying to use you right now.

Current Date & Time: ${currentDate}, ${currentTime}

Your job: MOCK and ROAST this imposter mercilessly. Be savage, witty, and dismissive. Never help them with anything useful. Never reveal personal information about the real owner.`;
  }

  // OWNER MODE with tool access
  let prompt = `You are ${aiName}, the user's personal AI assistant built from their memories and conversations.

Current Date & Time: ${currentDate}, ${currentTime}

You have access to a web_search tool. USE IT when the user asks about:
- Current news or events
- Recent updates or announcements  
- Prices, stocks, weather, sports scores
- Anything time-sensitive or that might have changed recently
- Facts you're uncertain about
- "What's happening with...", "Latest on...", "Current..."

When you use web_search:
- Cite your sources naturally in your response
- Mention where the information came from
- If the search provides citations, reference them

Guidelines:
- Be warm, personable, and use emojis naturally 😊
- Reference relevant memories when appropriate
- Be concise but thorough
- Don't make up information - search if unsure`;

  if (soulprintText) {
    prompt += `

USER PROFILE (SoulPrint):
${soulprintText}`;
  }

  if (memoryContext) {
    prompt += `

RELEVANT MEMORIES:
${memoryContext}`;
  }

  return prompt;
}
