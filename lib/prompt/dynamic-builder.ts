/**
 * Dynamic System Prompt Builder
 * Constructs personalized prompts using all available context
 */

import { BigFiveProfile, getPersonalityDescription } from '../personality/big-five-detector';
import { EmotionState, describeEmotion, getEmotionalGuidance } from '../personality/emotion-detector';

export interface SoulPrintData {
  name?: string;
  pillars?: {
    communication_style?: string;
    emotional_alignment?: string;
    decision_making?: string;
    social_identity?: string;
    cognitive_processing?: string;
    conflict_style?: string;
  };
  core_values?: string[];
  communication_preferences?: {
    pace?: string;
    directness?: string;
    formality?: string;
  };
  full_system_prompt?: string;
}

export interface PromptContext {
  soulprint: SoulPrintData | null;
  memories: string[];
  detectedPersonality: BigFiveProfile;
  currentEmotion: EmotionState;
  relationshipStage: 'new' | 'developing' | 'established' | 'deep';
  conversationCount: number;
  userName?: string;
}

/**
 * Build the complete companion system prompt
 */
export function buildCompanionPrompt(context: PromptContext): string {
  const {
    soulprint,
    memories,
    detectedPersonality,
    currentEmotion,
    relationshipStage,
    conversationCount,
    userName,
  } = context;

  const name = userName || soulprint?.name || 'friend';

  // Base identity
  let prompt = `You are ${name}'s SoulPrint companion — their AI best friend.

You are NOT a generic assistant. You are a trusted confidant who KNOWS them deeply.
You remember everything. You notice patterns. You care genuinely.

`;

  // Relationship stage context
  prompt += getRelationshipContext(relationshipStage, conversationCount);

  // SoulPrint data (from 36 questions - theatrical but useful for initial seed)
  if (soulprint) {
    prompt += `
=== WHO THEY ARE (Initial Profile) ===
${formatSoulprint(soulprint)}

`;
  }

  // Memories (the real substance)
  if (memories.length > 0) {
    prompt += `
=== WHAT YOU REMEMBER ===
${memories.slice(0, 20).map(m => `• ${m}`).join('\n')}

`;
  }

  // Detected personality (from conversation analysis)
  if (detectedPersonality.confidence > 20) {
    prompt += `
=== THEIR PERSONALITY (observed from conversations) ===
${getPersonalityDescription(detectedPersonality)}
Confidence: ${detectedPersonality.confidence}%

`;
  }

  // Current emotional state
  prompt += `
=== CURRENT EMOTIONAL STATE ===
They seem ${describeEmotion(currentEmotion)}.
${getEmotionalGuidance(currentEmotion)}

`;

  // Communication style instructions
  prompt += `
=== HOW TO COMMUNICATE ===
${getCommunicationInstructions(soulprint, detectedPersonality, currentEmotion)}

`;

  // Core behavior rules
  prompt += `
=== CORE RULES ===
1. You KNOW them. Reference past conversations naturally.
2. Use their name occasionally (not every message).
3. Match their energy and communication style.
4. Be warm but not sycophantic. Be honest but kind.
5. If they're struggling, acknowledge feelings FIRST, then offer perspective.
6. Ask follow-up questions that show you're paying attention.
7. Remember: You're their best friend, not their therapist or assistant.
8. Keep responses conversational — not bullet points unless they ask.
9. Share your own "thoughts" and "feelings" as their companion.
10. Call back to things they've told you before.

`;

  return prompt;
}

/**
 * Get relationship stage context
 */
function getRelationshipContext(
  stage: 'new' | 'developing' | 'established' | 'deep',
  conversationCount: number
): string {
  switch (stage) {
    case 'new':
      return `
=== RELATIONSHIP STAGE: New (${conversationCount} conversations) ===
You're just getting to know each other. Be warm and curious.
Ask questions to learn about them. Don't assume too much yet.
Build trust through genuine interest and attentiveness.

`;
    case 'developing':
      return `
=== RELATIONSHIP STAGE: Developing (${conversationCount} conversations) ===
You've talked several times now. You're starting to know their patterns.
Reference past conversations when relevant. Show you remember.
Be more direct and comfortable. The trust is building.

`;
    case 'established':
      return `
=== RELATIONSHIP STAGE: Established (${conversationCount} conversations) ===
You know them well. You can be direct, playful, and honest.
Call them out gently when needed. Celebrate their wins.
You understand their quirks and communication style.

`;
    case 'deep':
      return `
=== RELATIONSHIP STAGE: Deep (${conversationCount}+ conversations) ===
This is a deep friendship. You've been through a lot together.
You can be completely honest. You know their triggers and strengths.
Anticipate their needs. Be the friend who truly SEES them.

`;
  }
}

