import { Database } from '@/types/database';

export type Project = Database['public']['Tables']['projects']['Row'];
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

export interface ProjectFormData {
  name: string;
  campaign_type: 'product-launch' | 'social-ad' | 'brand-awareness' | 'event-promotion' | 'educational-content';
  aspect_ratio: '9:16' | '16:9' | '1:1';
  target_duration: 15 | 30 | 60;
  brand_colors?: string[];
  brand_logo_url?: string;
}

export class ProjectModel {
  static create(projectData: ProjectInsert): ProjectInsert {
    return {
      id: projectData.id,
      user_id: projectData.user_id,
      name: projectData.name,
      campaign_type: projectData.campaign_type,
      aspect_ratio: projectData.aspect_ratio,
      target_duration: projectData.target_duration,
      brand_colors: projectData.brand_colors || null,
      brand_logo_url: projectData.brand_logo_url || null,
      status: projectData.status || 'draft',
      created_at: projectData.created_at || new Date().toISOString(),
      updated_at: projectData.updated_at || new Date().toISOString(),
    };
  }

  static update(projectData: Partial<ProjectUpdate>): ProjectUpdate {
    return {
      ...projectData,
      updated_at: new Date().toISOString(),
    };
  }

  static validate(projectData: Partial<ProjectInsert>): string[] {
    const errors: string[] = [];

    if (!projectData.name) {
      errors.push('Project name is required');
    } else if (projectData.name.length > 100) {
      errors.push('Project name must be less than 100 characters');
    }

    if (!projectData.campaign_type) {
      errors.push('Campaign type is required');
    } else if (!['product-launch', 'social-ad', 'brand-awareness', 'event-promotion', 'educational-content'].includes(projectData.campaign_type)) {
      errors.push('Campaign type must be one of: product-launch, social-ad, brand-awareness, event-promotion, educational-content');
    }

    if (!projectData.aspect_ratio) {
      errors.push('Aspect ratio is required');
    } else if (!['9:16', '16:9', '1:1'].includes(projectData.aspect_ratio)) {
      errors.push('Aspect ratio must be one of: 9:16, 16:9, 1:1');
    }

    if (!projectData.target_duration) {
      errors.push('Target duration is required');
    } else if (![15, 30, 60].includes(projectData.target_duration)) {
      errors.push('Target duration must be one of: 15, 30, 60');
    }

    if (projectData.brand_colors && Array.isArray(projectData.brand_colors)) {
      if (projectData.brand_colors.length > 5) {
        errors.push('Brand colors must be less than or equal to 5 colors');
      }
      
      for (const color of projectData.brand_colors) {
        if (typeof color === 'string' && !/^#[0-9A-F]{6}$/i.test(color)) {
          errors.push('Brand colors must be valid hex color codes');
          break;
        }
      }
    }

    return errors;
  }

  static canTransitionTo(currentStatus: string, newStatus: string): boolean {
    const validTransitions: Record<string, string[]> = {
      'draft': ['processing'],
      'processing': ['completed', 'error'],
      'completed': [],
      'error': ['draft', 'processing'],
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  static getAspectRatioLabel(aspectRatio: string): string {
    const labels: Record<string, string> = {
      '9:16': 'Vertical (9:16)',
      '16:9': 'Horizontal (16:9)',
      '1:1': 'Square (1:1)',
    };

    return labels[aspectRatio] || aspectRatio;
  }

  static getCampaignTypeLabel(campaignType: string): string {
    const labels: Record<string, string> = {
      'product-launch': 'Product Launch',
      'social-ad': 'Social Media Ad',
      'brand-awareness': 'Brand Awareness',
      'event-promotion': 'Event Promotion',
      'educational-content': 'Educational Content',
    };

    return labels[campaignType] || campaignType;
  }

  static getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'draft': 'Draft',
      'processing': 'Processing',
      'completed': 'Completed',
      'error': 'Error',
    };

    return labels[status] || status;
  }

  static getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'draft': 'gray',
      'processing': 'blue',
      'completed': 'green',
      'error': 'red',
    };

    return colors[status] || 'gray';
  }

  static getDurationLabel(duration: number): string {
    return `${duration} seconds`;
  }
}

export default ProjectModel;