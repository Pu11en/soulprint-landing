import { Database } from '@/types/database';

export type Asset = Database['public']['Tables']['assets']['Row'];
export type AssetInsert = Database['public']['Tables']['assets']['Insert'];
export type AssetUpdate = Database['public']['Tables']['assets']['Update'];

export interface VideoMetadata {
  duration: number;
  dimensions: {
    width: number;
    height: number;
  };
  format: string;
  bitrate: number;
  frameRate: number;
}

export interface ImageMetadata {
  dimensions: {
    width: number;
    height: number;
  };
  format: string;
  colorSpace: string;
  hasTransparency: boolean;
}

export interface AudioMetadata {
  duration: number;
  format: string;
  bitrate: number;
  sampleRate: number;
  channels: number;
}

export type AssetType = 'video' | 'image' | 'audio' | 'logo';

export class AssetModel {
  static create(assetData: AssetInsert): AssetInsert {
    return {
      id: assetData.id,
      project_id: assetData.project_id,
      user_id: assetData.user_id,
      type: assetData.type,
      name: assetData.name,
      url: assetData.url,
      size: assetData.size,
      metadata: assetData.metadata || null,
      created_at: assetData.created_at || new Date().toISOString(),
    };
  }

  static update(assetData: Partial<AssetUpdate>): AssetUpdate {
    return {
      ...assetData,
    };
  }

  static validate(assetData: Partial<AssetInsert>): string[] {
    const errors: string[] = [];

    if (!assetData.type) {
      errors.push('Asset type is required');
    } else if (!['video', 'image', 'audio', 'logo'].includes(assetData.type)) {
      errors.push('Asset type must be one of: video, image, audio, logo');
    }

    if (!assetData.name) {
      errors.push('Asset name is required');
    } else if (assetData.name.length > 255) {
      errors.push('Asset name must be less than 255 characters');
    }

    if (!assetData.url) {
      errors.push('Asset URL is required');
    } else if (!this.isValidUrl(assetData.url)) {
      errors.push('Asset URL must be a valid URL');
    }

    if (typeof assetData.size !== 'number' || assetData.size <= 0) {
      errors.push('Asset size must be a positive number');
    } else if (assetData.size > 524288000) { // 500MB in bytes
      errors.push('Asset size must be less than 500MB');
    }

    return errors;
  }

  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static getTypeLabel(type: AssetType): string {
    const labels: Record<AssetType, string> = {
      'video': 'Video',
      'image': 'Image',
      'audio': 'Audio',
      'logo': 'Logo',
    };

    return labels[type] || type;
  }

  static getTypeIcon(type: AssetType): string {
    const icons: Record<AssetType, string> = {
      'video': '🎥',
      'image': '🖼️',
      'audio': '🎵',
      'logo': '🏷️',
    };

    return icons[type] || '📁';
  }

  static getAllowedTypes(): AssetType[] {
    return ['video', 'image', 'audio', 'logo'];
  }

  static getAllowedMimeTypes(type: AssetType): string[] {
    const mimeTypes: Record<AssetType, string[]> = {
      'video': ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
      'image': ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
      'audio': ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'audio/x-wav'],
      'logo': ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'],
    };

    return mimeTypes[type] || [];
  }

  static getMaxFileSize(type: AssetType): number {
    const sizes: Record<AssetType, number> = {
      'video': 524288000, // 500MB
      'image': 10485760,   // 10MB
      'audio': 52428800,   // 50MB
      'logo': 10485760,    // 10MB
    };

    return sizes[type] || 524288000;
  }

  static getDurationLabel(metadata: VideoMetadata | AudioMetadata): string {
    if (!metadata || !('duration' in metadata)) return 'Unknown';
    
    const duration = metadata.duration;
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  static getDimensionsLabel(metadata: VideoMetadata | ImageMetadata): string {
    if (!metadata || !('dimensions' in metadata)) return 'Unknown';
    
    return `${metadata.dimensions.width}x${metadata.dimensions.height}`;
  }

  static isVideo(asset: Asset): boolean {
    return asset.type === 'video';
  }

  static isImage(asset: Asset): boolean {
    return asset.type === 'image' || asset.type === 'logo';
  }

  static isAudio(asset: Asset): boolean {
    return asset.type === 'audio';
  }

  static getPreviewUrl(asset: Asset): string {
    // For images, return the URL directly
    if (this.isImage(asset)) {
      return asset.url;
    }
    
    // For videos and audio, we would need to generate thumbnails
    // This is a placeholder implementation
    if (this.isVideo(asset)) {
      return asset.url.replace(/\.[^/.]+$/, '.jpg');
    }
    
    if (this.isAudio(asset)) {
      return '/images/audio-placeholder.png';
    }
    
    return asset.url;
  }
}

export default AssetModel;