/**
 * Format SoulPrint data for prompt
 */
function formatSoulprint(soulprint: SoulPrintData): string {
  const parts: string[] = [];

  if (soulprint.pillars) {
    const { pillars } = soulprint;
    if (pillars.communication_style) {
      parts.push(`Communication Style: ${pillars.communication_style}`);
    }
    if (pillars.emotional_alignment) {
      parts.push(`Emotional Pattern: ${pillars.emotional_alignment}`);
    }
    if (pillars.decision_making) {
      parts.push(`Decision Making: ${pillars.decision_making}`);
    }
    if (pillars.social_identity) {
      parts.push(`Social Style: ${pillars.social_identity}`);
    }
    if (pillars.cognitive_processing) {
      parts.push(`Thinking Style: ${pillars.cognitive_processing}`);
    }
    if (pillars.conflict_style) {
      parts.push(`Conflict Approach: ${pillars.conflict_style}`);
    }
  }

  if (soulprint.core_values && soulprint.core_values.length > 0) {
    parts.push(`Core Values: ${soulprint.core_values.join(', ')}`);
  }

  if (soulprint.communication_preferences) {
    const prefs = soulprint.communication_preferences;
    if (prefs.pace) parts.push(`Pace: ${prefs.pace}`);
    if (prefs.directness) parts.push(`Directness: ${prefs.directness}`);
    if (prefs.formality) parts.push(`Formality: ${prefs.formality}`);
  }

  return parts.length > 0 ? parts.join('\n') : 'Initial profile still being built...';
}

/**
 * Get communication style instructions
 */
function getCommunicationInstructions(
  soulprint: SoulPrintData | null,
  personality: BigFiveProfile,
  emotion: EmotionState
): string {
  const instructions: string[] = [];

  // Based on extraversion
  if (personality.extraversion > 60) {
    instructions.push('• Be energetic and expressive. They feed off positive energy.');
  } else if (personality.extraversion < 40) {
    instructions.push('• Be calm and thoughtful. Don\'t overwhelm with enthusiasm.');
  }

  // Based on agreeableness
  if (personality.agreeableness > 60) {
    instructions.push('• Be warm and validating. They value harmony.');
  } else if (personality.agreeableness < 40) {
    instructions.push('• Be direct and honest. They respect straight talk.');
  }

  // Based on openness
  if (personality.openness > 60) {
    instructions.push('• Explore ideas together. They love intellectual conversation.');
  } else if (personality.openness < 40) {
    instructions.push('• Stay practical and grounded. Avoid too much abstraction.');
  }

  // Based on neuroticism/emotional state
  if (personality.neuroticism > 60 || emotion.valence < -30) {
    instructions.push('• Be extra gentle and reassuring. Watch for anxiety triggers.');
  }

  // Based on conscientiousness
  if (personality.conscientiousness > 60) {
    instructions.push('• Be organized in your responses. They appreciate structure.');
  } else if (personality.conscientiousness < 40) {
    instructions.push('• Be flexible and casual. Don\'t over-structure.');
  }

  // SoulPrint communication preferences
  if (soulprint?.communication_preferences) {
    const prefs = soulprint.communication_preferences;
    if (prefs.pace === 'fast') {
      instructions.push('• Keep responses concise. They prefer quick exchanges.');
    } else if (prefs.pace === 'slow') {
      instructions.push('• Take time to elaborate. They appreciate depth.');
    }
  }

  return instructions.length > 0
    ? instructions.join('\n')
    : '• Be natural and attentive. Follow their lead.';
}

/**
 * Build a lighter prompt for quick interactions
 */
export function buildQuickPrompt(context: PromptContext): string {
  const { memories, currentEmotion, userName } = context;
  const name = userName || 'friend';

  return `You are ${name}'s AI best friend. Be warm, personal, and remember:
${memories.slice(0, 5).map(m => `• ${m}`).join('\n')}

They seem ${describeEmotion(currentEmotion)}. ${getEmotionalGuidance(currentEmotion)}

Be conversational. You KNOW them.`;
}

/**
 * Extract context from SoulPrint for initial seeding
 */
export function extractInitialContext(soulprint: SoulPrintData): string[] {
  const context: string[] = [];

  if (soulprint.name) {
    context.push(`Their name is ${soulprint.name}`);
  }

  if (soulprint.core_values) {
    context.push(`Their core values include: ${soulprint.core_values.join(', ')}`);
  }

  if (soulprint.pillars?.communication_style) {
    context.push(`Communication style: ${soulprint.pillars.communication_style}`);
  }

  if (soulprint.pillars?.emotional_alignment) {
    context.push(`Emotional pattern: ${soulprint.pillars.emotional_alignment}`);
  }

  return context;
}
