/**
 * Upload file to Supabase Storage using XMLHttpRequest for real progress events.
 *
 * Uses XHR instead of supabase.storage.upload() because the Supabase JS client
 * uses fetch() internally which does NOT support upload progress monitoring.
 * XHR's upload.onprogress fires regularly with loaded/total byte counts,
 * giving users real-time feedback instead of a frozen progress bar.
 *
 * Keeps the same interface name (tusUpload) so the import page doesn't change.
 */

import { createClient } from '@/lib/supabase/client';

export interface TusUploadOptions {
  file: Blob;
  userId: string;
  filename: string;
  onProgress: (percent: number) => void;
  contentType?: string;
}

export interface TusUploadResult {
  success: boolean;
  storagePath?: string;
  error?: string;
}

export async function tusUpload(options: TusUploadOptions): Promise<TusUploadResult> {
  const { file, userId, filename, onProgress } = options;

  try {
    const supabase = createClient();

    // Verify auth and get session token for Storage REST API
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'You must be logged in to upload' };
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { success: false, error: 'Session expired. Please log in again.' };
    }

    // Build storage path
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const objectName = `${userId}/${Date.now()}-${sanitizedFilename}`;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/imports/${objectName}`;

    console.log('[Upload] Starting XHR upload to:', objectName, 'size:', (file.size / 1024 / 1024).toFixed(1), 'MB');

    onProgress(0); // Signal upload is starting

    // Use XMLHttpRequest for real upload progress events
    const result = await new Promise<TusUploadResult>((resolve) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress via XHR upload events
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          const storagePath = `imports/${objectName}`;
          console.log('[Upload] Complete:', storagePath);
          resolve({ success: true, storagePath });
        } else {
          let errorMsg = `Upload failed (${xhr.status})`;
          try {
            const body = JSON.parse(xhr.responseText);
            errorMsg = body.message || body.error || errorMsg;
          } catch {
            // Use status-based message
          }
          console.error('[Upload] Server error:', xhr.status, errorMsg);
          resolve({ success: false, error: errorMsg });
        }
      };

      xhr.onerror = () => {
        console.error('[Upload] Network error');
        resolve({ success: false, error: 'Upload failed — check your connection and try again' });
      };

      xhr.ontimeout = () => {
        console.error('[Upload] Timeout');
        resolve({ success: false, error: 'Upload timed out — try again on a faster connection' });
      };

      // 10 minute timeout for large files on slow connections
      xhr.timeout = 10 * 60 * 1000;

      xhr.open('POST', uploadUrl);
      xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
      xhr.setRequestHeader('x-upsert', 'true');

      // Content-Type: the Supabase Storage API needs this to store the right MIME type
      const contentType = options.contentType || 'application/json';
      xhr.setRequestHeader('Content-Type', contentType);

      xhr.send(file);
    });

    return result;

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed';
    console.error('[Upload] Error:', msg);
    return { success: false, error: msg };
  }
}
