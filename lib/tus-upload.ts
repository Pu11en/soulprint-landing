/**
 * TUS resumable upload wrapper for Supabase Storage
 * Supports files up to 5GB with automatic resume, retry, and JWT refresh
 */

import * as tus from 'tus-js-client';
import { createClient } from '@/lib/supabase/client';

export interface TusUploadOptions {
  file: Blob;
  userId: string;
  filename: string;
  onProgress: (percent: number) => void;
}

export interface TusUploadResult {
  success: boolean;
  storagePath?: string;
  error?: string;
}

/**
 * Upload a file to Supabase Storage using TUS resumable protocol
 *
 * Features:
 * - Supports up to 5GB files (Supabase Pro limit)
 * - 6MB chunks (required by Supabase)
 * - Automatic resume on network interruption
 * - Auto-retry on 5xx errors and 401 (with token refresh)
 * - JWT token refresh before each chunk (prevents 401 on multi-hour uploads)
 */
export async function tusUpload(options: TusUploadOptions): Promise<TusUploadResult> {
  const { file, userId, filename, onProgress } = options;

  // Force token refresh before reading session (getSession reads stale cache)
  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: 'You must be logged in to upload' };
  }

  // Now getSession returns the refreshed token
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { success: false, error: 'You must be logged in to upload' };
  }

  // Extract project ID from Supabase URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const projectIdMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!projectIdMatch) {
    return { success: false, error: 'Invalid Supabase URL configuration' };
  }
  const projectId = projectIdMatch[1];

  // Build TUS endpoint URL
  const tusEndpoint = `https://${projectId}.supabase.co/storage/v1/upload/resumable`;

  // Sanitize filename (replace non-alphanumeric chars except . and - with _)
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');

  // Build storage object name: {userId}/{timestamp}-{sanitizedFilename}
  const objectName = `${userId}/${Date.now()}-${sanitizedFilename}`;

  // Create TUS upload
  return new Promise((resolve) => {
    const upload = new tus.Upload(file, {
      endpoint: tusEndpoint,
      headers: {
        authorization: `Bearer ${session.access_token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      chunkSize: 6 * 1024 * 1024, // MUST be 6MB - Supabase requirement
      removeFingerprintOnSuccess: true, // Prevents fingerprint collision on re-upload
      retryDelays: [0, 3000, 5000, 10000, 20000], // Auto-retry with backoff
      metadata: {
        bucketName: 'imports',
        objectName,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
      },
      // Refresh JWT token before each chunk (prevents 401 on multi-hour uploads)
      onBeforeRequest: async (req) => {
        // Force refresh first, then read the fresh session
        await supabase.auth.getUser();
        const { data: { session: freshSession } } = await supabase.auth.getSession();
        if (!freshSession?.access_token) {
          throw new Error('Session expired during upload');
        }
        req.setHeader('Authorization', `Bearer ${freshSession.access_token}`);
      },
      // Track upload progress
      onProgress: (bytesUploaded, bytesTotal) => {
        const percent = Math.round((bytesUploaded / bytesTotal) * 100);
        onProgress(percent);
      },
      // Upload complete
      onSuccess: () => {
        // Construct storage path from known objectName (don't try to parse upload.url)
        const storagePath = `imports/${objectName}`;
        console.log('[TUS] Upload complete:', storagePath);
        resolve({ success: true, storagePath });
      },
      // Upload failed
      onError: (error) => {
        console.error('[TUS] Upload failed:', error);
        resolve({ success: false, error: error.message });
      },
      // Retry logic: retry on 401 (after token refresh) and 5xx errors
      onShouldRetry: (err, retryAttempt) => {
        const status = err?.originalResponse?.getStatus();
        if (status === 401) return true; // Token refresh handled by onBeforeRequest
        if (status && status >= 500 && status < 600) return retryAttempt < 3;
        return false;
      },
    });

    // Start the upload
    upload.start();
  });
}
