import { Database } from '@/types/database';

export type Export = Database['public']['Tables']['exports']['Row'];
export type ExportInsert = Database['public']['Tables']['exports']['Insert'];
export type ExportUpdate = Database['public']['Tables']['exports']['Update'];

export interface ExportSettings {
  format: 'mp4' | 'webm';
  resolution: '720p' | '1080p';
  quality: 'high' | 'medium' | 'low';
  frameRate: 24 | 30 | 60;
  audioCodec: 'aac';
  audioBitrate: number;
  videoBitrate: number;
}

export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export class ExportModel {
  static create(exportData: ExportInsert): ExportInsert {
    return {
      id: exportData.id,
      project_id: exportData.project_id,
      settings: exportData.settings,
      status: exportData.status || 'pending',
      url: exportData.url || null,
      size: exportData.size || null,
      error_message: exportData.error_message || null,
      created_at: exportData.created_at || new Date().toISOString(),
      completed_at: exportData.completed_at || null,
    };
  }

  static update(exportData: Partial<ExportUpdate>): ExportUpdate {
    return {
      ...exportData,
    };
  }

  static validate(exportData: Partial<ExportInsert>): string[] {
    const errors: string[] = [];

    if (!exportData.settings) {
      errors.push('Export settings are required');
    } else {
      const settings = exportData.settings as any;
      
      if (!settings.format || !['mp4', 'webm'].includes(settings.format)) {
        errors.push('Export format must be one of: mp4, webm');
      }
      
      if (!settings.resolution || !['720p', '1080p'].includes(settings.resolution)) {
        errors.push('Export resolution must be one of: 720p, 1080p');
      }
      
      if (!settings.quality || !['high', 'medium', 'low'].includes(settings.quality)) {
        errors.push('Export quality must be one of: high, medium, low');
      }
      
      if (!settings.frameRate || ![24, 30, 60].includes(settings.frameRate)) {
        errors.push('Export frame rate must be one of: 24, 30, 60');
      }
      
      if (!settings.audioCodec || settings.audioCodec !== 'aac') {
        errors.push('Export audio codec must be aac');
      }
      
      if (typeof settings.audioBitrate !== 'number' || settings.audioBitrate <= 0 || settings.audioBitrate > 320) {
        errors.push('Export audio bitrate must be between 1 and 320');
      }
      
      if (typeof settings.videoBitrate !== 'number' || settings.videoBitrate <= 0 || settings.videoBitrate > 10000) {
        errors.push('Export video bitrate must be between 1 and 10000');
      }
    }

    return errors;
  }

  static canTransitionTo(currentStatus: string, newStatus: string): boolean {
    const validTransitions: Record<string, string[]> = {
      'pending': ['processing', 'failed'],
      'processing': ['completed', 'failed'],
      'completed': [],
      'failed': ['pending'],
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  static getStatusLabel(status: ExportStatus): string {
    const labels: Record<ExportStatus, string> = {
      'pending': 'Pending',
      'processing': 'Processing',
      'completed': 'Completed',
      'failed': 'Failed',
    };

    return labels[status] || status;
  }

  static getStatusColor(status: ExportStatus): string {
    const colors: Record<ExportStatus, string> = {
      'pending': 'yellow',
      'processing': 'blue',
      'completed': 'green',
      'failed': 'red',
    };

    return colors[status] || 'gray';
  }

  static getFormatLabel(format: string): string {
    const labels: Record<string, string> = {
      'mp4': 'MP4',
      'webm': 'WebM',
    };

    return labels[format] || format;
  }

  static getResolutionLabel(resolution: string): string {
    const labels: Record<string, string> = {
      '720p': '720p (HD)',
      '1080p': '1080p (Full HD)',
    };

    return labels[resolution] || resolution;
  }

  static getQualityLabel(quality: string): string {
    const labels: Record<string, string> = {
      'high': 'High',
      'medium': 'Medium',
      'low': 'Low',
    };

    return labels[quality] || quality;
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static getEstimatedFileSize(settings: ExportSettings, duration: number): number {
    // Rough estimation based on settings and duration
    const baseBitrate = settings.videoBitrate + settings.audioBitrate;
    const qualityMultiplier = settings.quality === 'high' ? 1.2 : settings.quality === 'low' ? 0.8 : 1;
    const resolutionMultiplier = settings.resolution === '1080p' ? 1.5 : 1;
    const frameRateMultiplier = settings.frameRate / 30; // Normalize to 30fps
    
    const estimatedBitrate = baseBitrate * qualityMultiplier * resolutionMultiplier * frameRateMultiplier;
    const estimatedBytesPerSecond = estimatedBitrate * 1000 / 8; // Convert to bytes per second
    
    return Math.round(estimatedBytesPerSecond * duration);
  }

  static getEstimatedProcessingTime(settings: ExportSettings, duration: number): number {
    // Rough estimation in seconds based on settings and duration
    const baseTime = duration * 0.5; // Base processing time is 50% of video duration
    const qualityMultiplier = settings.quality === 'high' ? 1.5 : settings.quality === 'low' ? 0.7 : 1;
    const resolutionMultiplier = settings.resolution === '1080p' ? 1.8 : 1;
    const frameRateMultiplier = settings.frameRate === 60 ? 1.3 : settings.frameRate === 24 ? 0.9 : 1;
    
    return Math.round(baseTime * qualityMultiplier * resolutionMultiplier * frameRateMultiplier);
  }

  static isCompleted(exportData: Export): boolean {
    return exportData.status === 'completed';
  }

  static isProcessing(exportData: Export): boolean {
    return exportData.status === 'processing';
  }

  static isFailed(exportData: Export): boolean {
    return exportData.status === 'failed';
  }

  static isPending(exportData: Export): boolean {
    return exportData.status === 'pending';
  }

  static getDownloadUrl(exportData: Export): string | null {
    return exportData.url;
  }

  static getErrorMessage(exportData: Export): string | null {
    return exportData.error_message;
  }
}

export default ExportModel;