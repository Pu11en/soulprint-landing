/**
 * Generate soulprint for a user from their conversation chunks
 * Can be called:
 * 1. After import completes
 * 2. Via cron to process pending users
 * 3. Manually to regenerate
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 min - RLM can take ~40s

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  const adminSupabase = getSupabaseAdmin();
  
  try {
    // Get user from auth or header
    let userId: string;
    const internalUserId = request.headers.get('X-Internal-User-Id');
    
    if (internalUserId) {
      userId = internalUserId;
    } else {
      const supabase = await createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = user.id;
    }

    // Get conversation chunks for this user
    const { data: chunks, error: chunksError } = await adminSupabase
      .from('conversation_chunks')
      .select('title, content, message_count, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50); // Recent 50 for soulprint analysis

    if (chunksError || !chunks || chunks.length === 0) {
      return NextResponse.json({ 
        error: 'No conversation data found',
        details: chunksError?.message 
      }, { status: 400 });
    }

    // Get stats
    const { data: profile } = await adminSupabase
      .from('user_profiles')
      .select('total_conversations, total_messages')
      .eq('user_id', userId)
      .single();

    const stats = {
      totalMessages: profile?.total_messages || chunks.reduce((sum, c) => sum + (c.message_count || 0), 0),
      totalConversations: profile?.total_conversations || chunks.length,
    };

    // Format conversations for RLM
    const conversations = chunks.map(c => ({
      title: c.title,
      messages: [{ role: 'user', content: (c.content || '').slice(0, 500) }],
      message_count: c.message_count,
      createdAt: c.created_at,
    }));

    // Call RLM
    const rlmUrl = process.env.RLM_SERVICE_URL || 'https://soulprint-landing.onrender.com';
    console.log(`[GenerateSoulprint] Calling RLM for user ${userId} with ${conversations.length} conversations`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout

    const rlmResponse = await fetch(`${rlmUrl}/create-soulprint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        conversations,
        stats,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!rlmResponse.ok) {
      const errorText = await rlmResponse.text();
      console.error(`[GenerateSoulprint] RLM error: ${rlmResponse.status}`, errorText);
      return NextResponse.json({ 
        error: 'Soulprint generation failed',
        details: errorText 
      }, { status: 500 });
    }

    const rlmData = await rlmResponse.json();
    console.log(`[GenerateSoulprint] RLM returned archetype: ${rlmData.archetype}`);

    // RLM returns structured soulprint object
    const soulprint = rlmData.soulprint;
    const archetype = rlmData.archetype || soulprint?.archetype || 'Unique Individual';

    if (!soulprint) {
      console.error('[GenerateSoulprint] No soulprint in RLM response:', rlmData);
      return NextResponse.json({
        error: 'Invalid soulprint response',
        details: 'No soulprint object'
      }, { status: 500 });
    }

    // Use core_essence as soulprint_text for display, fallback to archetype
    const soulprintText = soulprint.core_essence || archetype;

    // Extract SoulPrint files from RLM response
    const soulMd = rlmData.soul_md || null;
    const identityMd = rlmData.identity_md || null;
    const agentsMd = rlmData.agents_md || null;
    const userMd = rlmData.user_md || null;
    const memoryLog = rlmData.memory_log || null;

    console.log(`[GenerateSoulprint] Got SoulPrint files: soul_md=${!!soulMd}, identity_md=${!!identityMd}, agents_md=${!!agentsMd}, user_md=${!!userMd}`);

    // Save to user profile with full SoulPrint files
    const { error: updateError } = await adminSupabase
      .from('user_profiles')
      .update({
        soulprint: soulprint,
        soulprint_text: soulprintText,
        archetype: archetype,
        // Full SoulPrint spec files
        soul_md: soulMd,
        identity_md: identityMd,
        agents_md: agentsMd,
        user_md: userMd,
        memory_log: memoryLog,
        memory_log_date: new Date().toISOString().split('T')[0],
        soulprint_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('[GenerateSoulprint] DB update error:', updateError);
      return NextResponse.json({
        error: 'Failed to save soulprint',
        details: updateError.message
      }, { status: 500 });
    }

    console.log(`[GenerateSoulprint] Saved full SoulPrint for user ${userId}: ${archetype}`);

    return NextResponse.json({
      success: true,
      archetype,
      soulprint_preview: soulprintText.slice(0, 200) + '...',
      has_soul_md: !!soulMd,
      has_identity_md: !!identityMd,
      has_agents_md: !!agentsMd,
      has_user_md: !!userMd,
    });

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[GenerateSoulprint] RLM timeout');
      return NextResponse.json({ error: 'Soulprint generation timed out' }, { status: 504 });
    }
    
    console.error('[GenerateSoulprint] Error:', error);
    return NextResponse.json({ 
      error: 'Soulprint generation failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// GET endpoint for cron - process users without soulprints
export async function GET(request: NextRequest) {
  const adminSupabase = getSupabaseAdmin();

  // Find users with embeddings complete but placeholder soulprint
  const { data: pendingUsers } = await adminSupabase
    .from('user_profiles')
    .select('user_id, archetype')
    .eq('embedding_status', 'complete')
    .or('archetype.eq.Analyzing...,soulprint_text.is.null')
    .limit(5);

  if (!pendingUsers || pendingUsers.length === 0) {
    return NextResponse.json({ message: 'No pending users' });
  }

  const results: Array<Record<string, unknown>> = [];
  for (const user of pendingUsers) {
    try {
      const response = await fetch(new URL('/api/soulprint/generate', request.url), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Internal-User-Id': user.user_id,
        },
      });
      const result = await response.json();
      results.push({ userId: user.user_id, ...result });
    } catch (e) {
      results.push({ userId: user.user_id, error: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  return NextResponse.json({ processed: results });
}
