/**
 * Trigger import processing after file uploaded to Supabase Storage
 * Doesn't download the file - just passes the path to processor
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

    // Verify the path belongs to this user
    if (!storagePath.includes(user.id)) {
      return NextResponse.json({ error: 'Invalid storage path' }, { status: 403 });
    }

    console.log(`[Import] Triggering process for ${storagePath}`);
    
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

    // Trigger processing with just the path (fire and forget)
    const processUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/import/process`;
    
    fetch(processUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        importJobId: importJob.id,
        userId: user.id,
        storagePath, // Just the path, not the file contents
      }),
    }).catch(e => console.error('[Import] Process trigger error:', e));

    return NextResponse.json({ 
      success: true,
      jobId: importJob.id,
      message: 'Import started! Your memory is being built.'
    });

  } catch (error) {
    console.error('[Import] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
