import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 300;

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Lazy init to avoid build-time errors
let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

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
  
  // All relevant idea channels
  const ALL_CHANNELS = [
    { id: 'C0A69GZEZC4', name: 'future-ideas' },
    { id: 'C09SSD56JAE', name: 'soulprint-creation' },
    { id: 'C0A9YC6TGQL', name: 'ai-alter-ego-chats' },
    { id: 'C0A76QJM5RV', name: 'comic-book' },
    { id: 'C0A1QLWV080', name: 'offline-soulprint' },
    { id: 'C09SKBA5WCB', name: 'all-archeforge' },
    { id: 'C0A800RV0GY', name: 'vestaboard' },
    { id: 'C0AB5G7FSVA', name: 'soulprint-critique2' },
  ];
  
  const channelIds = body.channelId ? [body.channelId] : ALL_CHANNELS.map(c => c.id);
  const limit = body.limit || 50;

  if (!SLACK_BOT_TOKEN) {
    return NextResponse.json({ error: 'Slack bot token not configured' }, { status: 500 });
  }

  try {
    // Fetch messages from ALL channels
    let allMessages: (SlackMessage & { channel: string })[] = [];
    const channelResults: { channel: string; count: number; error?: string }[] = [];

    for (const channelId of channelIds) {
      console.log(`🔍 [Blueprint Extract] Fetching messages from channel ${channelId}...`);
      try {
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
          console.log(`⚠️ [Blueprint Extract] Channel ${channelId} error: ${slackData.error}`);
          channelResults.push({ channel: channelId, count: 0, error: slackData.error });
          continue;
        }

        const channelMessages = (slackData.messages || []).map((m: SlackMessage) => ({
          ...m,
          channel: channelId,
        }));
        allMessages = allMessages.concat(channelMessages);
        channelResults.push({ channel: channelId, count: channelMessages.length });
      } catch (err) {
        console.error(`Error fetching channel ${channelId}:`, err);
        channelResults.push({ channel: channelId, count: 0, error: 'fetch_error' });
      }
    }

    const messages = allMessages;
    console.log(`🔍 [Blueprint Extract] Found ${messages.length} total messages from ${channelIds.length} channels`);

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

    const aiResponse = await getOpenAI().chat.completions.create({
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
      source_url: `https://archeforgeworkspace.slack.com/`,
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

      // Post summary back to Slack
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://soulprint.vercel.app';
      const summaryMessage = `🔍 *Extracted ${data.length} ideas* from this channel!\n\nView & rank them: ${siteUrl}/blueprints\n\nTop ideas:\n${data.slice(0, 3).map((b: any, i: number) => `${i + 1}. *${b.title}* (score: ${b.impact_score * b.feasibility_score})`).join('\n')}`;
      
      // Post to first accessible channel
      const firstChannel = channelResults.find(c => !c.error)?.channel;
      if (firstChannel) {
        try {
          await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              channel: firstChannel,
              text: summaryMessage,
            }),
          });
          console.log(`🔍 [Blueprint Extract] Posted summary to ${firstChannel}`);
        } catch (err) {
          console.error('Failed to post to Slack:', err);
        }
      }

      return NextResponse.json({
        success: true,
        extracted: data.length,
        blueprints: data,
        channelsScanned: channelResults,
      });
    }

    return NextResponse.json({
      success: true,
      extracted: 0,
      message: 'No valid ideas extracted',
      channelsScanned: channelResults,
    });

  } catch (error) {
    console.error('Blueprint extraction error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
