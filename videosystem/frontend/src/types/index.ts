// Basic type definitions for ViraCut MVP

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  subscription_tier: 'free' | 'pro' | 'enterprise';
  created_at: string;
  updated_at: string;
  last_login?: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  campaign_type: CampaignType;
  aspect_ratio: AspectRatio;
  target_duration: number;
  brand_colors?: string[];
  brand_logo_url?: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export type CampaignType = 'product-launch' | 'social-ad' | 'brand-awareness' | 'event-promotion' | 'educational-content';
export type AspectRatio = '9:16' | '16:9' | '1:1';
export type ProjectStatus = 'draft' | 'processing' | 'completed' | 'error';

export interface Asset {
  id: string;
  project_id: string;
  name: string;
  url: string;
  type: AssetType;
  size: number;
  duration?: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type AssetType = 'video' | 'image' | 'audio';

export interface ExportJob {
  id: string;
  project_id: string;
  settings: ExportSettings;
  status: ExportStatus;
  progress?: number;
  url?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface ExportSettings {
  format: 'mp4' | 'webm';
  resolution: '720p' | '1080p';
  quality: 'low' | 'medium' | 'high';
  frameRate: number;
  audioCodec: 'aac' | 'mp3';
  audioBitrate: number;
  videoBitrate: number;
}

export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';