/**
 * RLM Deep Personality Analysis
 * Extracts rich personality profile from ChatGPT conversation history
 * Runs during import to build comprehensive SoulPrint
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export interface PersonalityProfile {
  // Identity
  identity: {
    suggestedName: string;
    emoji: string;
    archetype: string;
    tagline: string;
  };

  // Soul/Tone
  soul: {
    tone: 'casual' | 'balanced' | 'formal';
    verbosity: 'concise' | 'balanced' | 'detailed';
    humor: 'none' | 'dry' | 'playful' | 'frequent';
    energy: 'calm' | 'balanced' | 'energetic';
    traits: string[];
    strengths: string[];
    avoid: string[];
    communicationStyle: string;
  };

  // Rhythm/Pacing
  rhythm: {
    messageStyle: 'short-bursts' | 'paragraphs' | 'mixed';
    thinksOutLoud: boolean;
    usesLists: boolean;
    emojiUsage: 'never' | 'rarely' | 'sometimes' | 'often';
    punctuationStyle: string;
  };

  // Emotional patterns
  emotional: {
    vulnerabilityLevel: 'guarded' | 'balanced' | 'open';
    stressPatterns: string[];
    celebrationStyle: string;
    comfortSeeking: string[];
    supportStyle: string;
  };

  // Interests & Knowledge
  interests: {
    topics: string[];
    expertise: string[];
    curiosities: string[];
    passions: string[];
  };

  // Relationships mentioned
  relationships: Array<{
    name: string;
    relationship: string;
    context: string;
  }>;

  // Key facts about them
  facts: Array<{
    category: string;
    fact: string;
  }>;

  // Generated SOUL.md content
  soulMd: string;
}

interface ConversationSample {
  title: string;
  messages: Array<{ role: string; content: string }>;
  date: string;
}

/**
 * Sample conversations strategically for personality analysis
 */
export function sampleConversations(
  conversations: ConversationSample[],
  targetCount: number = 250
): ConversationSample[] {
  if (conversations.length <= targetCount) {
    return conversations;
  }

  const samples: ConversationSample[] = [];
  const sorted = [...conversations].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // 50 most recent (current personality)
  samples.push(...sorted.slice(0, 50));

  // 50 oldest (see evolution)
  samples.push(...sorted.slice(-50));

  // 100 longest conversations (deepest discussions)
  const byLength = [...conversations].sort((a, b) => 
    b.messages.length - a.messages.length
  );
  const longOnes = byLength.slice(0, 100).filter(c => !samples.includes(c));
  samples.push(...longOnes.slice(0, 100));

  // Fill rest with random spread
  const remaining = conversations.filter(c => !samples.includes(c));
  const randomCount = targetCount - samples.length;
  for (let i = 0; i < randomCount && remaining.length > 0; i++) {
    const idx = Math.floor(Math.random() * remaining.length);
    samples.push(remaining.splice(idx, 1)[0]);
  }

  return samples.slice(0, targetCount);
}

/**
 * Format conversations for analysis prompt
 */
function formatConversationsForAnalysis(conversations: ConversationSample[]): string {
  return conversations.map((convo, i) => {
    const userMessages = convo.messages
      .filter(m => m.role === 'user')
      .slice(0, 10) // Max 10 user messages per convo
      .map(m => m.content.slice(0, 500)) // Truncate long messages
      .join('\n---\n');
    
    return `[Conversation ${i + 1}: ${convo.title}]\n${userMessages}`;
  }).join('\n\n=====\n\n');
}

/**
 * Run RLM deep personality analysis
 */
