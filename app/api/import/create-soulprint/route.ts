/**
 * Create soulprint via RLM from conversation sample
 * Fast endpoint - only processes ~150 conversations
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { conversations, stats } = await request.json();

    if (!conversations || !Array.isArray(conversations)) {
      return NextResponse.json({ error: 'Conversations array required' }, { status: 400 });
    }

    const rlmUrl = process.env.RLM_SERVICE_URL;
    
    // Try RLM service first
    if (rlmUrl) {
      try {
        console.log(`[CreateSoulprint] Calling RLM for user ${user.id} with ${conversations.length} conversations`);
        
        const response = await fetch(`${rlmUrl}/create-soulprint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            conversations,
            stats,
          }),
          signal: AbortSignal.timeout(55000),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`[CreateSoulprint] RLM success - archetype: ${data.archetype}`);
          return NextResponse.json({
            success: true,
            soulprint: data.soulprint,
            archetype: data.archetype,
            method: 'rlm',
          });
        }
      } catch (rlmError) {
        console.warn('[CreateSoulprint] RLM failed:', rlmError);
      }
    }

    // Fallback: Generate basic soulprint from stats
    console.log('[CreateSoulprint] Using fallback soulprint generation');
    
    const soulprintText = generateBasicSoulprint(conversations, stats);
    
    return NextResponse.json({
      success: true,
      soulprint: {
        soulprintText,
        stats,
      },
      archetype: 'Unique Individual',
      method: 'fallback',
    });

  } catch (error) {
    console.error('[CreateSoulprint] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

function generateBasicSoulprint(conversations: any[], stats: any): string {
  const topics = new Map<string, number>();
  
  conversations.forEach(c => {
    const title = c.title?.toLowerCase() || '';
    const words = title.split(/\s+/).filter((w: string) => w.length > 4);
    words.forEach((w: string) => topics.set(w, (topics.get(w) || 0) + 1));
  });

  const topTopics = Array.from(topics.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic]) => topic);

  return `# Your SoulPrint

## Overview
- Total conversations: ${stats?.totalConversations || conversations.length}
- Total messages: ${stats?.totalMessages || 'Unknown'}
- Active period: ${stats?.activeDays || 'Unknown'} days

## Key Interests
${topTopics.map(t => `- ${t}`).join('\n')}

## Communication Style
Based on your conversation history, you engage deeply with topics and seek thorough understanding.

*This soulprint will evolve as you continue chatting.*`;
}
