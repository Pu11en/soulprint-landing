/**
 * Thin authentication proxy for import processing.
 * Authenticates user, triggers RLM /import-full, returns 202 immediately.
 *
 * NO heavy processing here - RLM handles download, parse, quick pass.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:ImportTrigger');

export const runtime = 'nodejs';
export const maxDuration = 30; // 30 seconds max (just for auth + trigger)

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: Request) {
  const adminSupabase = getSupabaseAdmin();
  const correlationId = request.headers.get('x-correlation-id') || undefined;
  const startTime = Date.now();

  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const reqLog = log.child({ correlationId, userId: user.id, endpoint: '/api/import/trigger' });

    // Rate limit check
    const rateLimited = await checkRateLimit(user.id, 'expensive');
    if (rateLimited) return rateLimited;

    const { storagePath, fileType } = await request.json();

    if (!storagePath) {
      return NextResponse.json({ error: 'storagePath required' }, { status: 400 });
    }

    reqLog.info({ storagePath }, 'Import trigger started');

    // Duplicate import guard (matching queue-processing.ts logic)
    const { data: existingProfile } = await adminSupabase
      .from('user_profiles')
      .select('import_status, processing_started_at')
      .eq('user_id', user.id)
      .single();

    if (existingProfile?.import_status === 'processing') {
      const startedAt = existingProfile.processing_started_at
        ? new Date(existingProfile.processing_started_at).getTime()
        : Date.now();
      const elapsedMs = Date.now() - startedAt;
      const elapsedMinutes = Math.round(elapsedMs / 1000 / 60);
      const STUCK_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

      if (elapsedMs < STUCK_THRESHOLD_MS) {
        reqLog.warn({ elapsedMinutes }, 'Duplicate import rejected');
        return NextResponse.json(
          {
            error: 'Import already in progress. Please wait for it to complete.',
            status: 'processing',
            elapsedMinutes,
          },
          { status: 409 }
        );
      }

      reqLog.warn({ elapsedMinutes }, 'Stuck import detected, allowing retry');
    }

    // Update user profile to processing status
    await adminSupabase.from('user_profiles').upsert({
      user_id: user.id,
      import_status: 'processing',
      import_error: null,
      progress_percent: 0,
      import_stage: 'Starting...',
      processing_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    // Fire RLM import (fire-and-forget, 10s timeout just to confirm acceptance)
    const rlmUrl = process.env.RLM_API_URL || 'https://soulprint-landing.onrender.com';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const rlmResponse = await fetch(`${rlmUrl}/import-full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          storage_path: storagePath,
          file_type: fileType || 'json',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!rlmResponse.ok) {
        const errorText = await rlmResponse.text().catch(() => 'Unknown error');
        reqLog.error({ status: rlmResponse.status, error: errorText }, 'RLM returned error');

        await adminSupabase.from('user_profiles').update({
          import_status: 'failed',
          import_error: `RLM error: ${errorText.slice(0, 200)}`,
          updated_at: new Date().toISOString(),
        }).eq('user_id', user.id);

        return NextResponse.json({ error: 'Import service error' }, { status: 500 });
      }

      reqLog.info('RLM accepted job');
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        reqLog.warn('RLM job submission timed out (non-fatal)');
        // Don't fail - RLM may still process successfully
      } else {
        reqLog.error({ error: String(e) }, 'Failed to call RLM');

        await adminSupabase.from('user_profiles').update({
          import_status: 'failed',
          import_error: 'Failed to start import processing',
          updated_at: new Date().toISOString(),
        }).eq('user_id', user.id);

        return NextResponse.json({ error: 'Failed to start import' }, { status: 500 });
      }
    }

    const duration = Date.now() - startTime;
    reqLog.info({ duration, status: 202 }, 'Import triggered successfully');

    return NextResponse.json({
      success: true,
      status: 'processing',
      message: 'Import started. Processing on RLM service.',
    }, { status: 202 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to trigger import';
    const duration = Date.now() - startTime;

    log.error({ correlationId, duration, error: String(error) }, 'Import trigger failed');

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
