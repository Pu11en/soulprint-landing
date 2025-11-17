import { Database } from '@/types/database';

export type Connection = Database['public']['Tables']['connections']['Row'];
export type ConnectionInsert = Database['public']['Tables']['connections']['Insert'];
export type ConnectionUpdate = Database['public']['Tables']['connections']['Update'];

export class ConnectionModel {
  static create(connectionData: ConnectionInsert): ConnectionInsert {
    return {
      id: connectionData.id,
      project_id: connectionData.project_id,
      source_node_id: connectionData.source_node_id,
      target_node_id: connectionData.target_node_id,
      source_handle: connectionData.source_handle,
      target_handle: connectionData.target_handle,
      created_at: connectionData.created_at || new Date().toISOString(),
    };
  }

  static update(connectionData: Partial<ConnectionUpdate>): ConnectionUpdate {
    return {
      ...connectionData,
    };
  }

  static validate(connectionData: Partial<ConnectionInsert>): string[] {
    const errors: string[] = [];

    if (!connectionData.source_node_id) {
      errors.push('Source node ID is required');
    }

    if (!connectionData.target_node_id) {
      errors.push('Target node ID is required');
    }

    if (connectionData.source_node_id === connectionData.target_node_id) {
      errors.push('Source and target nodes must be different');
    }

    if (!connectionData.source_handle) {
      errors.push('Source handle is required');
    } else if (connectionData.source_handle.length > 50) {
      errors.push('Source handle must be less than 50 characters');
    }

    if (!connectionData.target_handle) {
      errors.push('Target handle is required');
    } else if (connectionData.target_handle.length > 50) {
      errors.push('Target handle must be less than 50 characters');
    }

    return errors;
  }

  static isValidConnection(
    sourceNodeId: string,
    sourceHandle: string,
    targetNodeId: string,
    targetHandle: string,
    existingConnections: Connection[]
  ): boolean {
    // Check if nodes are different
    if (sourceNodeId === targetNodeId) {
      return false;
    }

    // Check for duplicate connections
    const isDuplicate = existingConnections.some(conn => 
      conn.source_node_id === sourceNodeId &&
      conn.source_handle === sourceHandle &&
      conn.target_node_id === targetNodeId &&
      conn.target_handle === targetHandle
    );

    if (isDuplicate) {
      return false;
    }

    return true;
  }

  static getConnectionId(
    sourceNodeId: string,
    sourceHandle: string,
    targetNodeId: string,
    targetHandle: string
  ): string {
    return `${sourceNodeId}-${sourceHandle}-${targetNodeId}-${targetHandle}`;
  }

  static getHandleType(handle: string): 'input' | 'output' {
    return handle.includes('input') || handle.includes('target') ? 'input' : 'output';
  }

  static getHandleLabel(handle: string): string {
    // Convert handle names to user-friendly labels
    const labels: Record<string, string> = {
      'input': 'Input',
      'output': 'Output',
      'video_input': 'Video Input',
      'video_output': 'Video Output',
      'audio_input': 'Audio Input',
      'audio_output': 'Audio Output',
      'effect_input': 'Effect Input',
      'effect_output': 'Effect Output',
      'text_input': 'Text Input',
      'image_input': 'Image Input',
      'image_output': 'Image Output',
    };

    return labels[handle] || handle;
  }

  static getCompatibleHandles(sourceType: string, targetType: string): {
    source: string[];
    target: string[];
  } {
    // Define which handles are compatible between node types
    const compatibility: Record<string, { source: string[]; target: string[] }> = {
      'video-video': {
        source: ['output', 'video_output'],
        target: ['input', 'video_input']
      },
      'video-effect': {
        source: ['output', 'video_output'],
        target: ['input', 'effect_input']
      },
      'effect-video': {
        source: ['output', 'effect_output'],
        target: ['input', 'video_input']
      },
      'video-text': {
        source: ['output', 'video_output'],
        target: ['input', 'text_input']
      },
      'text-video': {
        source: ['output', 'text_output'],
        target: ['input', 'video_input']
      },
      'video-audio': {
        source: ['output', 'video_output'],
        target: ['input', 'audio_input']
      },
      'audio-video': {
        source: ['output', 'audio_output'],
        target: ['input', 'video_input']
      },
      'image-video': {
        source: ['output', 'image_output'],
        target: ['input', 'video_input']
      },
      'video-image': {
        source: ['output', 'video_output'],
        target: ['input', 'image_input']
      },
    };

    const key = `${sourceType}-${targetType}`;
    return compatibility[key] || { source: [], target: [] };
  }

  static canConnect(sourceType: string, targetType: string): boolean {
    const compatible = this.getCompatibleHandles(sourceType, targetType);
    return compatible.source.length > 0 && compatible.target.length > 0;
  }

  static getConnectionPath(connection: Connection): string {
    return `M${connection.source_node_id} ${connection.target_node_id}`;
  }

  static getConnectionColor(connection: Connection, nodeTypes: Record<string, string>): string {
    // Color code connections based on node types
    const sourceType = nodeTypes[connection.source_node_id];
    const targetType = nodeTypes[connection.target_node_id];

    if (sourceType === 'video' && targetType === 'effect') {
      return '#ff9800'; // Orange
    } else if (sourceType === 'effect' && targetType === 'video') {
      return '#4caf50'; // Green
    } else if (sourceType === 'video' && targetType === 'text') {
      return '#2196f3'; // Blue
    } else if (sourceType === 'text' && targetType === 'video') {
      return '#9c27b0'; // Purple
    } else if (sourceType === 'video' && targetType === 'audio') {
      return '#f44336'; // Red
    } else if (sourceType === 'audio' && targetType === 'video') {
      return '#009688'; // Teal
    } else if (sourceType === 'image' && targetType === 'video') {
      return '#795548'; // Brown
    } else if (sourceType === 'video' && targetType === 'image') {
      return '#607d8b'; // Blue Grey
    }

    return '#666666'; // Default grey
  }

  static isCircular(connections: Connection[], newConnection: ConnectionInsert): boolean {
    // Check if adding this connection would create a circular reference
    const visited = new Set<string>();
    const queue = [newConnection.target_node_id];

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (current === newConnection.source_node_id) {
        return true; // Circular reference detected
      }

      if (visited.has(current)) {
        continue;
      }

      visited.add(current);

      // Add all nodes that current node connects to
      const outgoingConnections = connections.filter(conn => conn.source_node_id === current);
      queue.push(...outgoingConnections.map(conn => conn.target_node_id));
    }

    return false;
  }

  static findPath(
    connections: Connection[],
    startNodeId: string,
    endNodeId: string
  ): Connection[] {
    // Find a path from start to end node using BFS
    const visited = new Set<string>();
    const queue: { nodeId: string; path: Connection[] }[] = [{ nodeId: startNodeId, path: [] }];

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (nodeId === endNodeId) {
        return path;
      }

      if (visited.has(nodeId)) {
        continue;
      }

      visited.add(nodeId);

      // Find all outgoing connections from current node
      const outgoingConnections = connections.filter(conn => conn.source_node_id === nodeId);

      for (const conn of outgoingConnections) {
        if (!visited.has(conn.target_node_id)) {
          queue.push({
            nodeId: conn.target_node_id,
            path: [...path, conn]
          });
        }
      }
    }

    return []; // No path found
  }
}

export default ConnectionModel;