/**
 * Chunked upload endpoint for mobile devices
 * Each chunk is stored in Supabase Storage (serverless-safe)
 * Final chunk triggers assembly and cleanup
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

    const formData = await request.formData();
    const chunk = formData.get('chunk') as Blob | null;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string, 10);
    const totalChunks = parseInt(formData.get('totalChunks') as string, 10);
    const uploadId = formData.get('uploadId') as string;
    
    if (!chunk || isNaN(chunkIndex) || isNaN(totalChunks) || !uploadId) {
      return NextResponse.json({ error: 'Missing chunk data' }, { status: 400 });
    }

    const adminSupabase = getSupabaseAdmin();
    const arrayBuffer = await chunk.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Store chunk in Supabase (stateless - works with serverless)
    const chunkPath = `${user.id}/chunks/${uploadId}/chunk-${String(chunkIndex).padStart(4, '0')}`;
    
    const { error: chunkError } = await adminSupabase.storage
      .from('imports')
      .upload(chunkPath, buffer, { 
        contentType: 'application/octet-stream',
        upsert: true,
      });

    if (chunkError) {
      console.error(`[UploadChunk] Failed to store chunk ${chunkIndex}:`, chunkError);
      return NextResponse.json({ error: chunkError.message }, { status: 500 });
    }
    
    console.log(`[UploadChunk] User ${user.id}: Stored chunk ${chunkIndex + 1}/${totalChunks}`);
    
    // Check if this is the last chunk (we upload sequentially so this is reliable)
    if (chunkIndex === totalChunks - 1) {
      console.log(`[UploadChunk] Last chunk received, assembling file...`);
      
      // Small delay to ensure storage is consistent
      await new Promise(r => setTimeout(r, 500));
      
      // Download and combine all chunks
      const chunks: Buffer[] = [];
      let retries = 0;
      const maxRetries = 3;
      
      for (let i = 0; i < totalChunks; i++) {
        const path = `${user.id}/chunks/${uploadId}/chunk-${String(i).padStart(4, '0')}`;
        let data = null;
        let error = null;
        
        // Retry logic for eventual consistency
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          const result = await adminSupabase.storage
            .from('imports')
            .download(path);
          data = result.data;
          error = result.error;
          
          if (data) break;
          if (attempt < maxRetries) {
            console.log(`[UploadChunk] Chunk ${i} not found, retrying (${attempt + 1}/${maxRetries})...`);
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          }
        }
        
        if (error || !data) {
          console.error(`[UploadChunk] Failed to download chunk ${i} after ${maxRetries} retries:`, error);
          return NextResponse.json({ error: `Failed to assemble: missing chunk ${i}` }, { status: 500 });
        }
        
        chunks.push(Buffer.from(await data.arrayBuffer()));
      }
      
      const fullBuffer = Buffer.concat(chunks);
      const sizeMB = (fullBuffer.length / 1024 / 1024).toFixed(1);
      console.log(`[UploadChunk] Assembled ${sizeMB}MB file from ${totalChunks} chunks`);
      
      // Upload combined file
      const timestamp = Date.now();
      const finalPath = `${user.id}/${timestamp}-conversations.json`;
      
      const { error: uploadError } = await adminSupabase.storage
        .from('imports')
        .upload(finalPath, fullBuffer, {
          contentType: 'application/json',
          upsert: true,
        });

      if (uploadError) {
        console.error('[UploadChunk] Final upload error:', uploadError);
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
      }

      // Clean up chunk files (fire and forget)
      const chunkPaths = Array.from({ length: totalChunks }, (_, i) => 
        `${user.id}/chunks/${uploadId}/chunk-${String(i).padStart(4, '0')}`
      );
      adminSupabase.storage.from('imports').remove(chunkPaths).catch(() => {});

      console.log(`[UploadChunk] Successfully uploaded to imports/${finalPath}`);

      return NextResponse.json({
        success: true,
        complete: true,
        path: `imports/${finalPath}`,
        size: fullBuffer.length,
      });
    }
    
    // More chunks expected
    return NextResponse.json({
      success: true,
      complete: false,
      chunkIndex,
      total: totalChunks,
    });

  } catch (error) {
    console.error('[UploadChunk] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Chunk upload failed' 
    }, { status: 500 });
  }
}
