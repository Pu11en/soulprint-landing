import logger from '@/utils/logger';

// Omniclip SDK types (based on typical video processing SDK structure)
export interface VideoClip {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  thumbnail?: string;
  metadata?: Record<string, any>;
}

export interface VideoProject {
  id: string;
  name: string;
  duration: number;
  clips: VideoClip[];
  createdAt: string;
  updatedAt: string;
}

export interface ProcessingOptions {
  format?: 'mp4' | 'webm' | 'mov';
  quality?: 'low' | 'medium' | 'high';
  resolution?: '720p' | '1080p' | '4k';
  watermark?: boolean;
  compression?: number; // 0-100
}

export interface ProcessingResult {
  success: boolean;
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  error?: string;
  jobId?: string;
}

export interface ProcessingStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number; // 0-100
  result?: ProcessingResult;
  error?: string;
}

class OmniclipService {
  private apiKey: string;
  private baseUrl: string;
  private isInitialized = false;

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_OMNICLIP_API_KEY || '';
    this.baseUrl = process.env.NEXT_PUBLIC_OMNICLIP_API_URL || 'https://api.omniclip.com/v1';
    
    if (!this.apiKey) {
      logger.warn('Omniclip API key not configured');
    } else {
      this.isInitialized = true;
      logger.info('Omniclip service initialized');
    }
  }

  // Initialize a new video project
  async initializeProject(projectName: string): Promise<{ projectId?: string; error?: string }> {
    if (!this.isInitialized) {
      return { error: 'Omniclip service not initialized' };
    }

    try {
      logger.info(`Initializing Omniclip project: ${projectName}`);

      const response = await fetch(`${this.baseUrl}/projects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error('Failed to initialize Omniclip project', errorData);
        return { error: errorData.message || 'Failed to initialize project' };
      }

      const data = await response.json();
      logger.info(`Omniclip project initialized successfully: ${data.id}`);
      return { projectId: data.id };
    } catch (error) {
      logger.error(`Error initializing Omniclip project: ${error instanceof Error ? error.message : String(error)}`);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Process video with Omniclip
  async processVideo(
    projectId: string,
    videoUrl: string,
    options: ProcessingOptions = {}
  ): Promise<{ result?: ProcessingResult; error?: string }> {
    if (!this.isInitialized) {
      return { error: 'Omniclip service not initialized' };
    }

    try {
      logger.info(`Processing video with Omniclip: ${videoUrl}`, JSON.stringify({ projectId, videoUrl, options }));

      const response = await fetch(`${this.baseUrl}/projects/${projectId}/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoUrl,
          options,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error('Failed to process video with Omniclip', errorData);
        return { error: errorData.message || 'Failed to process video' };
      }

      const data = await response.json();
      logger.info(`Video processing started with Omniclip: ${data.jobId}`);
      return { result: data };
    } catch (error) {
      logger.error(`Error processing video with Omniclip: ${error instanceof Error ? error.message : String(error)}`);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Get processing status
  async getProcessingStatus(jobId: string): Promise<{ status?: ProcessingStatus; error?: string }> {
    if (!this.isInitialized) {
      return { error: 'Omniclip service not initialized' };
    }

    try {
      logger.info(`Checking Omniclip processing status: ${jobId}`);

      const response = await fetch(`${this.baseUrl}/jobs/${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error('Failed to get processing status', errorData);
        return { error: errorData.message || 'Failed to get processing status' };
      }

      const data = await response.json();
      return { status: data };
    } catch (error) {
      logger.error(`Error getting processing status: ${error instanceof Error ? error.message : String(error)}`);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Create video clips
  async createClips(
    projectId: string,
    clips: Array<{
      startTime: number;
      endTime: number;
      metadata?: Record<string, any>;
    }>
  ): Promise<{ clips?: VideoClip[]; error?: string }> {
    if (!this.isInitialized) {
      return { error: 'Omniclip service not initialized' };
    }

    try {
      logger.info(`Creating video clips: ${clips.length} clips`, JSON.stringify({ projectId, clipCount: clips.length }));

      const response = await fetch(`${this.baseUrl}/projects/${projectId}/clips`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clips }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error('Failed to create clips', errorData);
        return { error: errorData.message || 'Failed to create clips' };
      }

      const data = await response.json();
      logger.info(`Video clips created successfully: ${data.length} clips`);
      return { clips: data };
    } catch (error) {
      logger.error(`Error creating clips: ${error instanceof Error ? error.message : String(error)}`);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Export video
  async exportVideo(
    projectId: string,
    options: ProcessingOptions = {}
  ): Promise<{ result?: ProcessingResult; error?: string }> {
    if (!this.isInitialized) {
      return { error: 'Omniclip service not initialized' };
    }

    try {
      logger.info(`Exporting video: ${projectId}`, JSON.stringify({ projectId, options }));

      const response = await fetch(`${this.baseUrl}/projects/${projectId}/export`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ options }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error('Failed to export video', errorData);
        return { error: errorData.message || 'Failed to export video' };
      }

      const data = await response.json();
      logger.info(`Video exported successfully: ${data.videoUrl}`);
      return { result: data };
    } catch (error) {
      logger.error(`Error exporting video: ${error instanceof Error ? error.message : String(error)}`);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Delete project
  async deleteProject(projectId: string): Promise<{ error?: string }> {
    if (!this.isInitialized) {
      return { error: 'Omniclip service not initialized' };
    }

    try {
      logger.info(`Deleting Omniclip project: ${projectId}`);

      const response = await fetch(`${this.baseUrl}/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error('Failed to delete project', errorData);
        return { error: errorData.message || 'Failed to delete project' };
      }

      logger.info(`Omniclip project deleted successfully: ${projectId}`);
      return {};
    } catch (error) {
      logger.error(`Error deleting project: ${error instanceof Error ? error.message : String(error)}`);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Get project details
  async getProject(projectId: string): Promise<{ project?: VideoProject; error?: string }> {
    if (!this.isInitialized) {
      return { error: 'Omniclip service not initialized' };
    }

    try {
      logger.info(`Getting Omniclip project details: ${projectId}`);

      const response = await fetch(`${this.baseUrl}/projects/${projectId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error('Failed to get project details', errorData);
        return { error: errorData.message || 'Failed to get project details' };
      }

      const data = await response.json();
      return { project: data };
    } catch (error) {
      logger.error(`Error getting project details: ${error instanceof Error ? error.message : String(error)}`);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Singleton instance
export const omniclipService = new OmniclipService();

export default omniclipService;