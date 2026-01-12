/**
 * mem0 Memory Client
 * Production-grade memory system for AI companions
 *
 * mem0 provides:
 * - Automatic fact extraction from conversations
 * - Semantic search over memories
 * - Memory deduplication and merging
 * - User-specific memory isolation
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase for fallback/hybrid storage
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// mem0 configuration
const MEM0_API_KEY = process.env.MEM0_API_KEY;
const MEM0_BASE_URL = process.env.MEM0_SELF_HOSTED_URL || 'https://api.mem0.ai/v1';

export interface Memory {
  id: string;
  memory: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export interface UserMemoryProfile {
  facts: string[];
  preferences: string[];
  personality: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  relationship: {
    trust_level: number;
    conversations: number;
    last_interaction: string;
    relationship_stage: 'new' | 'developing' | 'established' | 'deep';
  };
}

/**
 * Add a memory from a conversation
 */
export async function addMemory(
  userId: string,
  content: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (MEM0_API_KEY) {
    // Use mem0 cloud/self-hosted
    try {
      const response = await fetch(`${MEM0_BASE_URL}/memories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${MEM0_API_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content }],
          user_id: userId,
          metadata,
        }),
      });

      if (!response.ok) {
        console.error('mem0 add failed:', await response.text());
        // Fall back to Supabase
        await addMemoryToSupabase(userId, content, metadata);
      }
    } catch (error) {
      console.error('mem0 add error:', error);
      await addMemoryToSupabase(userId, content, metadata);
    }
  } else {
    // Use Supabase fallback
    await addMemoryToSupabase(userId, content, metadata);
  }
}

/**
 * Add memory to Supabase (fallback)
 */
async function addMemoryToSupabase(
  userId: string,
  content: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  // Extract facts from the content using simple heuristics
  const facts = extractFacts(content);

  for (const fact of facts) {
    await supabase.from('user_memories').insert({
      user_id: userId,
      memory: fact,
      memory_type: 'fact',
      metadata,
      created_at: new Date().toISOString(),
    });
  }
}

/**
 * Simple fact extraction (will be enhanced with LLM)
 */
function extractFacts(content: string): string[] {
  const facts: string[] = [];

  // Look for "I am", "I like", "I prefer", "My name is", etc.
  const patterns = [
    /I am\s+(.+?)(?:\.|,|$)/gi,
    /I like\s+(.+?)(?:\.|,|$)/gi,
    /I prefer\s+(.+?)(?:\.|,|$)/gi,
    /I love\s+(.+?)(?:\.|,|$)/gi,
    /I hate\s+(.+?)(?:\.|,|$)/gi,
    /My name is\s+(.+?)(?:\.|,|$)/gi,
    /I work as\s+(.+?)(?:\.|,|$)/gi,
    /I'm from\s+(.+?)(?:\.|,|$)/gi,
  ];

  for (const pattern of patterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].length > 2) {
        facts.push(match[0].trim());
      }
    }
  }

  return facts;
}

/**
 * Search memories semantically
 */
export async function searchMemories(
  userId: string,
  query: string,
  limit: number = 10
): Promise<string[]> {
  if (MEM0_API_KEY) {
    try {
      const response = await fetch(`${MEM0_BASE_URL}/memories/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${MEM0_API_KEY}`,
        },
        body: JSON.stringify({
          query,
          user_id: userId,
          limit,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.results?.map((r: Memory) => r.memory) || [];
      }
    } catch (error) {
      console.error('mem0 search error:', error);
    }
  }

  // Supabase fallback (simple text search)
  const { data } = await supabase
    .from('user_memories')
    .select('memory')
    .eq('user_id', userId)
    .textSearch('memory', query)
    .limit(limit);

  return data?.map(d => d.memory) || [];
}

/**
 * Get all memories for a user
 */
export async function getAllMemories(userId: string): Promise<string[]> {
  if (MEM0_API_KEY) {
    try {
      const response = await fetch(`${MEM0_BASE_URL}/memories?user_id=${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${MEM0_API_KEY}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.results?.map((r: Memory) => r.memory) || [];
      }
    } catch (error) {
      console.error('mem0 getAll error:', error);
    }
  }

  // Supabase fallback
  const { data } = await supabase
    .from('user_memories')
    .select('memory')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  return data?.map(d => d.memory) || [];
}

/**
 * Get user's full memory profile
 */
export async function getUserMemoryProfile(userId: string): Promise<UserMemoryProfile> {
  const memories = await getAllMemories(userId);

  // Get personality data from soulprint_memory
  const { data: personalityData } = await supabase
    .from('user_personality_profile')
    .select('*')
    .eq('user_id', userId)
    .single();

  // Get relationship stats
  const { data: statsData } = await supabase
    .from('chat_logs')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  const { count } = await supabase
    .from('chat_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const conversationCount = count || 0;
  let relationshipStage: 'new' | 'developing' | 'established' | 'deep' = 'new';
  if (conversationCount > 100) relationshipStage = 'deep';
  else if (conversationCount > 30) relationshipStage = 'established';
  else if (conversationCount > 10) relationshipStage = 'developing';

  return {
    facts: memories.filter(m => !m.toLowerCase().includes('prefer')),
    preferences: memories.filter(m => m.toLowerCase().includes('prefer') || m.toLowerCase().includes('like')),
    personality: personalityData?.personality || {
      openness: 50,
      conscientiousness: 50,
      extraversion: 50,
      agreeableness: 50,
      neuroticism: 50,
    },
    relationship: {
      trust_level: Math.min(100, conversationCount * 2),
      conversations: conversationCount,
      last_interaction: statsData?.[0]?.created_at || new Date().toISOString(),
      relationship_stage: relationshipStage,
    },
  };
}

/**
 * Extract and store memories from a conversation turn
 */
export async function processConversation(
  userId: string,
  userMessage: string,
  assistantResponse: string
): Promise<void> {
  // Add user message to memory
  await addMemory(userId, userMessage, { role: 'user' });

  // Extract any facts the AI mentioned back (validation)
  // This helps reinforce important information
  const factsInResponse = extractFacts(assistantResponse);
  for (const fact of factsInResponse) {
    await addMemory(userId, fact, { role: 'assistant', type: 'reinforced' });
  }
}

/**
 * Delete a specific memory
 */
export async function deleteMemory(userId: string, memoryId: string): Promise<void> {
  if (MEM0_API_KEY) {
    try {
      await fetch(`${MEM0_BASE_URL}/memories/${memoryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Token ${MEM0_API_KEY}`,
        },
      });
    } catch (error) {
      console.error('mem0 delete error:', error);
    }
  }

  // Also delete from Supabase
  await supabase
    .from('user_memories')
    .delete()
    .eq('user_id', userId)
    .eq('id', memoryId);
}

/**
 * Clear all memories for a user
 */
export async function clearAllMemories(userId: string): Promise<void> {
  if (MEM0_API_KEY) {
    try {
      await fetch(`${MEM0_BASE_URL}/memories?user_id=${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Token ${MEM0_API_KEY}`,
        },
      });
    } catch (error) {
      console.error('mem0 clearAll error:', error);
    }
  }

  // Clear from Supabase
  await supabase
    .from('user_memories')
    .delete()
    .eq('user_id', userId);
}