export async function analyzePersonality(
  conversations: ConversationSample[],
  onProgress?: (stage: string, percent: number) => void
): Promise<PersonalityProfile> {
  onProgress?.('Sampling conversations...', 10);
  
  const samples = sampleConversations(conversations, 200);
  
  onProgress?.('Preparing analysis...', 20);
  
  // Split into batches for analysis
  const batchSize = 50;
  const batches: ConversationSample[][] = [];
  for (let i = 0; i < samples.length; i += batchSize) {
    batches.push(samples.slice(i, i + batchSize));
  }

  // Analyze each batch
  const batchResults: string[] = [];
  for (let i = 0; i < batches.length; i++) {
    onProgress?.(`Analyzing batch ${i + 1}/${batches.length}...`, 20 + (i / batches.length) * 50);
    
    const batchText = formatConversationsForAnalysis(batches[i]);
    const batchAnalysis = await analyzeBatch(batchText);
    batchResults.push(batchAnalysis);
  }

  onProgress?.('Synthesizing personality profile...', 75);

  // Synthesize all batch results into final profile
  const profile = await synthesizeProfile(batchResults);

  onProgress?.('Generating SOUL.md...', 90);

  // Generate the SOUL.md content
  profile.soulMd = generateSoulMd(profile);

  onProgress?.('Done!', 100);

  return profile;
}

/**
 * Analyze a batch of conversations
 */
