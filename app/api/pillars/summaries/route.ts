/**
 * POST /api/pillars/summaries
 * Generate pillar summaries from answers using Claude via AWS Bedrock
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { bedrockChatJSON } from '@/lib/bedrock';
import { PILLAR_NAMES, QUESTIONS, PillarSummary, CoreAlignment } from '@/lib/soulprint/types';
import { Mem0Client } from '@/lib/mem0';

export const maxDuration = 60;

interface PillarAnswerRow {
  question_index: number;
  pillar: number;
  question_type: string;
  slider_value: number | null;
  text_value: string | null;
}

function formatAnswersForPrompt(answers: PillarAnswerRow[]): string {
  const grouped: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  
  for (const answer of answers) {
    const question = QUESTIONS[answer.question_index];
    if (!question) continue;
    
    let formatted = `Q: ${question.prompt}\n`;
    if (answer.question_type === 'slider') {
      const value = answer.slider_value ?? 50;
      const leftLabel = question.leftLabel || 'Left';
      const rightLabel = question.rightLabel || 'Right';
      const position = value < 33 ? `Leans toward "${leftLabel}"` :
                       value > 66 ? `Leans toward "${rightLabel}"` :
                       'Balanced/Neutral';
      formatted += `A: ${position} (${value}/100)`;
    } else {
      formatted += `A: ${answer.text_value || 'No answer'}`;
    }
    
    grouped[answer.pillar].push(formatted);
  }
  
  return Object.entries(grouped)
    .map(([pillar, answers]) => {
      const pillarName = PILLAR_NAMES[parseInt(pillar) - 1];
      return `## ${pillarName}\n${answers.join('\n\n')}`;
    })
    .join('\n\n---\n\n');
}

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

    // Check if all 36 answers exist
    const { data: answers, error: fetchError } = await supabase
      .from('pillar_answers')
      .select('*')
      .eq('user_id', user.id)
      .order('question_index');

    if (fetchError || !answers) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch answers' },
        { status: 500 }
      );
    }

    if (answers.length < 36) {
      return NextResponse.json(
        { success: false, error: `Only ${answers.length}/36 questions answered. Complete all pillars first.` },
        { status: 400 }
      );
    }

    // Format answers for LLM
    const formattedAnswers = formatAnswersForPrompt(answers);

    console.log(`[Pillars Summaries] Generating for user ${user.id}...`);

    // Generate summaries with Claude via Bedrock
    const systemPrompt = `You are a psychological profiler for SoulPrint, an AI identity system. 
Your task is to analyze questionnaire responses and generate precise psychological summaries.

For each of the 6 pillars, write a 2-3 sentence summary in SECOND PERSON ("You are..." / "You tend to...") that captures:
1. The person's core trait in that domain
2. How it manifests in behavior
3. Any notable nuances or contradictions

Also extract three core alignment scores (0.0 to 1.0):
- Expression vs Restraint: 0 = very expressive, 1 = very restrained
- Instinct vs Analysis: 0 = gut-driven, 1 = analytical
- Autonomy vs Collaboration: 0 = independent, 1 = collaborative

Be specific, insightful, and avoid generic statements. This data will drive an AI's personality.

Respond in JSON format only.`;

    const userPrompt = `Analyze these SoulPrint questionnaire responses and generate psychological summaries:

${formattedAnswers}

Respond with this exact JSON structure:
{
  "summaries": {
    "communication": "...",
    "emotional": "...",
    "decision": "...",
    "social": "...",
    "cognitive": "...",
    "conflict": "..."
  },
  "coreAlignment": {
    "expressionVsRestraint": 0.0-1.0,
    "instinctVsAnalysis": 0.0-1.0,
    "autonomyVsCollaboration": 0.0-1.0
  }
}`;

    const parsed = await bedrockChatJSON<{
      summaries: PillarSummary;
      coreAlignment: CoreAlignment;
    }>({
      model: 'SONNET',
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.7,
    });

    // Validate response structure
    const requiredKeys = ['communication', 'emotional', 'decision', 'social', 'cognitive', 'conflict'];
    for (const key of requiredKeys) {
      if (!parsed.summaries[key as keyof PillarSummary]) {
        throw new Error(`Missing summary for ${key}`);
      }
    }

    // Store in database
    const { error: storeError } = await supabase
      .from('pillar_summaries')
      .upsert({
        user_id: user.id,
        communication_summary: parsed.summaries.communication,
        emotional_summary: parsed.summaries.emotional,
        decision_summary: parsed.summaries.decision,
        social_summary: parsed.summaries.social,
        cognitive_summary: parsed.summaries.cognitive,
        conflict_summary: parsed.summaries.conflict,
        expression_vs_restraint: parsed.coreAlignment.expressionVsRestraint,
        instinct_vs_analysis: parsed.coreAlignment.instinctVsAnalysis,
        autonomy_vs_collaboration: parsed.coreAlignment.autonomyVsCollaboration,
        raw_analysis: parsed,
        model_used: 'claude-3.5-sonnet-bedrock',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (storeError) {
      console.error('[Pillars Summaries] Store error:', storeError);
      throw new Error('Failed to store summaries');
    }

    // Also store summaries in Mem0 for chat retrieval
    const mem0ApiKey = process.env.MEM0_API_KEY;
    if (mem0ApiKey) {
      try {
        const client = new Mem0Client({ mode: 'cloud', apiKey: mem0ApiKey });
        
        // Store each pillar summary as a memory
        for (const [key, summary] of Object.entries(parsed.summaries)) {
          await client.add(
            [{ role: 'system', content: `User's ${key} profile: ${summary}` }],
            {
              userId: user.id,
              metadata: {
                type: 'pillar_summary',
                pillar: key,
                source: 'soulprint_pillars',
              },
            }
          );
        }
        console.log('[Pillars Summaries] Stored in Mem0');
      } catch (mem0Error) {
        console.error('[Pillars Summaries] Mem0 error (non-fatal):', mem0Error);
      }
    }

    console.log(`[Pillars Summaries] Generated for user ${user.id}`);

    return NextResponse.json({
      success: true,
      data: {
        summaries: parsed.summaries,
        coreAlignment: parsed.coreAlignment,
        modelUsed: 'claude-3.5-sonnet-bedrock',
      },
    });

  } catch (error) {
    console.error('[Pillars Summaries] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pillars/summaries
 * Fetch existing summaries
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

    const { data, error } = await supabase
      .from('pillar_summaries')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({
        success: true,
        data: { exists: false },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        exists: true,
        summaries: {
          communication: data.communication_summary,
          emotional: data.emotional_summary,
          decision: data.decision_summary,
          social: data.social_summary,
          cognitive: data.cognitive_summary,
          conflict: data.conflict_summary,
        },
        coreAlignment: {
          expressionVsRestraint: data.expression_vs_restraint,
          instinctVsAnalysis: data.instinct_vs_analysis,
          autonomyVsCollaboration: data.autonomy_vs_collaboration,
        },
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    });

  } catch (error) {
    console.error('[Pillars Summaries GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
