import { useState, useCallback } from 'react';
import { 
  omniclipService, 
  ProcessingOptions, 
  ProcessingResult, 
  ProcessingStatus,
  VideoClip,
  VideoProject 
} from '@/services/omniclip';

interface UseOmniclipReturn {
  initializeProject: (projectName: string) => Promise<{ projectId?: string; error?: string }>;
  processVideo: (
    projectId: string,
    videoUrl: string,
    options?: ProcessingOptions
  ) => Promise<{ result?: ProcessingResult; error?: string }>;
  getProcessingStatus: (jobId: string) => Promise<{ status?: ProcessingStatus; error?: string }>;
  createClips: (
    projectId: string,
    clips: Array<{
      startTime: number;
      endTime: number;
      metadata?: Record<string, any>;
    }>
  ) => Promise<{ clips?: VideoClip[]; error?: string }>;
  exportVideo: (
    projectId: string,
    options?: ProcessingOptions
  ) => Promise<{ result?: ProcessingResult; error?: string }>;
  deleteProject: (projectId: string) => Promise<{ error?: string }>;
  getProject: (projectId: string) => Promise<{ project?: VideoProject; error?: string }>;
  loading: boolean;
  error: string | null;
}

export const useOmniclip = (): UseOmniclipReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const initializeProject = useCallback(async (projectName: string) => {
    clearError();
    setLoading(true);

    try {
      const result = await omniclipService.initializeProject(projectName);
      
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

  const processVideo = useCallback(async (
    projectId: string,
    videoUrl: string,
    options?: ProcessingOptions
  ) => {
    clearError();
    setLoading(true);

    try {
      const result = await omniclipService.processVideo(projectId, videoUrl, options);
      
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

  const getProcessingStatus = useCallback(async (jobId: string) => {
    clearError();
    setLoading(true);

    try {
      const result = await omniclipService.getProcessingStatus(jobId);
      
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

  const createClips = useCallback(async (
    projectId: string,
    clips: Array<{
      startTime: number;
      endTime: number;
      metadata?: Record<string, any>;
    }>
  ) => {
    clearError();
    setLoading(true);

    try {
      const result = await omniclipService.createClips(projectId, clips);
      
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

  const exportVideo = useCallback(async (
    projectId: string,
    options?: ProcessingOptions
  ) => {
    clearError();
    setLoading(true);

    try {
      const result = await omniclipService.exportVideo(projectId, options);
      
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

  const deleteProject = useCallback(async (projectId: string) => {
    clearError();
    setLoading(true);

    try {
      const result = await omniclipService.deleteProject(projectId);
      
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

  const getProject = useCallback(async (projectId: string) => {
    clearError();
    setLoading(true);

    try {
      const result = await omniclipService.getProject(projectId);
      
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

  return {
    initializeProject,
    processVideo,
    getProcessingStatus,
    createClips,
    exportVideo,
    deleteProject,
    getProject,
    loading,
    error,
  };
};

export default useOmniclip;