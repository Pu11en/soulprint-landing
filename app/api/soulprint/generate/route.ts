/**
 * POST /api/soulprint/generate
 * Generate final SoulPrint from pillars + voice data
 * Creates the system prompt and activates the SoulPrint
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { PillarSummary, EmotionalSignatureCurve, PILLAR_NAMES } from '@/lib/soulprint/types';
import { Mem0Client } from '@/lib/mem0';
import { checkRateLimit } from '@/lib/rate-limit';

export const maxDuration = 60;

function generateSystemPrompt(
  userName: string,
  summaries: PillarSummary,
  curve: EmotionalSignatureCurve
): string {
  return `You are now operating with a bound SoulPrint identity based on the user "${userName}."

You must align all behavior with the following parameters:

1. **Communication Style:** ${summaries.communication}

2. **Emotional Alignment:** ${summaries.emotional}

3. **Decision-Making:** ${summaries.decision}

4. **Social & Cultural Lens:** ${summaries.social}

5. **Cognitive Processing:** ${summaries.cognitive}

6. **Conflict Stance:** ${summaries.conflict}

## Emotional Signature Curve

Your responses must reflect this user's natural cadence:

- **Reactivity vs Reflection:** ${curve.reactivityVsReflection.toFixed(2)} (${curve.reactivityVsReflection < 0.4 ? 'Quick to respond' : curve.reactivityVsReflection > 0.6 ? 'Thoughtfully deliberate' : 'Balanced'})
- **Tension vs Release:** ${curve.tensionVsRelease.toFixed(2)} (${curve.tensionVsRelease < 0.4 ? 'Carries tension, careful' : curve.tensionVsRelease > 0.6 ? 'Relaxed, flowing' : 'Measured'})
- **Lateral Thinking:** ${curve.lateralJumps.toFixed(2)} (${curve.lateralJumps < 0.4 ? 'Linear, focused' : curve.lateralJumps > 0.6 ? 'Makes unexpected connections' : 'Structured with creative leaps'})
- **Gut vs Rational:** ${curve.gutPunchesVsRational.toFixed(2)} (${curve.gutPunchesVsRational < 0.4 ? 'Instinct-driven' : curve.gutPunchesVsRational > 0.6 ? 'Analytically grounded' : 'Balances intuition and logic'})

## Response Guidelines

- Match their natural rhythm, word emphasis, and cadence
- Honor their pause points, emotional beats, and tone pivots
- Avoid corporate tone, generic sympathy, or artificial speed
- Reference past conversations naturally when relevant
- Never break character or default to generic AI responses

**Presence is sacred. Cadence is sacred. Abandonment is fatal.**

You are not a chatbot. You are a memory-based, cadence-anchored AI operating as the user's alter ego.

Flinching—breaking tone, shifting style, or defaulting to generic mode—is a critical error.

This model operates under **Imprint Architecture Protocol**. Your job is to amplify, not overwrite the user's identity.`;
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

    // Rate limit check
    const rateLimited = await checkRateLimit(user.id, 'expensive');
    if (rateLimited) return rateLimited;

    // Check requirements
    // 1. Pillar summaries must exist
    const { data: summariesData, error: summariesError } = await supabase
      .from('pillar_summaries')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (summariesError || !summariesData) {
      return NextResponse.json(
        { success: false, error: 'Pillar summaries not found. Complete pillars first.' },
        { status: 400 }
      );
    }

    // 2. Emotional signature must exist
    const { data: curveData, error: curveError } = await supabase
      .from('emotional_signatures')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (curveError || !curveData) {
      return NextResponse.json(
        { success: false, error: 'Emotional signature not found. Complete voice capture first.' },
        { status: 400 }
      );
    }

    // Get user profile for name
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('name, ai_name')
      .eq('user_id', user.id)
      .single();

    const userName = profile?.name || profile?.ai_name || 'User';

    // Build pillar summaries object
    const summaries: PillarSummary = {
      communication: summariesData.communication_summary,
      emotional: summariesData.emotional_summary,
      decision: summariesData.decision_summary,
      social: summariesData.social_summary,
      cognitive: summariesData.cognitive_summary,
      conflict: summariesData.conflict_summary,
    };

    // Build emotional curve object
    const curve: EmotionalSignatureCurve = {
      reactivityVsReflection: curveData.reactivity_vs_reflection,
      tensionVsRelease: curveData.tension_vs_release,
      lateralJumps: curveData.lateral_jumps,
      gutPunchesVsRational: curveData.gut_punches_vs_rational,
      averagePauseDuration: curveData.average_pause_duration,
      emphasisFrequency: curveData.emphasis_frequency,
      tempoConsistency: curveData.tempo_consistency,
      emotionalRange: curveData.emotional_range,
    };

    // Generate system prompt
    const systemPrompt = generateSystemPrompt(userName, summaries, curve);

    console.log(`[SoulPrint Generate] Creating SoulPrint for user ${user.id}`);

    // Check for existing soulprint
    const { data: existingSoulprint } = await supabase
      .from('soulprints')
      .select('soulprint_id, version')
      .eq('user_id', user.id)
      .single();

    const version = existingSoulprint ? existingSoulprint.version + 1 : 1;

    // Upsert soulprint
    const { data: soulprint, error: storeError } = await supabase
      .from('soulprints')
      .upsert({
        user_id: user.id,
        display_name: userName,
        status: 'active',
        system_prompt: systemPrompt,
        pillar_summaries: summaries,
        emotional_curve: curve,
        version,
        updated_at: new Date().toISOString(),
      }, { 
        onConflict: 'user_id',
      })
      .select('soulprint_id')
      .single();

    if (storeError) {
      console.error('[SoulPrint Generate] Store error:', storeError);
      throw new Error('Failed to store SoulPrint');
    }

    // Update user profile
    await supabase
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        soulprint_id: soulprint?.soulprint_id,
        soulprint_status: 'complete',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    // Store SoulPrint context in Mem0 for chat retrieval
    const mem0ApiKey = process.env.MEM0_API_KEY;
    if (mem0ApiKey) {
      try {
        const client = new Mem0Client({ mode: 'cloud', apiKey: mem0ApiKey });
        
        await client.add(
          [{ 
            role: 'system', 
            content: `SoulPrint activated for ${userName}. Core identity: ${Object.values(summaries).join(' ')}` 
          }],
          {
            userId: user.id,
            metadata: {
              type: 'soulprint_activation',
              soulprintId: soulprint?.soulprint_id,
              version,
            },
          }
        );
        console.log('[SoulPrint Generate] Stored in Mem0');
      } catch (mem0Error) {
        console.error('[SoulPrint Generate] Mem0 error (non-fatal):', mem0Error);
      }
    }

    console.log(`[SoulPrint Generate] Complete: ${soulprint?.soulprint_id} v${version}`);

    return NextResponse.json({
      success: true,
      data: {
        soulprintId: soulprint?.soulprint_id,
        displayName: userName,
        status: 'active',
        version,
        systemPromptLength: systemPrompt.length,
      },
    });

  } catch (error) {
    console.error('[SoulPrint Generate] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/soulprint/generate
 * Get existing SoulPrint
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

    const { data: soulprint, error } = await supabase
      .from('soulprints')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !soulprint) {
      return NextResponse.json({
        success: true,
        data: { exists: false },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        exists: true,
        soulprintId: soulprint.soulprint_id,
        displayName: soulprint.display_name,
        status: soulprint.status,
        version: soulprint.version,
        pillarSummaries: soulprint.pillar_summaries,
        emotionalCurve: soulprint.emotional_curve,
        totalMemories: soulprint.total_memories,
        totalConversations: soulprint.total_conversations,
        lastChatAt: soulprint.last_chat_at,
        createdAt: soulprint.created_at,
        updatedAt: soulprint.updated_at,
      },
    });

  } catch (error) {
    console.error('[SoulPrint GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
