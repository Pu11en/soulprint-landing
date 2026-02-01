/**
 * Upload raw conversations.json to Supabase Storage
 * Handles large files by streaming and compressing
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { gzipSync } from 'zlib';

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes for large uploads

// Increase body size limit
export const fetchCache = 'force-no-store';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get raw text from request
    const rawJson = await request.text();
    
    if (!rawJson || rawJson.length < 10) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 });
    }

    console.log(`[UploadRaw] Received ${rawJson.length} chars from user ${user.id}`);

    // Compress with gzip
    const compressed = gzipSync(Buffer.from(rawJson, 'utf-8'));
    const compressionRatio = ((1 - compressed.length / rawJson.length) * 100).toFixed(1);
    console.log(`[UploadRaw] Compressed: ${rawJson.length} → ${compressed.length} bytes (${compressionRatio}% reduction)`);

    // Generate storage path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const storagePath = `${user.id}/conversations-${timestamp}.json.gz`;

    // Upload to Supabase Storage
    const adminSupabase = getSupabaseAdmin();
    const { error: uploadError } = await adminSupabase.storage
      .from('user-exports')
      .upload(storagePath, compressed, {
        contentType: 'application/gzip',
        upsert: false,
      });

    if (uploadError) {
      console.error('[UploadRaw] Upload failed:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Update user profile with path
    await adminSupabase
      .from('user_profiles')
      .update({ raw_export_path: storagePath })
      .eq('user_id', user.id);

    console.log(`[UploadRaw] Success! Stored at: ${storagePath}`);

    return NextResponse.json({ 
      success: true,
      storagePath,
      originalSize: rawJson.length,
      compressedSize: compressed.length,
    });

  } catch (error) {
    console.error('[UploadRaw] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
