import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import logger from '@/utils/logger';

export interface UploadOptions {
  bucket?: string;
  upsert?: boolean;
  cacheControl?: string;
  metadata?: Record<string, string>;
  contentType?: string;
}

export interface UploadResult {
  path: string;
  fullPath: string;
  publicUrl?: string;
  error?: string;
}

export interface StorageFile {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  size: number;
  etag: string;
  metadata?: Record<string, string>;
}

class StorageService {
  private client = supabase;

  // Upload a file to Supabase Storage
  async uploadFile(
    file: File | Blob,
    path: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    try {
      const {
        bucket = 'assets',
        upsert = false,
        cacheControl = '3600',
        metadata = {},
        contentType,
      } = options;

      logger.info(`Uploading file to storage: ${path}`, JSON.stringify({ path, bucket, upsert }));

      const { data, error } = await this.client.storage
        .from(bucket)
        .upload(path, file, {
          upsert,
          cacheControl,
          metadata,
          contentType: contentType || file.type,
        });

      if (error) {
        logger.error(`Failed to upload file: ${error.message}`);
        return {
          path,
          fullPath: '',
          error: error.message,
        };
      }

      // Get public URL if the bucket is public
      const { data: publicUrlData } = this.client.storage
        .from(bucket)
        .getPublicUrl(data.path);

      logger.info(`File uploaded successfully: ${path}`, JSON.stringify({ path, publicUrl: publicUrlData.publicUrl }));

      return {
        path: data.path,
        fullPath: `${bucket}/${data.path}`,
        publicUrl: publicUrlData.publicUrl,
      };
    } catch (error) {
      logger.error(`Error uploading file: ${error instanceof Error ? error.message : String(error)}`);
      return {
        path,
        fullPath: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Upload with progress tracking
  async uploadFileWithProgress(
    file: File | Blob,
    path: string,
    onProgress?: (progress: number) => void,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    try {
      const {
        bucket = 'assets',
        upsert = false,
        cacheControl = '3600',
        metadata = {},
        contentType,
      } = options;

      logger.info(`Uploading file with progress tracking: ${path}`, JSON.stringify({ path, bucket, upsert }));

      // Create a FormData object for the upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', path);
      formData.append('bucket', bucket);
      formData.append('upsert', upsert.toString());
      formData.append('cacheControl', cacheControl);
      
      if (contentType) {
        formData.append('contentType', contentType);
      }

      if (Object.keys(metadata).length > 0) {
        formData.append('metadata', JSON.stringify(metadata));
      }

      // Use XMLHttpRequest for progress tracking
      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();

        // Track progress
        if (onProgress) {
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const progress = (event.loaded / event.total) * 100;
              onProgress(progress);
            }
          });
        }

        // Handle completion
        xhr.addEventListener('load', async () => {
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText);
              
              // Get public URL if the bucket is public
              const { data: publicUrlData } = this.client.storage
                .from(bucket)
                .getPublicUrl(response.data.path);

              resolve({
                path: response.data.path,
                fullPath: `${bucket}/${response.data.path}`,
                publicUrl: publicUrlData.publicUrl,
              });
            } catch (parseError) {
              logger.error(`Failed to parse upload response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
              resolve({
                path,
                fullPath: '',
                error: 'Failed to parse response',
              });
            }
          } else {
            logger.error(`Upload failed with status: ${xhr.status}`);
            resolve({
              path,
              fullPath: '',
              error: `Upload failed with status ${xhr.status}`,
            });
          }
        });

        // Handle errors
        xhr.addEventListener('error', () => {
          logger.error('Upload request failed');
          resolve({
            path,
            fullPath: '',
            error: 'Upload request failed',
          });
        });

        // Configure and send request
        xhr.open('POST', '/api/storage/upload');
        const { data: sessionData } = await this.client.auth.getSession();
        xhr.setRequestHeader('Authorization', `Bearer ${sessionData.session?.access_token || ''}`);
        xhr.send(formData);
      });
    } catch (error) {
      logger.error(`Error uploading file with progress: ${error instanceof Error ? error.message : String(error)}`);
      return {
        path,
        fullPath: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Download a file from Supabase Storage
  async downloadFile(
    path: string,
    bucket: string = 'assets'
  ): Promise<{ data: Blob | null; error?: string }> {
    try {
      logger.info(`Downloading file from storage: ${path}`, JSON.stringify({ path, bucket }));

      const { data, error } = await this.client.storage
        .from(bucket)
        .download(path);

      if (error) {
        logger.error(`Failed to download file: ${error.message}`);
        return { data: null, error: error.message };
      }

      logger.info(`File downloaded successfully: ${path}`);
      return { data };
    } catch (error) {
      logger.error(`Error downloading file: ${error instanceof Error ? error.message : String(error)}`);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // List files in a bucket or folder
  async listFiles(
    path: string = '',
    bucket: string = 'assets',
    options: {
      limit?: number;
      offset?: number;
      sortBy?: { column: string; order: 'asc' | 'desc' };
    } = {}
  ): Promise<{ data: StorageFile[] | null; error?: string }> {
    try {
      logger.info(`Listing files in storage: ${path}`, JSON.stringify({ path, bucket }));

      const { data, error } = await this.client.storage
        .from(bucket)
        .list(path, options);

      if (error) {
        logger.error(`Failed to list files: ${error.message}`);
        return { data: null, error: error.message };
      }

      logger.info(`Files listed successfully: ${data?.length || 0} files`);
      // Convert FileObject to StorageFile format
      const storageFiles: StorageFile[] = data?.map(file => ({
        name: file.name,
        id: file.id,
        updated_at: file.updated_at,
        created_at: file.created_at,
        last_accessed_at: file.last_accessed_at || '',
        size: (file as any).size || 0,
        etag: (file as any).etag || '',
        metadata: file.metadata || {},
      })) || [];
      
      return { data: storageFiles };
    } catch (error) {
      logger.error(`Error listing files: ${error instanceof Error ? error.message : String(error)}`);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Delete a file from Supabase Storage
  async deleteFile(
    paths: string | string[],
    bucket: string = 'assets'
  ): Promise<{ error?: string }> {
    try {
      const pathsArray = Array.isArray(paths) ? paths : [paths];
      
      logger.info(`Deleting files from storage: ${pathsArray.join(', ')}`, JSON.stringify({ paths: pathsArray, bucket }));

      const { error } = await this.client.storage
        .from(bucket)
        .remove(pathsArray);

      if (error) {
        logger.error(`Failed to delete files: ${error.message}`);
        return { error: error.message };
      }

      logger.info(`Files deleted successfully: ${pathsArray.join(', ')}`);
      return {};
    } catch (error) {
      logger.error(`Error deleting files: ${error instanceof Error ? error.message : String(error)}`);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Get public URL for a file
  getPublicUrl(
    path: string,
    bucket: string = 'assets'
  ): { publicUrl: string } {
    const { data } = this.client.storage
      .from(bucket)
      .getPublicUrl(path);

    return data;
  }

  // Get signed URL for private files
  async getSignedUrl(
    path: string,
    expiresIn: number = 3600,
    bucket: string = 'assets'
  ): Promise<{ signedUrl: string | null; error?: string }> {
    try {
      logger.info(`Getting signed URL for file: ${path}`, JSON.stringify({ path, bucket, expiresIn }));

      const { data, error } = await this.client.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);

      if (error) {
        logger.error(`Failed to create signed URL: ${error.message}`);
        return { signedUrl: null, error: error.message };
      }

      logger.info(`Signed URL created successfully: ${path}`);
      return { signedUrl: data.signedUrl };
    } catch (error) {
      logger.error(`Error creating signed URL: ${error instanceof Error ? error.message : String(error)}`);
      return {
        signedUrl: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Note: Supabase Storage doesn't have a direct updateMetadata method
  // To update metadata, you would need to re-upload the file with new metadata
}

// Singleton instance
export const storageService = new StorageService();

export default storageService;