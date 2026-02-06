/**
 * Chunked file upload for large files (1-5GB)
 * Splits file into 50MB chunks and uploads sequentially
 */

import { getCsrfToken } from '@/lib/csrf';

const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB chunks

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
  chunk: number;
  totalChunks: number;
}

export type ProgressCallback = (progress: UploadProgress) => void;

/**
 * Upload a large file in chunks
 */
export async function chunkedUpload(
  file: Blob,
  uploadUrl: string,
  authToken: string,
  onProgress?: ProgressCallback,
  uploadId?: string
): Promise<{ success: boolean; error?: string; path?: string }> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  let uploadedBytes = 0;
  let resultPath: string | undefined;

  console.log(`[ChunkedUpload] Starting: ${(file.size / 1024 / 1024).toFixed(1)}MB in ${totalChunks} chunks`);

  // Get CSRF token once for all chunks
  const csrfToken = await getCsrfToken();

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    console.log(`[ChunkedUpload] Uploading chunk ${chunkIndex + 1}/${totalChunks} (${(chunk.size / 1024 / 1024).toFixed(1)}MB)`);

    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/octet-stream',
        'X-Chunk-Index': String(chunkIndex),
        'X-Total-Chunks': String(totalChunks),
        'X-Chunk-Size': String(chunk.size),
        'X-Total-Size': String(file.size),
        'X-CSRF-Token': csrfToken,
      };

      if (uploadId) {
        headers['X-Upload-Id'] = uploadId;
      }

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers,
        body: chunk,
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[ChunkedUpload] Chunk ${chunkIndex + 1} failed:`, error);
        return { success: false, error: `Chunk ${chunkIndex + 1} failed: ${error}` };
      }

      // Parse response to get final path when all chunks are uploaded
      const result = await response.json().catch(() => ({}));
      if (result.complete && result.path) {
        resultPath = result.path;
      }

      uploadedBytes += chunk.size;
      
      if (onProgress) {
        onProgress({
          loaded: uploadedBytes,
          total: file.size,
          percent: Math.round((uploadedBytes / file.size) * 100),
          chunk: chunkIndex + 1,
          totalChunks,
        });
      }
    } catch (err) {
      console.error(`[ChunkedUpload] Chunk ${chunkIndex + 1} error:`, err);
      return { success: false, error: `Network error on chunk ${chunkIndex + 1}` };
    }
  }

  console.log('[ChunkedUpload] All chunks uploaded successfully');
  return { success: true, path: resultPath };
}

/**
 * Upload using XMLHttpRequest for real progress tracking
 * Better for medium-large files (100MB-1GB)
 */
export async function uploadWithProgress(
  file: Blob,
  url: string,
  authToken: string,
  contentType: string,
  onProgress?: (percent: number) => void
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  // Get CSRF token first
  const csrfToken = await getCsrfToken();

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({ success: true, data });
        } catch {
          resolve({ success: true });
        }
      } else {
        resolve({ success: false, error: xhr.responseText || `HTTP ${xhr.status}` });
      }
    });

    xhr.addEventListener('error', () => {
      resolve({ success: false, error: 'Network error during upload' });
    });

    xhr.addEventListener('timeout', () => {
      resolve({ success: false, error: 'Upload timed out' });
    });

    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.setRequestHeader('X-CSRF-Token', csrfToken);
    xhr.timeout = 10 * 60 * 1000; // 10 min timeout
    xhr.send(file);
  });
}
