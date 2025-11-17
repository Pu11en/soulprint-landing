import { Database } from '@/types/database';

export type Node = Database['public']['Tables']['nodes']['Row'];
export type NodeInsert = Database['public']['Tables']['nodes']['Insert'];
export type NodeUpdate = Database['public']['Tables']['nodes']['Update'];

export interface NodePosition {
  x: number;
  y: number;
}

export interface NodeConfig {
  width: number;
  height: number;
  style: Record<string, any>;
}

export interface VideoNodeData {
  source: string;
  trimStart: number;
  trimEnd: number;
  brightness: number;
  contrast: number;
}

export interface TextNodeData {
  content: string;
  font: string;
  fontSize: number;
  color: string;
  animation: 'fade' | 'slide' | 'typewriter';
  position: NodePosition;
}

export interface AudioNodeData {
  source: string;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  trimStart: number;
  trimEnd: number;
}

export interface EffectNodeData {
  type: string;
  subtype: string;
  intensity: number;
  duration: number;
}

export type NodeType = 'video' | 'image' | 'text' | 'audio' | 'effect' | 'shape' | 'logo' | 'timing' | 'export' | 'comment';

export class NodeModel {
  static create(nodeData: NodeInsert): NodeInsert {
    return {
      id: nodeData.id,
      project_id: nodeData.project_id,
      type: nodeData.type,
      position: nodeData.position,
      data: nodeData.data,
      config: nodeData.config,
      created_at: nodeData.created_at || new Date().toISOString(),
      updated_at: nodeData.updated_at || new Date().toISOString(),
    };
  }

  static update(nodeData: Partial<NodeUpdate>): NodeUpdate {
    return {
      ...nodeData,
      updated_at: new Date().toISOString(),
    };
  }

  static validate(nodeData: Partial<NodeInsert>): string[] {
    const errors: string[] = [];

    if (!nodeData.type) {
      errors.push('Node type is required');
    } else if (!['video', 'image', 'text', 'audio', 'effect', 'shape', 'logo', 'timing', 'export', 'comment'].includes(nodeData.type)) {
      errors.push('Node type must be one of: video, image, text, audio, effect, shape, logo, timing, export, comment');
    }

    if (!nodeData.position) {
      errors.push('Node position is required');
    } else {
      const position = nodeData.position as any;
      if (typeof position.x !== 'number' || typeof position.y !== 'number') {
        errors.push('Node position must contain valid x and y coordinates');
      }
    }

    if (!nodeData.data) {
      errors.push('Node data is required');
    }

    if (!nodeData.config) {
      errors.push('Node config is required');
    } else {
      const config = nodeData.config as any;
      if (typeof config.width !== 'number' || config.width <= 0) {
        errors.push('Node config must contain a valid width');
      }
      if (typeof config.height !== 'number' || config.height <= 0) {
        errors.push('Node config must contain a valid height');
      }
      if (!config.style || typeof config.style !== 'object') {
        errors.push('Node config must contain style properties');
      }
    }

    return errors;
  }

