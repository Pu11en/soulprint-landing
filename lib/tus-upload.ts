/**
 * TUS resumable upload wrapper for Supabase Storage
 * Supports files up to 5GB with automatic resume and retry
 */

import * as tus from 'tus-js-client';

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

/** Fetch a fresh access token from the server (bypasses client-side session issues) */
async function getServerToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/storage/token', { credentials: 'include' });
    if (!res.ok) return null;
    const { token } = await res.json();
    return token || null;
  } catch {
    return null;
  }
}

/**
 * Upload a file to Supabase Storage using TUS resumable protocol.
 *
 * Gets auth token from server-side session (not browser client) to avoid
 * stale/corrupted client-side JWT issues.
 */
export async function tusUpload(options: TusUploadOptions): Promise<TusUploadResult> {
  const { file, userId, filename, onProgress } = options;

  // Get fresh token from server (server-side session is always valid)
  const token = await getServerToken();
  if (!token) {
    return { success: false, error: 'You must be logged in to upload' };
  }

  console.log('[TUS] Token from server:', {
    length: token.length,
    dots: (token.match(/\./g) || []).length,
    prefix: token.substring(0, 20) + '...',
  });

  // Build TUS endpoint URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const projectIdMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!projectIdMatch) {
    return { success: false, error: 'Invalid Supabase URL configuration' };
  }
  const tusEndpoint = `https://${projectIdMatch[1]}.supabase.co/storage/v1/upload/resumable`;

  // Sanitize filename and build storage path
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const objectName = `${userId}/${Date.now()}-${sanitizedFilename}`;

  return new Promise((resolve) => {
    const upload = new tus.Upload(file, {
      endpoint: tusEndpoint,
      // Match Supabase official TUS example exactly
      headers: {
        authorization: `Bearer ${token}`,
        'x-upsert': 'true',
      },
      uploadDataDuringCreation: true,
      chunkSize: 6 * 1024 * 1024, // Required: 6MB chunks for Supabase
      removeFingerprintOnSuccess: true,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      metadata: {
        bucketName: 'imports',
        objectName,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
      },
      onBeforeRequest: async (req) => {
        // Refresh token from server before each chunk
        const freshToken = await getServerToken();
        if (!freshToken) throw new Error('Session expired during upload');
        req.setHeader('Authorization', `Bearer ${freshToken}`);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percent = Math.round((bytesUploaded / bytesTotal) * 100);
        onProgress(percent);
      },
      onSuccess: () => {
        const storagePath = `imports/${objectName}`;
        console.log('[TUS] Upload complete:', storagePath);
        resolve({ success: true, storagePath });
      },
      onError: (error) => {
        console.error('[TUS] Upload failed:', error);
        resolve({ success: false, error: error.message });
      },
      onShouldRetry: (err, retryAttempt) => {
        const status = err?.originalResponse?.getStatus();
        if (status === 401) return true;
        if (status && status >= 500 && status < 600) return retryAttempt < 3;
        return false;
      },
    });

    upload.start();
  });
}
