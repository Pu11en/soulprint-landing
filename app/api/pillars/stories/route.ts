/**
 * POST /api/pillars/stories
 * Generate micro-stories for voice capture using Claude via AWS Bedrock
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { bedrockChat } from '@/lib/bedrock';
import { PILLAR_NAMES, MicroStory } from '@/lib/soulprint/types';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Auth
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Check if summaries exist
    const { data: summaries, error: fetchError } = await supabase
      .from('pillar_summaries')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (fetchError || !summaries) {
      return NextResponse.json(
        { success: false, error: 'Generate pillar summaries first (POST /api/pillars/summaries)' },
        { status: 400 }
      );
    }

    // Generate stories for each pillar
    const pillarSummariesMap: Record<string, string> = {
      communication: summaries.communication_summary,
      emotional: summaries.emotional_summary,
      decision: summaries.decision_summary,
      social: summaries.social_summary,
      cognitive: summaries.cognitive_summary,
      conflict: summaries.conflict_summary,
    };

    const systemPrompt = `You are a creative writer for SoulPrint. Your task is to generate short, evocative first-person micro-stories that embody a specific psychological trait.

Each story should be:
- 3-5 sentences long
- Written in first person ("I", "my", "me")
- Emotionally resonant with natural rhythm
- Include subtle pauses, emphasis points, and tempo shifts (for voice capture)
- Avoid clichés and generic statements
- Feel authentic and personal, not performative

The story will be read aloud by the user for voice cadence capture. It should feel natural to speak.

Just output the story text, nothing else. No quotes, no labels, just the story.`;

    console.log(`[Pillars Stories] Generating for user ${user.id}...`);

    const stories: MicroStory[] = [];
    const pillarKeys = ['communication', 'emotional', 'decision', 'social', 'cognitive', 'conflict'];

    for (let i = 0; i < pillarKeys.length; i++) {
      const pillarKey = pillarKeys[i];
      const pillarNum = i + 1;
      const pillarName = PILLAR_NAMES[i];
      const summary = pillarSummariesMap[pillarKey];

      const userPrompt = `Based on this psychological profile for ${pillarName}:

"${summary}"

Write a first-person micro-story (3-5 sentences) that embodies this trait. The story should capture a moment that reveals this aspect of their personality. Make it feel authentic and speakable.

Example format (but be creative):
"When [situation], I [response]. [Insight about self]. [Deeper reflection]."`;

      const storyText = await bedrockChat({
        model: 'SONNET',
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.8,
        maxTokens: 300,
      });

      const cleanedStory = storyText.trim().replace(/^["']|["']$/g, '');
      const wordCount = cleanedStory.split(/\s+/).length;

      stories.push({
        pillar: pillarNum,
        pillarName,
        storyText: cleanedStory,
        wordCount,
      });

      // Store in database
      await supabase
        .from('micro_stories')
        .upsert({
          user_id: user.id,
          pillar: pillarNum,
          pillar_name: pillarName,
          story_text: cleanedStory,
          word_count: wordCount,
          model_used: 'claude-3.5-sonnet-bedrock',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,pillar' });
    }

    console.log(`[Pillars Stories] Generated ${stories.length} stories for user ${user.id}`);

    return NextResponse.json({
      success: true,
      data: {
        stories,
        totalWordCount: stories.reduce((sum, s) => sum + s.wordCount, 0),
        modelUsed: 'claude-3.5-sonnet-bedrock',
      },
    });

  } catch (error) {
    console.error('[Pillars Stories] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pillars/stories
 * Fetch existing stories
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: stories, error } = await supabase
      .from('micro_stories')
      .select('*')
      .eq('user_id', user.id)
      .order('pillar');

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch stories' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        stories: stories?.map(s => ({
          pillar: s.pillar,
          pillarName: s.pillar_name,
          storyText: s.story_text,
          wordCount: s.word_count,
        })) || [],
        count: stories?.length || 0,
      },
    });

  } catch (error) {
    console.error('[Pillars Stories GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
