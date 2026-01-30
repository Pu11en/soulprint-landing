/**
 * Chunked upload endpoint for mobile devices
 * Accepts small chunks (< 4MB) and appends them server-side
 * This bypasses Vercel's 4.5MB body limit
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 30;

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// In-memory chunk storage (temporary - cleared after upload completes)
// In production, you might want Redis or a temp file system
const chunkStorage = new Map<string, { chunks: Buffer[], totalChunks: number, receivedChunks: Set<number> }>();

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const formData = await request.formData();
    const chunk = formData.get('chunk') as Blob | null;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string, 10);
    const totalChunks = parseInt(formData.get('totalChunks') as string, 10);
    const uploadId = formData.get('uploadId') as string;
    
    if (!chunk || isNaN(chunkIndex) || isNaN(totalChunks) || !uploadId) {
      return NextResponse.json({ error: 'Missing chunk data' }, { status: 400 });
    }

    const storageKey = `${user.id}:${uploadId}`;
    
    // Initialize storage for this upload if needed
    if (!chunkStorage.has(storageKey)) {
      chunkStorage.set(storageKey, {
        chunks: new Array(totalChunks),
        totalChunks,
        receivedChunks: new Set(),
      });
    }
    
    const storage = chunkStorage.get(storageKey)!;
    
    // Store this chunk
    const arrayBuffer = await chunk.arrayBuffer();
    storage.chunks[chunkIndex] = Buffer.from(arrayBuffer);
    storage.receivedChunks.add(chunkIndex);
    
    console.log(`[UploadChunk] User ${user.id}: Received chunk ${chunkIndex + 1}/${totalChunks}`);
    
    // Check if all chunks received
    if (storage.receivedChunks.size === totalChunks) {
      console.log(`[UploadChunk] All chunks received, assembling file...`);
      
      // Combine all chunks
      const fullBuffer = Buffer.concat(storage.chunks);
      const sizeMB = (fullBuffer.length / 1024 / 1024).toFixed(1);
      console.log(`[UploadChunk] Assembled ${sizeMB}MB file`);
      
      // Clean up memory
      chunkStorage.delete(storageKey);
      
      // Upload to Supabase Storage
      const timestamp = Date.now();
      const path = `${user.id}/${timestamp}-conversations.json`;
      
      const adminSupabase = getSupabaseAdmin();
      const { error: uploadError } = await adminSupabase.storage
        .from('imports')
        .upload(path, fullBuffer, {
          contentType: 'application/json',
          upsert: true,
        });

      if (uploadError) {
        console.error('[UploadChunk] Storage error:', uploadError);
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
      }

      console.log(`[UploadChunk] Successfully uploaded to imports/${path}`);

      return NextResponse.json({
        success: true,
        complete: true,
        path: `imports/${path}`,
        size: fullBuffer.length,
      });
    }
    
    // More chunks expected
    return NextResponse.json({
      success: true,
      complete: false,
      received: storage.receivedChunks.size,
      total: totalChunks,
    });

  } catch (error) {
    console.error('[UploadChunk] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Chunk upload failed' 
    }, { status: 500 });
  }
}
