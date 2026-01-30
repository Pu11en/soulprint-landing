/**
 * RLM Deep Personality Analysis API
 * Called during import to generate rich SoulPrint profile
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { analyzePersonality, type PersonalityProfile } from '@/lib/import/personality-analysis';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min for analysis

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

interface ConversationInput {
  title: string;
  messages: Array<{ role: string; content: string }>;
  createdAt: string;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { conversations } = body as { conversations: ConversationInput[] };

    if (!conversations || !Array.isArray(conversations)) {
      return NextResponse.json({ error: 'Conversations array required' }, { status: 400 });
    }

    console.log(`[PersonalityAnalysis] Starting for user ${user.id} with ${conversations.length} conversations`);

    // Convert to expected format
    const samples = conversations.map(c => ({
      title: c.title || 'Untitled',
      messages: c.messages || [],
      date: c.createdAt || new Date().toISOString(),
    }));

    // Run deep personality analysis
    const profile = await analyzePersonality(samples, (stage, percent) => {
      console.log(`[PersonalityAnalysis] ${stage} (${percent}%)`);
    });

    console.log(`[PersonalityAnalysis] Complete. Archetype: ${profile.identity.archetype}`);

    // Save to user profile
    const adminSupabase = getSupabaseAdmin();
    const { error: updateError } = await adminSupabase
      .from('user_profiles')
      .update({
        personality_profile: profile,
        soulprint_text: profile.soulMd,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[PersonalityAnalysis] Save error:', updateError);
      // Non-fatal - continue anyway
    }

    return NextResponse.json({
      success: true,
      profile: {
        identity: profile.identity,
        soul: profile.soul,
        interests: profile.interests,
        factsCount: profile.facts.length,
        relationshipsCount: profile.relationships.length,
      },
      soulMdPreview: profile.soulMd.slice(0, 500) + '...',
    });

  } catch (error) {
    console.error('[PersonalityAnalysis] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
