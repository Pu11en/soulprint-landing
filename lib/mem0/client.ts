/**
 * Mem0 Client for SoulPrint
 * Wraps mem0ai SDK for TypeScript/Next.js
 * Supports both cloud (API key) and OSS (self-hosted) modes
 */

import { ParsedMessage, Mem0Message, toMem0Messages, groupByThread } from './chatgpt-parser';
import {
  mem0AddResponseSchema,
  mem0SearchResponseSchema,
  mem0GetAllResponseSchema,
  mem0DeleteResponseSchema,
  mem0MemorySchema,
} from '@/lib/api/schemas';

export interface Mem0Config {
  mode: 'cloud' | 'oss';
  apiKey?: string;           // Required for cloud mode
  baseUrl?: string;          // Custom API URL
  // OSS mode config
  oss?: {
    embedder?: {
      provider: string;
      config: Record<string, unknown>;
    };
    vectorStore?: {
      provider: string;
      config: Record<string, unknown>;
    };
    llm?: {
      provider: string;
      config: Record<string, unknown>;
    };
  };
}

export interface Memory {
  id: string;
  memory: string;
  hash?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface AddMemoryResult {
  results: Memory[];
  relations?: unknown[];
}

export interface SearchResult {
  results: Array<{
    id: string;
    memory: string;
    score?: number;
    metadata?: Record<string, unknown>;
  }>;
}

const DEFAULT_BASE_URL = 'https://api.mem0.ai';

/**
 * Mem0 Client
 */
export class Mem0Client {
  private config: Mem0Config;
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: Mem0Config) {
    this.config = config;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    
    if (config.mode === 'cloud' && !config.apiKey) {
      throw new Error('API key required for cloud mode');
    }
    
    this.headers = {
      'Content-Type': 'application/json',
      ...(config.apiKey && { 'Authorization': `Token ${config.apiKey}` }),
    };
  }

