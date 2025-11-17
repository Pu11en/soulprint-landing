import { useCallback, useRef, useEffect } from 'react';
import AutoSaveService, { AutoSaveOptions } from '@/services/autoSave';
import Logger from '@/utils/logger';

interface UseAutoSaveOptions extends AutoSaveOptions {
  onSaveStart?: (id: string) => void;
  onSaveSuccess?: (id: string, result: any) => void;
  onSaveError?: (id: string, error: Error) => void;
}

const useAutoSave = (options: UseAutoSaveOptions = {}) => {
  const autoSaveRef = useRef<AutoSaveService | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize auto-save service
  useEffect(() => {
    autoSaveRef.current = AutoSaveService.getInstance(options);
    
    return () => {
      if (autoSaveRef.current) {
        autoSaveRef.current.destroy();
      }
    };
  }, [options.debounceMs, options.maxRetries, options.retryDelayMs, options.enableOfflineSupport]);

  const save = useCallback((
    id: string,
    data: any,
    lastModified?: number,
    immediate: boolean = false
  ) => {
    if (!autoSaveRef.current) {
      Logger.warn('Auto-save service not initialized', 'useAutoSave');
      return;
    }

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Notify save start
    if (options.onSaveStart) {
      options.onSaveStart(id);
    }

    try {
      // Perform the save
      const result = autoSaveRef.current.save(id, data, lastModified, immediate);
      
      // Notify save success
      if (options.onSaveSuccess) {
        options.onSaveSuccess(id, result);
      }
    } catch (error) {
      // Notify save error
      if (options.onSaveError) {
        options.onSaveError(id, error as Error);
      }
    }
  }, [autoSaveRef, options.onSaveStart, options.onSaveSuccess, options.onSaveError]);

  const saveProject = useCallback((
    projectId: string,
    projectData: any,
    immediate?: boolean
  ) => {
    if (!autoSaveRef.current) {
      Logger.warn('Auto-save service not initialized', 'useAutoSave');
      return;
    }

    save(`project_${projectId}`, projectData, undefined, immediate);
  }, [save]);

  const saveNodes = useCallback((
    projectId: string,
    nodesData: any[],
    immediate?: boolean
  ) => {
    if (!autoSaveRef.current) {
      Logger.warn('Auto-save service not initialized', 'useAutoSave');
      return;
    }

    save(`nodes_${projectId}`, nodesData, undefined, immediate);
  }, [save]);

  const saveConnections = useCallback((
    projectId: string,
    connectionsData: any[],
    immediate?: boolean
  ) => {
    if (!autoSaveRef.current) {
      Logger.warn('Auto-save service not initialized', 'useAutoSave');
      return;
    }

    save(`connections_${projectId}`, connectionsData, undefined, immediate);
  }, [save]);

  const debouncedSave = useCallback((
    id: string,
    data: any,
    lastModified?: number
  ) => {
    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(() => {
      save(id, data, lastModified);
    }, options.debounceMs || 2000);
  }, [save, options.debounceMs]);

  const forceSave = useCallback(async () => {
    if (!autoSaveRef.current) {
      Logger.warn('Auto-save service not initialized', 'useAutoSave');
      return;
    }

    try {
      await autoSaveRef.current.forceSave();
    } catch (error) {
      Logger.error('Force save failed', 'useAutoSave', { error });
    }
  }, [autoSaveRef]);

  const getPendingSaves = useCallback(() => {
    if (!autoSaveRef.current) {
      Logger.warn('Auto-save service not initialized', 'useAutoSave');
      return [];
    }

    return autoSaveRef.current.getPendingSaves();
  }, [autoSaveRef]);

  const hasPendingSave = useCallback((id: string) => {
    if (!autoSaveRef.current) {
      Logger.warn('Auto-save service not initialized', 'useAutoSave');
      return false;
    }

    return autoSaveRef.current.hasPendingSave(id);
  }, [autoSaveRef]);

  const clearPendingSave = useCallback((id: string) => {
    if (!autoSaveRef.current) {
      Logger.warn('Auto-save service not initialized', 'useAutoSave');
      return;
    }

    autoSaveRef.current.clearPendingSave(id);
  }, [autoSaveRef]);

  const getStatus = useCallback(() => {
    if (!autoSaveRef.current) {
      Logger.warn('Auto-save service not initialized', 'useAutoSave');
      return {
        isOnline: true,
        pendingSaves: 0,
        inProgressSaves: 0,
      };
    }

    return autoSaveRef.current.getStatus();
  }, [autoSaveRef]);

  return {
    save,
    saveProject,
    saveNodes,
    saveConnections,
    debouncedSave,
    forceSave,
    getPendingSaves,
    hasPendingSave,
    clearPendingSave,
    getStatus,
  };
};

export default useAutoSave;
export type { UseAutoSaveOptions };