  static validateNodeData(type: NodeType, data: any): string[] {
    const errors: string[] = [];

    switch (type) {
      case 'video':
        const videoData = data as VideoNodeData;
        if (!videoData.source) errors.push('Video source is required');
        if (typeof videoData.trimStart !== 'number' || videoData.trimStart < 0) {
          errors.push('Video trim start must be a positive number');
        }
        if (typeof videoData.trimEnd !== 'number' || videoData.trimEnd <= videoData.trimStart) {
          errors.push('Video trim end must be greater than trim start');
        }
        if (typeof videoData.brightness !== 'number' || videoData.brightness < 0 || videoData.brightness > 200) {
          errors.push('Video brightness must be between 0 and 200');
        }
        if (typeof videoData.contrast !== 'number' || videoData.contrast < 0 || videoData.contrast > 200) {
          errors.push('Video contrast must be between 0 and 200');
        }
        break;

      case 'text':
        const textData = data as TextNodeData;
        if (!textData.content) errors.push('Text content is required');
        if (!textData.font) errors.push('Text font is required');
        if (typeof textData.fontSize !== 'number' || textData.fontSize <= 0) {
          errors.push('Text font size must be a positive number');
        }
        if (!textData.color) errors.push('Text color is required');
        if (!/^#[0-9A-F]{6}$/i.test(textData.color)) {
          errors.push('Text color must be a valid hex color');
        }
        if (!['fade', 'slide', 'typewriter'].includes(textData.animation)) {
          errors.push('Text animation must be one of: fade, slide, typewriter');
        }
        break;

      case 'audio':
        const audioData = data as AudioNodeData;
        if (!audioData.source) errors.push('Audio source is required');
        if (typeof audioData.volume !== 'number' || audioData.volume < 0 || audioData.volume > 100) {
          errors.push('Audio volume must be between 0 and 100');
        }
        if (typeof audioData.fadeIn !== 'number' || audioData.fadeIn < 0) {
          errors.push('Audio fade in must be a positive number');
        }
        if (typeof audioData.fadeOut !== 'number' || audioData.fadeOut < 0) {
          errors.push('Audio fade out must be a positive number');
        }
        break;

      case 'effect':
        const effectData = data as EffectNodeData;
        if (!effectData.type) errors.push('Effect type is required');
        if (!effectData.subtype) errors.push('Effect subtype is required');
        if (typeof effectData.intensity !== 'number' || effectData.intensity < 0 || effectData.intensity > 100) {
          errors.push('Effect intensity must be between 0 and 100');
        }
        if (typeof effectData.duration !== 'number' || effectData.duration <= 0) {
          errors.push('Effect duration must be a positive number');
        }
        break;
    }

    return errors;
  }

  static getTypeLabel(type: NodeType): string {
    const labels: Record<NodeType, string> = {
      'video': 'Video',
      'image': 'Image',
      'text': 'Text',
      'audio': 'Audio',
      'effect': 'Effect',
      'shape': 'Shape',
      'logo': 'Logo',
      'timing': 'Timing',
      'export': 'Export',
      'comment': 'Comment',
    };

    return labels[type] || type;
  }

  static getTypeIcon(type: NodeType): string {
    const icons: Record<NodeType, string> = {
      'video': '🎥',
      'image': '🖼️',
      'text': '📝',
      'audio': '🎵',
      'effect': '✨',
      'shape': '⬜',
      'logo': '🏷️',
      'timing': '⏱️',
      'export': '📤',
      'comment': '💬',
    };

    return icons[type] || '📦';
  }

  static getDefaultConfig(type: NodeType): NodeConfig {
    const configs: Record<NodeType, NodeConfig> = {
      'video': { width: 200, height: 150, style: { backgroundColor: '#f0f0f0', border: '2px solid #ccc' } },
      'image': { width: 180, height: 180, style: { backgroundColor: '#f8f8f8', borderRadius: '8px' } },
      'text': { width: 200, height: 80, style: { backgroundColor: '#ffffff', border: '1px solid #ddd' } },
      'audio': { width: 160, height: 100, style: { backgroundColor: '#e8f5e8', border: '1px solid #4caf50' } },
      'effect': { width: 140, height: 100, style: { backgroundColor: '#fff3e0', border: '1px solid #ff9800' } },
      'shape': { width: 120, height: 120, style: { backgroundColor: '#f3e5f5', border: '1px solid #9c27b0' } },
      'logo': { width: 100, height: 100, style: { backgroundColor: '#e3f2fd', border: '1px solid #2196f3' } },
      'timing': { width: 140, height: 80, style: { backgroundColor: '#fce4ec', border: '1px solid #e91e63' } },
      'export': { width: 160, height: 100, style: { backgroundColor: '#e8eaf6', border: '1px solid #3f51b5' } },
      'comment': { width: 180, height: 100, style: { backgroundColor: '#fff8e1', border: '1px solid #ffc107' } },
    };

    return configs[type] || { width: 150, height: 100, style: { backgroundColor: '#f5f5f5', border: '1px solid #ccc' } };
  }
}

export default NodeModel;