  /**
   * Add messages to memory
   */
  async add(
    messages: Mem0Message[],
    options: {
      userId: string;
      agentId?: string;
      runId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<AddMemoryResult> {
    const payload = {
      messages,
      user_id: options.userId,
      agent_id: options.agentId,
      run_id: options.runId,
      metadata: options.metadata,
    };

    const response = await fetch(`${this.baseUrl}/v1/memories/`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mem0 API error: ${error}`);
    }

    const raw: unknown = await response.json();
    const parsed = mem0AddResponseSchema.safeParse(raw);
    if (!parsed.success) {
      console.error('[Mem0] Invalid add response:', parsed.error.issues);
      throw new Error('Invalid response from Mem0 API');
    }
    return parsed.data;
  }

  /**
   * Search memories
   */
  async search(
    query: string,
    options: {
      userId: string;
      limit?: number;
      threshold?: number;
    }
  ): Promise<SearchResult> {
    const payload = {
      query,
      user_id: options.userId,
      limit: options.limit || 10,
      threshold: options.threshold || 0.3,
    };

    const response = await fetch(`${this.baseUrl}/v1/memories/search/`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mem0 API error: ${error}`);
    }

    const raw: unknown = await response.json();
    const parsed = mem0SearchResponseSchema.safeParse(raw);
    if (!parsed.success) {
      console.error('[Mem0] Invalid search response:', parsed.error.issues);
      throw new Error('Invalid response from Mem0 API');
    }
    return parsed.data;
  }

  /**
   * Get all memories for a user
   */
  async getAll(options: { userId: string }): Promise<{ results: Memory[] }> {
    const params = new URLSearchParams({ user_id: options.userId });

    const response = await fetch(`${this.baseUrl}/v1/memories/?${params}`, {
      headers: this.headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mem0 API error: ${error}`);
    }

    const raw: unknown = await response.json();
    const parsed = mem0GetAllResponseSchema.safeParse(raw);
    if (!parsed.success) {
      console.error('[Mem0] Invalid getAll response:', parsed.error.issues);
      throw new Error('Invalid response from Mem0 API');
    }
    return parsed.data;
  }

  /**
   * Delete all memories for a user
   */
  async deleteAll(options: { userId: string }): Promise<{ message: string }> {
    const params = new URLSearchParams({ user_id: options.userId });

    const response = await fetch(`${this.baseUrl}/v1/memories/?${params}`, {
      method: 'DELETE',
      headers: this.headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mem0 API error: ${error}`);
    }

    const raw: unknown = await response.json();
    const parsed = mem0DeleteResponseSchema.safeParse(raw);
    if (!parsed.success) {
      console.error('[Mem0] Invalid deleteAll response:', parsed.error.issues);
      throw new Error('Invalid response from Mem0 API');
    }
    return parsed.data;
  }

  /**
   * Get a specific memory by ID
   */
  async get(memoryId: string): Promise<Memory> {
    const response = await fetch(`${this.baseUrl}/v1/memories/${memoryId}/`, {
      headers: this.headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mem0 API error: ${error}`);
    }

    const raw: unknown = await response.json();
    const parsed = mem0MemorySchema.safeParse(raw);
    if (!parsed.success) {
      console.error('[Mem0] Invalid get response:', parsed.error.issues);
      throw new Error('Invalid response from Mem0 API');
    }
    return parsed.data;
  }

  /**
   * Delete a specific memory
   */
  async delete(memoryId: string): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/v1/memories/${memoryId}/`, {
      method: 'DELETE',
      headers: this.headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mem0 API error: ${error}`);
    }

    const raw: unknown = await response.json();
    const parsed = mem0DeleteResponseSchema.safeParse(raw);
    if (!parsed.success) {
      console.error('[Mem0] Invalid delete response:', parsed.error.issues);
      throw new Error('Invalid response from Mem0 API');
    }
    return parsed.data;
  }
}

/**
 * Import helper: Batch import parsed messages to Mem0
 */
export async function importToMem0(
  client: Mem0Client,
  messages: ParsedMessage[],
  userId: string,
  options?: {
    batchSize?: number;
    onProgress?: (processed: number, total: number) => void;
    recentFirst?: boolean;
  }
): Promise<{
  success: number;
  failed: number;
  memories: number;
}> {
  const batchSize = options?.batchSize || 50;
  const threads = groupByThread(messages);
  
  // Sort threads by most recent first if requested
  let threadEntries = Array.from(threads.entries());
  if (options?.recentFirst) {
    threadEntries.sort((a, b) => {
      const aLatest = Math.max(...a[1].map(m => m.createdAt));
      const bLatest = Math.max(...b[1].map(m => m.createdAt));
      return bLatest - aLatest;
    });
  }
  
  let success = 0;
  let failed = 0;
  let totalMemories = 0;
  let processed = 0;
  const total = threadEntries.length;
  
  // Process in batches
  for (let i = 0; i < threadEntries.length; i += batchSize) {
    const batch = threadEntries.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(async ([threadId, threadMessages]) => {
        try {
          const mem0Messages = toMem0Messages(threadMessages);
          const result = await client.add(mem0Messages, {
            userId,
            metadata: {
              source: 'chatgpt-import',
              threadId,
              threadTitle: threadMessages[0]?.threadTitle,
              messageCount: threadMessages.length,
              importedAt: new Date().toISOString(),
            },
          });
          
          success++;
          totalMemories += result.results?.length || 0;
        } catch (error) {
          console.error(`Failed to import thread ${threadId}:`, error);
          failed++;
        }
        
        processed++;
        options?.onProgress?.(processed, total);
      })
    );
  }
  
  return { success, failed, memories: totalMemories };
}

/**
 * Create a configured Mem0 client
 */
export function createMem0Client(apiKey?: string): Mem0Client {
  const key = apiKey || process.env.MEM0_API_KEY;
  
  if (!key) {
    throw new Error('MEM0_API_KEY environment variable or apiKey required');
  }
  
  return new Mem0Client({
    mode: 'cloud',
    apiKey: key,
  });
}
