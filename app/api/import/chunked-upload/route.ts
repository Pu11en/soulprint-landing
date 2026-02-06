import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TTLCache } from '@/lib/api/ttl-cache';
import { checkRateLimit } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:ChunkedUpload');

// Define upload session structure
interface UploadSession {
  chunks: Buffer[];
  totalChunks: number;
  receivedChunks: number;
}

// Store chunks in memory with TTL (30 min default, 5 min cleanup)
// Automatically removes stale uploads to prevent memory leaks
const uploadCache = new TTLCache<UploadSession>(30 * 60 * 1000, 5 * 60 * 1000);

export async function POST(req: NextRequest) {
  const correlationId = req.headers.get('x-correlation-id') || undefined;
  const startTime = Date.now();

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const reqLog = log.child({ correlationId, userId: user.id, method: 'POST', endpoint: '/api/import/chunked-upload' });

    // Rate limit check
    const rateLimited = await checkRateLimit(user.id, 'upload');
    if (rateLimited) return rateLimited;

    const chunkIndex = parseInt(req.headers.get('X-Chunk-Index') || '0');
    const totalChunks = parseInt(req.headers.get('X-Total-Chunks') || '1');
    const totalSize = parseInt(req.headers.get('X-Total-Size') || '0');
    const uploadId = req.headers.get('X-Upload-Id') || `${user.id}-${Date.now()}`;

    reqLog.debug({ chunkIndex: chunkIndex + 1, totalChunks, uploadId }, 'Receiving chunk');

    // Read chunk data
    const arrayBuffer = await req.arrayBuffer();
    const chunkBuffer = Buffer.from(arrayBuffer);

    // Initialize or get upload session
    if (!uploadCache.has(uploadId)) {
      uploadCache.set(uploadId, {
        chunks: new Array(totalChunks).fill(null),
        totalChunks,
        receivedChunks: 0,
      });
    }

    const session = uploadCache.get(uploadId)!;
    session.chunks[chunkIndex] = chunkBuffer;
    session.receivedChunks++;

    reqLog.debug({ received: session.receivedChunks, total: totalChunks }, 'Chunk stored');

    // If all chunks received, assemble and upload to Supabase
    if (session.receivedChunks === totalChunks) {
      reqLog.info('All chunks received, assembling');

      // Combine all chunks
      const fullFile = Buffer.concat(session.chunks);
      const fileSizeMB = (fullFile.length / 1024 / 1024).toFixed(1);
      reqLog.info({ sizeMB: fileSizeMB }, 'File assembled');

      // Clean up immediately (successful upload)
      uploadCache.delete(uploadId);

      // Upload to Supabase storage
      const timestamp = Date.now();
      const uploadPath = `${user.id}/${timestamp}-conversations.json`;

      const { data, error } = await supabase.storage
        .from('imports')
        .upload(uploadPath, fullFile, {
          upsert: true,
          contentType: 'application/json',
        });

      if (error) {
        reqLog.error({ error: error.message }, 'Supabase upload error');
        return NextResponse.json({ error: `Storage upload failed: ${error.message}` }, { status: 500 });
      }

      const duration = Date.now() - startTime;
      reqLog.info({ duration, status: 200, path: data.path, size: fullFile.length }, 'Upload complete');

      return NextResponse.json({
        success: true,
        complete: true,
        path: `imports/${data.path}`,
        size: fullFile.length,
      });
    }

    // Chunk received but not complete yet
    return NextResponse.json({
      success: true,
      complete: false,
      received: session.receivedChunks,
      total: totalChunks,
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    log.error({
      correlationId,
      duration,
      error: err instanceof Error ? { message: err.message, name: err.name } : String(err)
    }, 'Chunked upload failed');

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

// Note: Stale upload cleanup is now handled automatically by TTLCache
// Expired entries (>30 min) are removed via background cleanup timer
