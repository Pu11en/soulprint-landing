import { useState, useCallback } from 'react';
import { storageService, UploadOptions, UploadResult, StorageFile } from '@/services/storage';

interface UseStorageReturn {
  uploadFile: (file: File | Blob, path: string, options?: UploadOptions) => Promise<UploadResult>;
  uploadFileWithProgress: (
    file: File | Blob, 
    path: string, 
    onProgress?: (progress: number) => void, 
    options?: UploadOptions
  ) => Promise<UploadResult>;
  downloadFile: (path: string, bucket?: string) => Promise<{ data: Blob | null; error?: string }>;
  listFiles: (path?: string, bucket?: string, options?: any) => Promise<{ data: StorageFile[] | null; error?: string }>;
  deleteFile: (paths: string | string[], bucket?: string) => Promise<{ error?: string }>;
  getPublicUrl: (path: string, bucket?: string) => { publicUrl: string };
  getSignedUrl: (path: string, expiresIn?: number, bucket?: string) => Promise<{ signedUrl: string | null; error?: string }>;
  loading: boolean;
  error: string | null;
}

export const useStorage = (): UseStorageReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const uploadFile = useCallback(async (
    file: File | Blob,
    path: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> => {
    clearError();
    setLoading(true);

    try {
      const result = await storageService.uploadFile(file, path, options);
      
      if (result.error) {
        setError(result.error);
      } else {
        clearError();
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      return {
        path,
        fullPath: '',
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, [clearError]);

  const uploadFileWithProgress = useCallback(async (
    file: File | Blob,
    path: string,
    onProgress?: (progress: number) => void,
    options: UploadOptions = {}
  ): Promise<UploadResult> => {
    clearError();
    setLoading(true);

    try {
      const result = await storageService.uploadFileWithProgress(file, path, onProgress, options);
      
      if (result.error) {
        setError(result.error);
      } else {
        clearError();
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      return {
        path,
        fullPath: '',
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, [clearError]);

  const downloadFile = useCallback(async (
    path: string,
    bucket?: string
  ): Promise<{ data: Blob | null; error?: string }> => {
    clearError();
    setLoading(true);

    try {
      const result = await storageService.downloadFile(path, bucket);
      
      if (result.error) {
        setError(result.error);
      } else {
        clearError();
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      return {
        data: null,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, [clearError]);

  const listFiles = useCallback(async (
    path?: string,
    bucket?: string,
    options?: any
  ): Promise<{ data: StorageFile[] | null; error?: string }> => {
    clearError();
    setLoading(true);

    try {
      const result = await storageService.listFiles(path, bucket, options);
      
      if (result.error) {
        setError(result.error);
      } else {
        clearError();
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      return {
        data: null,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, [clearError]);

  const deleteFile = useCallback(async (
    paths: string | string[],
    bucket?: string
  ): Promise<{ error?: string }> => {
    clearError();
    setLoading(true);

    try {
      const result = await storageService.deleteFile(paths, bucket);
      
      if (result.error) {
        setError(result.error);
      } else {
        clearError();
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      return {
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, [clearError]);

  const getPublicUrl = useCallback((
    path: string,
    bucket?: string
  ): { publicUrl: string } => {
    return storageService.getPublicUrl(path, bucket);
  }, []);

  const getSignedUrl = useCallback(async (
    path: string,
    expiresIn?: number,
    bucket?: string
  ): Promise<{ signedUrl: string | null; error?: string }> => {
    clearError();
    setLoading(true);

    try {
      const result = await storageService.getSignedUrl(path, expiresIn, bucket);
      
      if (result.error) {
        setError(result.error);
      } else {
        clearError();
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      return {
        signedUrl: null,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, [clearError]);

  return {
    uploadFile,
    uploadFileWithProgress,
    downloadFile,
    listFiles,
    deleteFile,
    getPublicUrl,
    getSignedUrl,
    loading,
    error,
  };
};

export default useStorage;