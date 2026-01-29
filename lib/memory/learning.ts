/**
 * Learning - Extract facts from conversations and update memory
 * This enables the soulprint to EVOLVE over time from chat interactions
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { createClient } from '@supabase/supabase-js';
import { embedBatch } from './query';

// Initialize Bedrock client
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export type FactCategory = 'preferences' | 'relationships' | 'milestones' | 'beliefs' | 'decisions' | 'events';

export interface LearnedFact {
  fact: string;
  category: FactCategory;
  confidence: number;
  evidence: string;
}

/**
 * Analyze a chat exchange and extract any facts worth remembering
 * This is called after each chat response
 */
export async function extractFactsFromChat(
  userMessage: string,
  assistantResponse: string,
  existingContext?: string
): Promise<LearnedFact[]> {
  const prompt = `Analyze this conversation exchange and extract any durable facts about the user that are worth remembering long-term.

IMPORTANT: Only extract facts that are:
- Clearly stated or strongly implied by the USER (not assumptions)
- Likely to remain true over time (preferences, relationships, life events, decisions)
- Specific and actionable for personalization
- NOT already mentioned in the existing context below

Categories:
- preferences: Likes, dislikes, favorite things, preferred ways of doing things
- relationships: People they know, family, friends, colleagues, pets (with context)
- milestones: Important life events, achievements, significant dates, life changes
- beliefs: Values, opinions, worldviews, principles they hold
- decisions: Choices they've made, plans for the future
- events: Recent or upcoming events in their life

${existingContext ? `EXISTING CONTEXT (do NOT re-extract these):
${existingContext}

---` : ''}

USER MESSAGE:
${userMessage}

ASSISTANT RESPONSE:
${assistantResponse}

---

Extract facts as JSON. If nothing new is worth remembering, return empty array.
Response format:
{
  "facts": [
    {
      "fact": "Concise factual statement about the user",
      "category": "preferences|relationships|milestones|beliefs|decisions|events",
      "confidence": 0.0-1.0,
      "evidence": "The specific text that supports this fact"
    }
  ]
}

Only high-quality, specific facts. Do not speculate. Empty array is fine if nothing notable.`;

  try {
    const command = new InvokeModelCommand({
      modelId: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const content = responseBody.content[0]?.text || '';

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const facts = (parsed.facts || []) as LearnedFact[];
    
    // Filter to high-confidence facts only
    return facts.filter(f => f.confidence >= 0.7 && f.fact && f.category);
  } catch (error) {
    console.error('[Learning] Failed to extract facts:', error);
    return [];
  }
}

/**
 * Store learned facts in the database with embeddings
 */
export async function storeLearnedFacts(
  userId: string,
  facts: LearnedFact[],
  sourceMessageId?: string
): Promise<number> {
  if (facts.length === 0) return 0;

  const supabase = getSupabaseAdmin();

  try {
    // Generate embeddings for all facts
    const factTexts = facts.map(f => `${f.category}: ${f.fact}`);
    const embeddings = await embedBatch(factTexts);

    // Insert facts with embeddings
    const records = facts.map((fact, i) => ({
      user_id: userId,
      fact: fact.fact,
      category: fact.category,
      confidence: fact.confidence,
      evidence: fact.evidence,
      source_type: 'chat' as const,
      source_message_id: sourceMessageId || null,
      embedding: embeddings[i],
      status: 'active' as const,
    }));

    const { error } = await supabase
      .from('learned_facts')
      .insert(records);

    if (error) {
      console.error('[Learning] Failed to store facts:', error);
      return 0;
    }

    console.log(`[Learning] Stored ${facts.length} new facts for user ${userId}`);
    return facts.length;
  } catch (error) {
    console.error('[Learning] Error storing facts:', error);
    return 0;
  }
}

/**
 * Get recent learned facts as context (to avoid re-learning)
 */
export async function getRecentFactsContext(
  userId: string,
  limit: number = 50
): Promise<string> {
  const supabase = getSupabaseAdmin();

  const { data: facts, error } = await supabase
    .from('learned_facts')
    .select('fact, category')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !facts || facts.length === 0) {
    return '';
  }

  return facts
    .map(f => `- [${f.category}] ${f.fact}`)
    .join('\n');
}

/**
 * Process a chat exchange and learn from it
 * Call this after sending a chat response
 */
export async function learnFromChat(
  userId: string,
  userMessage: string,
  assistantResponse: string,
  messageId?: string
): Promise<number> {
  try {
    // Get existing facts to avoid duplicates
    const existingContext = await getRecentFactsContext(userId);
    
    // Extract new facts
    const facts = await extractFactsFromChat(userMessage, assistantResponse, existingContext);
    
    if (facts.length === 0) {
      return 0;
    }

    // Store them
    return await storeLearnedFacts(userId, facts, messageId);
  } catch (error) {
    console.error('[Learning] Error in learnFromChat:', error);
    return 0;
  }
}

/**
 * Search learned facts by vector similarity
 */
export async function searchLearnedFacts(
  userId: string,
  queryEmbedding: number[],
  limit: number = 5,
  threshold: number = 0.5
): Promise<Array<{ fact: string; category: string; similarity: number }>> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.rpc('match_learned_facts', {
    query_embedding: queryEmbedding,
    match_user_id: userId,
    match_count: limit,
    match_threshold: threshold,
  });

  if (error) {
    console.error('[Learning] Search failed:', error);
    return [];
  }

  return data || [];
}