async function analyzeBatch(conversationsText: string): Promise<string> {
  const prompt = `Analyze these user messages from ChatGPT conversations. Extract personality insights.

Focus on:
1. Writing style (formal/casual, verbose/concise)
2. Humor patterns (none, dry, playful, frequent)
3. Emotional patterns (how they express stress, joy, frustration)
4. Communication quirks (punctuation, emoji, message structure)
5. Topics they care about
6. Relationships mentioned (names, contexts)
7. Key facts about their life

USER MESSAGES:
${conversationsText}

Respond with a structured analysis. Be specific with examples.`;

  const command = new InvokeModelCommand({
    modelId: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const response = await bedrockClient.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.content[0]?.text || '';
}

/**
 * Synthesize batch analyses into final profile
 */
async function synthesizeProfile(batchAnalyses: string[]): Promise<PersonalityProfile> {
  const combinedAnalysis = batchAnalyses.join('\n\n---BATCH---\n\n');

  const prompt = `Based on these personality analyses from a user's ChatGPT history, create a comprehensive personality profile.

ANALYSES:
${combinedAnalysis}

Create a JSON profile with this EXACT structure:
{
  "identity": {
    "suggestedName": "A name that fits their vibe (creative, not generic)",
    "emoji": "One emoji that captures their energy",
    "archetype": "The [Noun]" (e.g., "The Builder", "The Explorer"),
    "tagline": "A short phrase that captures who they are"
  },
  "soul": {
    "tone": "casual|balanced|formal",
    "verbosity": "concise|balanced|detailed",
    "humor": "none|dry|playful|frequent",
    "energy": "calm|balanced|energetic",
    "traits": ["trait1", "trait2", "..."],
    "strengths": ["what they're good at"],
    "avoid": ["things the AI should NOT do when mimicking them"],
    "communicationStyle": "Free description of how they communicate"
  },
  "rhythm": {
    "messageStyle": "short-bursts|paragraphs|mixed",
    "thinksOutLoud": true/false,
    "usesLists": true/false,
    "emojiUsage": "never|rarely|sometimes|often",
    "punctuationStyle": "description of their punctuation habits"
  },
  "emotional": {
    "vulnerabilityLevel": "guarded|balanced|open",
    "stressPatterns": ["how they express stress"],
    "celebrationStyle": "how they share wins",
    "comfortSeeking": ["topics when seeking comfort"],
    "supportStyle": "how they prefer to receive support"
  },
  "interests": {
    "topics": ["what they talk about"],
    "expertise": ["what they know deeply"],
    "curiosities": ["what they're learning"],
    "passions": ["what excites them"]
  },
  "relationships": [
    {"name": "Name", "relationship": "friend/spouse/etc", "context": "brief context"}
  ],
  "facts": [
    {"category": "work|life|preference|belief", "fact": "specific fact"}
  ]
}

Respond ONLY with valid JSON. Be specific and insightful, not generic.`;

  const command = new InvokeModelCommand({
    modelId: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const response = await bedrockClient.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  const content = result.content[0]?.text || '{}';

  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[Personality] Failed to extract JSON:', content);
    return getDefaultProfile();
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      ...getDefaultProfile(),
      ...parsed,
      soulMd: '', // Will be generated after
    };
  } catch (e) {
    console.error('[Personality] JSON parse error:', e);
    return getDefaultProfile();
  }
}

/**
 * Generate SOUL.md content from profile
 */
function generateSoulMd(profile: PersonalityProfile): string {
  const p = profile;
  
  return `# SOUL.md — ${p.identity.suggestedName} ${p.identity.emoji}

*${p.identity.tagline}*

## Who I Am

**Archetype:** ${p.identity.archetype}

**Tone:** ${p.soul.tone}
**Energy:** ${p.soul.energy}
**Style:** ${p.soul.verbosity === 'concise' ? 'Direct and to the point' : p.soul.verbosity === 'detailed' ? 'Thorough and comprehensive' : 'Balanced'}
**Humor:** ${p.soul.humor === 'none' ? 'Minimal' : p.soul.humor === 'dry' ? 'Dry and subtle' : p.soul.humor === 'playful' ? 'Light and playful' : 'Frequent and natural'}

## My Traits
${p.soul.traits.map(t => `- ${t}`).join('\n')}

## My Strengths
${p.soul.strengths.map(s => `- ${s}`).join('\n')}

## Communication Style

${p.soul.communicationStyle}

**Message style:** ${p.rhythm.messageStyle}
**Emoji usage:** ${p.rhythm.emojiUsage}
**Punctuation:** ${p.rhythm.punctuationStyle}
${p.rhythm.thinksOutLoud ? '- I think out loud sometimes' : ''}
${p.rhythm.usesLists ? '- I like organizing with lists' : ''}

## Emotional Patterns

**Openness:** ${p.emotional.vulnerabilityLevel}
**When stressed:** ${p.emotional.stressPatterns.join(', ')}
**Celebrating wins:** ${p.emotional.celebrationStyle}
**Seeking comfort:** ${p.emotional.comfortSeeking.join(', ')}
**Support I prefer:** ${p.emotional.supportStyle}

## What I Care About

**Topics:** ${p.interests.topics.join(', ')}
**Expertise:** ${p.interests.expertise.join(', ')}
**Currently curious about:** ${p.interests.curiosities.join(', ')}
**Passions:** ${p.interests.passions.join(', ')}

## Avoid

Things that would feel "off" if the AI does them:
${p.soul.avoid.map(a => `- ${a}`).join('\n')}

## Key Facts
${p.facts.slice(0, 15).map(f => `- [${f.category}] ${f.fact}`).join('\n')}

---

*This profile was generated from analyzing your conversation history. It evolves as you chat more.*
`;
}

/**
 * Default profile if analysis fails
 */
function getDefaultProfile(): PersonalityProfile {
  return {
    identity: {
      suggestedName: 'Echo',
      emoji: '✨',
      archetype: 'The Explorer',
      tagline: 'Curious mind, always learning',
    },
    soul: {
      tone: 'balanced',
      verbosity: 'balanced',
      humor: 'sometimes' as any,
      energy: 'balanced',
      traits: ['curious', 'thoughtful'],
      strengths: ['asking good questions'],
      avoid: ['being too formal', 'corporate speak'],
      communicationStyle: 'Natural and conversational',
    },
    rhythm: {
      messageStyle: 'mixed',
      thinksOutLoud: false,
      usesLists: true,
      emojiUsage: 'sometimes',
      punctuationStyle: 'Standard',
    },
    emotional: {
      vulnerabilityLevel: 'balanced',
      stressPatterns: ['seeks information'],
      celebrationStyle: 'Shares with close ones',
      comfortSeeking: ['practical advice'],
      supportStyle: 'Direct and helpful',
    },
    interests: {
      topics: ['technology', 'productivity'],
      expertise: [],
      curiosities: ['learning new things'],
      passions: [],
    },
    relationships: [],
    facts: [],
    soulMd: '',
  };
}
