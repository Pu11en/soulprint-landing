/**
 * Generate signed upload URL for direct Supabase Storage upload
 * Handles files of any size (no limit)
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
    const { filename } = body;

    if (!filename) {
      return NextResponse.json({ error: 'Filename required' }, { status: 400 });
    }

    // Create unique path for this upload
    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${user.id}/${timestamp}-${safeName}`;

    // Use admin client to create signed upload URL
    const adminSupabase = getSupabaseAdmin();
    
    const { data, error } = await adminSupabase.storage
      .from('imports')
      .createSignedUploadUrl(path);

    if (error) {
      console.error('[Upload URL] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      uploadUrl: data.signedUrl,
      path: `imports/${path}`, // Full path for later reference
      token: data.token,
    });

  } catch (error) {
    console.error('[Upload URL] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
