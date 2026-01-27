import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type { MemoryChunk } from './query';

// Initialize Bedrock client
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export type FactCategory = 'preferences' | 'relationships' | 'milestones' | 'beliefs';

export interface ExtractedFact {
  category: FactCategory;
  fact: string;
  confidence: number; // 0-1
  sourceChunkId: string;
  evidence: string; // The relevant snippet from the source
}

/**
 * Extract durable facts from memory chunks using Bedrock Claude
 */
export async function extractFacts(chunks: MemoryChunk[]): Promise<ExtractedFact[]> {
  if (chunks.length === 0) {
    return [];
  }

  const chunksText = chunks
    .map((chunk, i) => `[Chunk ${chunk.id}]\n${chunk.content}`)
    .join('\n\n---\n\n');

  const prompt = `Analyze the following memory chunks and extract durable facts about the person. Focus on facts that are likely to remain true over time.

Categories to extract:
- preferences: Likes, dislikes, favorite things, preferred ways of doing things
- relationships: People they know, family, friends, colleagues, pets
- milestones: Important life events, achievements, significant dates
- beliefs: Values, opinions, worldviews, principles they hold

For each fact, provide:
1. The category
2. The fact statement (concise, factual)
3. Confidence score (0.0-1.0) based on how clearly stated/implied
4. The chunk ID it came from
5. A brief quote or evidence from the source

Memory Chunks:
${chunksText}

Respond in JSON format:
{
  "facts": [
    {
      "category": "preferences",
      "fact": "Prefers morning workouts",
      "confidence": 0.85,
      "sourceChunkId": "chunk-123",
      "evidence": "I always feel better when I exercise in the morning"
    }
  ]
}

Only extract facts that are clearly stated or strongly implied. Do not speculate.`;

  const command = new InvokeModelCommand({
    modelId: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  try {
    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const content = responseBody.content[0]?.text || '';
    
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', content);
      return [];
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    return (parsed.facts || []) as ExtractedFact[];
  } catch (error) {
    console.error('Failed to extract facts:', error);
    return [];
  }
}

/**
 * Group facts by category
 */
export function groupFactsByCategory(
  facts: ExtractedFact[]
): Record<FactCategory, ExtractedFact[]> {
  return {
    preferences: facts.filter((f) => f.category === 'preferences'),
    relationships: facts.filter((f) => f.category === 'relationships'),
    milestones: facts.filter((f) => f.category === 'milestones'),
    beliefs: facts.filter((f) => f.category === 'beliefs'),
  };
}

/**
 * Get high-confidence facts only
 */
export function getHighConfidenceFacts(
  facts: ExtractedFact[],
  threshold: number = 0.7
): ExtractedFact[] {
  return facts.filter((f) => f.confidence >= threshold);
}
