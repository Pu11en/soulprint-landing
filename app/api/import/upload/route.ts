/**
 * Trigger import processing after file uploaded to Supabase Storage
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 300;

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

    console.log(`[Import] Processing file at ${storagePath} for user ${user.id}`);
    
    const adminSupabase = getSupabaseAdmin();

    // Verify file exists
    const { data: fileData, error: downloadError } = await adminSupabase.storage
      .from('uploads')
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error('[Import] File not found:', downloadError);
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
    }

    console.log(`[Import] File verified: ${(fileData.size / 1024 / 1024).toFixed(1)}MB`);

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
      return NextResponse.json({ error: 'Failed to create import job' }, { status: 500 });
    }

    // Convert to base64 for processing
    const arrayBuffer = await fileData.arrayBuffer();
    const zipBase64 = Buffer.from(arrayBuffer).toString('base64');

    // Trigger processing
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
        zipBase64,
      }),
    }).catch(e => console.error('[Import] Process trigger error:', e));

    // Clean up storage file (fire and forget)
    adminSupabase.storage
      .from('uploads')
      .remove([storagePath])
      .catch(e => console.error('[Import] Cleanup error:', e));

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
