/**
 * Generate signed upload URL for direct Supabase Storage upload
 * Bypasses Vercel's body size limits
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

    const adminSupabase = getSupabaseAdmin();
    
    // Create unique path for this upload
    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `imports/${user.id}/${timestamp}-${safeName}`;

    // Create signed upload URL (valid for 10 minutes)
    const { data, error } = await adminSupabase.storage
      .from('uploads')
      .createSignedUploadUrl(path);

    if (error) {
      console.error('[Upload URL] Error creating signed URL:', error);
      
      // If bucket doesn't exist, try to create it
      if (error.message?.includes('not found') || error.message?.includes('Bucket')) {
        const { error: bucketError } = await adminSupabase.storage.createBucket('uploads', {
          public: false,
          fileSizeLimit: 500 * 1024 * 1024, // 500MB
        });
        
        if (bucketError && !bucketError.message?.includes('already exists')) {
          console.error('[Upload URL] Failed to create bucket:', bucketError);
          return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
        }
        
        // Retry creating signed URL
        const retry = await adminSupabase.storage
          .from('uploads')
          .createSignedUploadUrl(path);
          
        if (retry.error) {
          return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 });
        }
        
        return NextResponse.json({
          uploadUrl: retry.data.signedUrl,
          token: retry.data.token,
          path,
        });
      }
      
      return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 });
    }

    return NextResponse.json({
      uploadUrl: data.signedUrl,
      token: data.token,
      path,
    });

  } catch (error) {
    console.error('[Upload URL] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
