import Logger from '@/utils/logger';
import Environment from '@/config/environment';

interface AutoSaveData {
  id: string;
  data: any;
  timestamp: number;
  lastModified?: number;
}

interface AutoSaveOptions {
  debounceMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  enableOfflineSupport?: boolean;
}

class AutoSaveService {
  private static instance: AutoSaveService;
  private saveQueue: Map<string, AutoSaveData> = new Map();
  private savePromises: Map<string, Promise<any>> = new Map();
  private isOnline = typeof window !== 'undefined' ? navigator.onLine : true;
  private defaultOptions: Required<AutoSaveOptions> = {
    debounceMs: 2000,
    maxRetries: 3,
    retryDelayMs: 1000,
    enableOfflineSupport: true,
  };

  private constructor(private options: AutoSaveOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
    
    if (typeof window !== 'undefined') {
      // Setup online/offline event listeners
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
    }
  }

  static getInstance(options?: AutoSaveOptions): AutoSaveService {
    if (!this.instance) {
      this.instance = new AutoSaveService(options);
    }
    return this.instance;
  }

  private handleOnline = (): void => {
    this.isOnline = true;
    Logger.info('Connection restored, processing save queue', 'AutoSave');
    this.processSaveQueue();
  };

  private handleOffline = (): void => {
    this.isOnline = false;
    Logger.info('Connection lost, enabling offline mode', 'AutoSave');
  };

  private processSaveQueue = async (): Promise<void> => {
    if (this.saveQueue.size === 0) {
      return;
    }

    const saves = Array.from(this.saveQueue.values());
    this.saveQueue.clear();

    Logger.info(`Processing ${saves.length} auto-saves`, 'AutoSave');

    // Process saves in parallel with a limit
    const batchSize = 5;
    for (let i = 0; i < saves.length; i += batchSize) {
      const batch = saves.slice(i, i + batchSize);
      await Promise.all(batch.map(save => this.performSave(save)));
    }
  };

  private async performSave(saveData: AutoSaveData): Promise<any> {
    const { id, data, timestamp, lastModified } = saveData;
    
    try {
      // Check if we already have a save in progress
      if (this.savePromises.has(id)) {
        Logger.debug(`Save already in progress for ${id}`, 'AutoSave');
        return this.savePromises.get(id);
      }

      // Create save promise
      const savePromise = this.saveToServer(id, data, timestamp, lastModified);
      this.savePromises.set(id, savePromise);

      try {
        const result = await savePromise;
        Logger.debug(`Auto-save successful for ${id}`, 'AutoSave');
        return result;
      } finally {
        this.savePromises.delete(id);
      }
    } catch (error) {
      Logger.error(`Auto-save failed for ${id}`, 'AutoSave', { error });
      throw error;
    }
  }

  private async saveToServer(
    id: string,
    data: any,
    timestamp: number,
    lastModified?: number
  ): Promise<any> {
    // Determine the endpoint based on the data type
    const endpoint = this.getSaveEndpoint(id);
    
    const savePayload = {
      id,
      data,
      timestamp,
      lastModified,
      clientTimestamp: Date.now(),
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.getAuthHeader(),
      },
      body: JSON.stringify(savePayload),
    });

    if (!response.ok) {
      throw new Error(`Auto-save failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private getSaveEndpoint(id: string): string {
    // Determine the endpoint based on the ID prefix
    if (id.startsWith('project_')) {
      return `${Environment.getApiUrl()}/projects/auto-save`;
    } else if (id.startsWith('nodes_')) {
      return `${Environment.getApiUrl()}/nodes/auto-save`;
    } else if (id.startsWith('connections_')) {
      return `${Environment.getApiUrl()}/connections/auto-save`;
    } else {
      return `${Environment.getApiUrl()}/auto-save`;
    }
  }

  private getAuthHeader(): string {
    // Get auth token from localStorage or context
    const token = typeof window !== 'undefined' 
      ? localStorage.getItem('supabase.auth.token') 
      : null;
    
    return token ? `Bearer ${token}` : '';
  }

  private retrySave = async (saveData: AutoSaveData, attempt: number = 1): Promise<any> => {
    try {
      return await this.performSave(saveData);
    } catch (error) {
      if (attempt < this.options.maxRetries!) {
        Logger.warn(`Auto-save retry ${attempt} for ${saveData.id}`, 'AutoSave', { error });
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.options.retryDelayMs!));
        return this.retrySave(saveData, attempt + 1);
      } else {
        Logger.error(`Auto-save failed after ${attempt} attempts for ${saveData.id}`, 'AutoSave', { error });
        throw error;
      }
    }
  };

  public save = (
    id: string,
    data: any,
    lastModified?: number,
    immediate: boolean = false
  ): void => {
    const timestamp = Date.now();
    
    // Add to save queue
    this.saveQueue.set(id, {
      id,
      data,
      timestamp,
      lastModified,
    });

    Logger.debug(`Queued auto-save for ${id}`, 'AutoSave');

    if (immediate || this.isOnline) {
      // Process immediately if online or immediate flag is set
      this.processSaveQueue();
    }
  };

  public saveProject = (projectId: string, projectData: any, immediate?: boolean): void => {
    this.save(`project_${projectId}`, projectData, undefined, immediate);
  };

  public saveNodes = (projectId: string, nodesData: any[], immediate?: boolean): void => {
    this.save(`nodes_${projectId}`, nodesData, undefined, immediate);
  };

  public saveConnections = (projectId: string, connectionsData: any[], immediate?: boolean): void => {
    this.save(`connections_${projectId}`, connectionsData, undefined, immediate);
  };

  public getPendingSaves = (): string[] => {
    return Array.from(this.saveQueue.keys());
  };

  public hasPendingSave = (id: string): boolean => {
    return this.saveQueue.has(id) || this.savePromises.has(id);
  };

  public clearPendingSave = (id: string): void => {
    this.saveQueue.delete(id);
  };

  public forceSave = async (): Promise<void> => {
    Logger.info('Force saving all pending data', 'AutoSave');
    await this.processSaveQueue();
  };

  public getStatus = (): {
    isOnline: boolean;
    pendingSaves: number;
    inProgressSaves: number;
  } => {
    return {
      isOnline: this.isOnline,
      pendingSaves: this.saveQueue.size,
      inProgressSaves: this.savePromises.size,
    };
  };

  public destroy = (): void => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
    
    this.saveQueue.clear();
    this.savePromises.clear();
  };
}

export default AutoSaveService;
export type { AutoSaveData, AutoSaveOptions };