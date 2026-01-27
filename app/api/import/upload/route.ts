/**
 * Trigger import processing after file uploaded to Supabase Storage
 * Two-phase processing:
 * 1. Quick soulprint (~30s) - user can start chatting immediately
 * 2. Background embeddings (minutes-hours) - full memory builds over time
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: Request) {
  try {
    // Get current user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { storagePath } = body;

    if (!storagePath) {
      return NextResponse.json({ error: 'Storage path required' }, { status: 400 });
    }

    // Verify the path belongs to this user (must start with uploads/{user_id}/)
    const expectedPrefix = `uploads/${user.id}/`;
    if (!storagePath.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: 'Invalid storage path' }, { status: 403 });
    }

    console.log(`[Import] Starting two-phase import for ${storagePath}`);
    
    const adminSupabase = getSupabaseAdmin();

    // Create import job
    const { data: importJob, error: jobError } = await adminSupabase
      .from('import_jobs')
      .insert({
        user_id: user.id,
        status: 'pending',
        source_email: user.email,
        source_type: 'direct_upload',
      })
      .select()
      .single();

    if (jobError || !importJob) {
      console.error('[Import] Failed to create job:', jobError);
      return NextResponse.json({ 
        error: `Failed to create import job: ${jobError?.message || jobError?.code || 'Unknown error'}` 
      }, { status: 500 });
    }

    // Phase 1: Quick soulprint (blocks until complete)
    // This generates an instant personality snapshot so user can chat immediately
    const quickUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/import/quick`;
    
    const quickRes = await fetch(quickUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        importJobId: importJob.id,
        userId: user.id,
        storagePath,
      }),
    });

    if (!quickRes.ok) {
      const errorData = await quickRes.json().catch(() => ({}));
      return NextResponse.json({ 
        error: `Quick import failed: ${errorData.error || quickRes.status}` 
      }, { status: 500 });
    }

    const quickResult = await quickRes.json();
    
    // Phase 2 (background embeddings) is triggered automatically by /api/import/quick
    // User doesn't need to wait for this
    
    return NextResponse.json({ 
      success: true,
      jobId: importJob.id,
      phase: 'quick_ready',
      soulprint: quickResult.soulprint,
      message: 'Your SoulPrint is ready! Start chatting while we learn more from your history.',
      backgroundProcessing: true,
    });

  } catch (error) {
    console.error('[Import] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
