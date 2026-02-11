/**
 * Upload file to Supabase Storage using the standard JS client
 *
 * Uses supabase.storage.upload() which handles auth internally.
 * The Supabase client's built-in auth works for DB queries, so it
 * should work for storage too — unlike raw TUS headers which failed.
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

    // Verify auth first
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'You must be logged in to upload' };
    }

    // Build storage path
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const objectName = `${userId}/${Date.now()}-${sanitizedFilename}`;

    onProgress(10); // Starting upload

    console.log('[Upload] Starting standard upload to:', objectName, 'size:', (file.size / 1024 / 1024).toFixed(1), 'MB');

    // Standard Supabase Storage upload — client handles auth internally
    const { data, error } = await supabase.storage
      .from('imports')
      .upload(objectName, file, {
        contentType: options.contentType || 'application/json',
        upsert: true,
        duplex: 'half',
      });

    if (error) {
      console.error('[Upload] Supabase storage error:', error);
      return { success: false, error: `Upload failed: ${error.message}` };
    }

    onProgress(100);
    const storagePath = `imports/${data.path}`;
    console.log('[Upload] Complete:', storagePath);
    return { success: true, storagePath };

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed';
    console.error('[Upload] Error:', msg);
    return { success: false, error: msg };
  }
}
