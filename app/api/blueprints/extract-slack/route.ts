import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 300;

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;

interface SlackMessage {
  ts: string;
  text: string;
  user: string;
  type: string;
}

interface ExtractedIdea {
  title: string;
  description: string;
  category: string;
  impact_score: number;
  feasibility_score: number;
  effort_estimate: string;
  tags: string[];
}

/**
 * POST /api/blueprints/extract-slack
 * Extract ideas from a Slack channel and convert to blueprints
 */
export async function POST(request: NextRequest) {
  console.log('🔍 [Blueprint Extract] Starting Slack extraction...');

  // Verify cron secret or admin access
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const channelId = body.channelId || 'C0A69GZEZC4'; // Default to #future-ideas
  const limit = body.limit || 100;

  if (!SLACK_BOT_TOKEN) {
    return NextResponse.json({ error: 'Slack bot token not configured' }, { status: 500 });
  }

  try {
    // Fetch messages from Slack
    console.log(`🔍 [Blueprint Extract] Fetching messages from channel ${channelId}...`);
    const slackResponse = await fetch(
      `https://slack.com/api/conversations.history?channel=${channelId}&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        },
      }
    );

    const slackData = await slackResponse.json();
    
    if (!slackData.ok) {
      return NextResponse.json({ error: `Slack API error: ${slackData.error}` }, { status: 500 });
    }

    const messages: SlackMessage[] = slackData.messages || [];
    console.log(`🔍 [Blueprint Extract] Found ${messages.length} messages`);

    // Filter out bot messages and very short messages
    const ideaMessages = messages.filter(
      m => m.type === 'message' && !m.user?.startsWith('B') && m.text?.length > 20
    );

    if (ideaMessages.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No idea messages found',
        extracted: 0 
      });
    }

    // Get user info for attribution
    const userIds = [...new Set(ideaMessages.map(m => m.user))];
    const userMap: Record<string, string> = {};
    
    for (const userId of userIds) {
      try {
        const userResponse = await fetch(
          `https://slack.com/api/users.info?user=${userId}`,
          {
            headers: { 'Authorization': `Bearer ${SLACK_BOT_TOKEN}` },
          }
        );
        const userData = await userResponse.json();
        if (userData.ok && userData.user) {
          userMap[userId] = userData.user.real_name || userData.user.name || userId;
        }
      } catch {
        userMap[userId] = userId;
      }
    }

    // Use AI to extract and structure ideas
    console.log('🔍 [Blueprint Extract] Analyzing messages with AI...');
    
    const messagesText = ideaMessages.map((m, i) => 
      `[${i + 1}] @${userMap[m.user] || m.user}: ${m.text}`
    ).join('\n\n');

    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an idea analyst for a startup. Extract distinct product/feature ideas from Slack messages.

For each idea, provide:
- title: Short, catchy name (3-6 words)
- description: Clear explanation (1-2 sentences)  
- category: One of: product, feature, marketing, infrastructure, content
- impact_score: 1-10 (potential value/revenue impact)
- feasibility_score: 1-10 (how easy to build)
- effort_estimate: hours, days, weeks, or months
- tags: Array of relevant keywords

Return valid JSON array. Skip casual chat, questions without ideas, and duplicates.
Focus on actionable product/business ideas.`
        },
        {
          role: 'user',
          content: `Extract ideas from these Slack messages:\n\n${messagesText}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const aiContent = aiResponse.choices[0]?.message?.content || '{"ideas":[]}';
    let extractedIdeas: ExtractedIdea[] = [];
    
    try {
      const parsed = JSON.parse(aiContent);
      extractedIdeas = parsed.ideas || parsed || [];
    } catch {
      console.error('Failed to parse AI response:', aiContent);
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    console.log(`🔍 [Blueprint Extract] AI extracted ${extractedIdeas.length} ideas`);

    // Convert to blueprints and save
    const blueprints = extractedIdeas.map((idea) => ({
      title: idea.title,
      description: idea.description,
      category: idea.category,
      impact_score: idea.impact_score,
      feasibility_score: idea.feasibility_score,
      effort_estimate: idea.effort_estimate,
      tags: idea.tags,
      status: 'idea',
      source_type: 'slack',
      source_url: `https://slack.com/archives/${channelId}`,
    }));

    if (blueprints.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('blueprints')
        .insert(blueprints)
        .select();

      if (error) {
        console.error('Error saving blueprints:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log(`🔍 [Blueprint Extract] Saved ${data.length} blueprints`);

      return NextResponse.json({
        success: true,
        extracted: data.length,
        blueprints: data,
      });
    }

    return NextResponse.json({
      success: true,
      extracted: 0,
      message: 'No valid ideas extracted',
    });

  } catch (error) {
    console.error('Blueprint extraction error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
