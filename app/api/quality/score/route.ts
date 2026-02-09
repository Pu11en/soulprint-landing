/**
 * Manual Quality Scoring Endpoint
 *
 * POST endpoint for manually triggering quality scoring on a profile.
 * Useful for dev/admin triggering and immediate feedback after profile edits.
 *
 * Phase 4: Quality Scoring - Manual trigger
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rate-limit';
import { calculateQualityBreakdown } from '@/lib/evaluation/quality-scoring';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userId = user.id;

    // Rate limit check (expensive tier - 20/min)
    const rateLimited = await checkRateLimit(userId, 'expensive');
    if (rateLimited) return rateLimited;

    // Parse request body (optional user_id parameter for admin use)
    const body = await request.json().catch(() => ({}));
    const targetUserId = body.user_id || userId;

    // For security, only allow scoring your own profile unless admin
    // (In future, could check for admin role here)
    if (targetUserId !== userId) {
      return NextResponse.json(
        { error: 'Can only score your own profile' },
        { status: 403 }
      );
    }

    const adminSupabase = getSupabaseAdmin();

    // Load profile
    const { data: profile, error: profileError } = await adminSupabase
      .from('user_profiles')
      .select('soul_md, identity_md, user_md, agents_md, tools_md')
      .eq('user_id', targetUserId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Calculate quality breakdown
    console.log(`[QualityScore] Scoring profile ${targetUserId}`);

    const qualityBreakdown = await calculateQualityBreakdown({
      soul_md: profile.soul_md,
      identity_md: profile.identity_md,
      user_md: profile.user_md,
      agents_md: profile.agents_md,
      tools_md: profile.tools_md,
    });

    const scoredAt = new Date().toISOString();

    // Save to database
    const { error: updateError } = await adminSupabase
      .from('user_profiles')
      .update({
        quality_breakdown: qualityBreakdown,
        quality_scored_at: scoredAt,
      })
      .eq('user_id', targetUserId);

    if (updateError) {
      console.error('[QualityScore] Failed to save scores:', updateError);
      return NextResponse.json(
        { error: 'Failed to save quality scores' },
        { status: 500 }
      );
    }

    console.log(`[QualityScore] Successfully scored profile ${targetUserId}`);

    return NextResponse.json({
      success: true,
      user_id: targetUserId,
      quality_breakdown: qualityBreakdown,
      scored_at: scoredAt,
    });

  } catch (error) {
    console.error('[QualityScore] Scoring failed:', error);
    return NextResponse.json(
      {
        error: 'Quality scoring failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
