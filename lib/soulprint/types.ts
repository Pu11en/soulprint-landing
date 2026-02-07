/**
 * SoulPrint Core Types
 * Shared types for the entire SoulPrint system
 */

import { z } from 'zod';

// ============================================
// QUICK PASS TYPES (v1.2 structured sections)
// ============================================

export interface ConversationMessage {
  role: string;
  content: string;
}

export interface ParsedConversation {
  id: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: string;
}

export interface SoulSection {
  communication_style: string;
  personality_traits: string[];
  tone_preferences: string;
  boundaries: string;
  humor_style: string;
  formality_level: string;
  emotional_patterns: string;
}

export interface IdentitySection {
  ai_name: string;
  archetype: string;
  vibe: string;
  emoji_style: string;
  signature_greeting: string;
}

export interface UserSection {
  name: string;
  location: string;
  occupation: string;
  relationships: string[];
  interests: string[];
  life_context: string;
  preferred_address: string;
}

export interface AgentsSection {
  response_style: string;
  behavioral_rules: string[];
  context_adaptation: string;
  memory_directives: string;
  do_not: string[];
}

export interface ToolsSection {
  likely_usage: string[];
  capabilities_emphasis: string[];
  output_preferences: string;
  depth_preference: string;
}

export interface QuickPassResult {
  soul: SoulSection;
  identity: IdentitySection;
  user: UserSection;
  agents: AgentsSection;
  tools: ToolsSection;
}

// ============================================
// QUICK PASS ZOD SCHEMA (permissive defaults)
// ============================================

const soulSectionSchema = z.object({
  communication_style: z.string().default(''),
  personality_traits: z.array(z.string()).default([]),
  tone_preferences: z.string().default(''),
  boundaries: z.string().default(''),
  humor_style: z.string().default(''),
  formality_level: z.string().default(''),
  emotional_patterns: z.string().default(''),
});

const identitySectionSchema = z.object({
  ai_name: z.string().default(''),
  archetype: z.string().default(''),
  vibe: z.string().default(''),
  emoji_style: z.string().default(''),
  signature_greeting: z.string().default(''),
});

const userSectionSchema = z.object({
  name: z.string().default(''),
  location: z.string().default(''),
  occupation: z.string().default(''),
  relationships: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
  life_context: z.string().default(''),
  preferred_address: z.string().default(''),
});

const agentsSectionSchema = z.object({
  response_style: z.string().default(''),
  behavioral_rules: z.array(z.string()).default([]),
  context_adaptation: z.string().default(''),
  memory_directives: z.string().default(''),
  do_not: z.array(z.string()).default([]),
});

const toolsSectionSchema = z.object({
  likely_usage: z.array(z.string()).default([]),
  capabilities_emphasis: z.array(z.string()).default([]),
  output_preferences: z.string().default(''),
  depth_preference: z.string().default(''),
});

export const quickPassResultSchema = z.object({
  soul: z.preprocess((val) => val ?? {}, soulSectionSchema),
  identity: z.preprocess((val) => val ?? {}, identitySectionSchema),
  user: z.preprocess((val) => val ?? {}, userSectionSchema),
  agents: z.preprocess((val) => val ?? {}, agentsSectionSchema),
  tools: z.preprocess((val) => val ?? {}, toolsSectionSchema),
});

// ============================================
// PILLAR TYPES
// ============================================

export type QuestionType = 'slider' | 'text';

export interface PillarAnswer {
  questionIndex: number;
  pillar: number;
  questionType: QuestionType;
  sliderValue?: number;
  textValue?: string;
}

export interface PillarSummary {
  communication: string;
  emotional: string;
  decision: string;
  social: string;
  cognitive: string;
  conflict: string;
}

export interface CoreAlignment {
  expressionVsRestraint: number;  // 0-1
  instinctVsAnalysis: number;     // 0-1
  autonomyVsCollaboration: number; // 0-1
}

export interface MicroStory {
  pillar: number;
  pillarName: string;
  storyText: string;
  wordCount: number;
}

// ============================================
// VOICE TYPES
// ============================================

export interface CadenceMarkers {
  pausePoints: number[];           // Timestamps in seconds
  emphasisWords: string[];         // Words with emphasis
  tempoVariance: number;           // 0-1 consistency score
  averageWordsPerMinute: number;
  emotionalPeaks: number[];        // Timestamps of emotional moments
  toneShifts: Array<{
    time: number;
    from: string;
    to: string;
  }>;
}

export interface VoiceRecording {
  pillar: number;
  cloudinaryUrl: string;
  cloudinaryPublicId?: string;
  durationSeconds: number;
  fileSizeBytes?: number;
  mimeType: string;
  transcription?: string;
  transcriptionConfidence?: number;
  cadenceMarkers?: CadenceMarkers;
  status: 'uploaded' | 'transcribing' | 'analyzing' | 'complete' | 'error';
  errorMessage?: string;
}

export interface EmotionalSignatureCurve {
  reactivityVsReflection: number;   // 0 = reactive, 1 = reflective
  tensionVsRelease: number;         // 0 = tense, 1 = relaxed
  lateralJumps: number;             // 0 = linear, 1 = lateral
  gutPunchesVsRational: number;     // 0 = gut, 1 = rational
  // Extended metrics
  averagePauseDuration?: number;
  emphasisFrequency?: number;
  tempoConsistency?: number;
  emotionalRange?: number;
}

// ============================================
// SOULPRINT TYPES
// ============================================

export interface SoulPrint {
  soulprintId: string;
  displayName?: string;
  status: 'active' | 'inactive' | 'regenerating';
  systemPrompt: string;
  memoryKey?: string;
  pillarSummaries: PillarSummary;
  emotionalCurve: EmotionalSignatureCurve;
  totalMemories: number;
  totalConversations: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SoulPrintStatus {
  userId: string;
  hasImported: boolean;
  importStats?: {
    conversationsImported: number;
    messagesImported: number;
    memoriesCreated: number;
  };
  pillarsCompleted: boolean;
  pillarsProgress: number; // 0-36
  voiceCompleted: boolean;
  voiceProgress: number; // 0-6
  soulprintGenerated: boolean;
  soulprintId?: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

export interface PillarSubmitResponse {
  answersStored: number;
  pillar: number;
  complete: boolean;
}

export interface PillarSummariesResponse {
  summaries: PillarSummary;
  coreAlignment: CoreAlignment;
  modelUsed: string;
}

export interface MicroStoriesResponse {
  stories: MicroStory[];
  modelUsed: string;
}

export interface VoiceUploadResponse {
  recording: VoiceRecording;
  allRecorded: boolean;
}

export interface CadenceProcessResponse {
  emotionalCurve: EmotionalSignatureCurve;
  recordingsAnalyzed: number;
}

export interface SoulPrintGenerateResponse {
  soulprint: SoulPrint;
  systemPrompt: string;
}

// ============================================
// QUESTION DEFINITIONS
// ============================================

export const PILLAR_NAMES = [
  'Communication Style',
  'Emotional Alignment',
  'Decision-Making & Risk',
  'Social & Cultural Identity',
  'Cognitive Processing',
  'Assertiveness & Conflict',
] as const;

export const PILLAR_ICONS = ['🗣️', '💜', '🧭', '🌍', '🧠', '⚔️'] as const;

export interface QuestionDefinition {
  index: number;
  pillar: number;
  type: QuestionType;
  prompt: string;
  leftLabel?: string;
  rightLabel?: string;
}

// All 36 questions
export const QUESTIONS: QuestionDefinition[] = [
  // Pillar 1: Communication (0-5)
  { index: 0, pillar: 1, type: 'slider', prompt: "When you're not being heard:", leftLabel: 'Defend your stance', rightLabel: 'Engage discussion' },
  { index: 1, pillar: 1, type: 'text', prompt: "What's the first thing people misunderstand about your tone?" },
  { index: 2, pillar: 1, type: 'slider', prompt: 'Your natural pacing:', leftLabel: 'Fast and concise', rightLabel: 'Slow and deliberate' },
  { index: 3, pillar: 1, type: 'text', prompt: 'What does silence mean to you in a conversation?' },
  { index: 4, pillar: 1, type: 'slider', prompt: 'When interrupted:', leftLabel: 'Hold back and wait', rightLabel: 'Push through and speak' },
  { index: 5, pillar: 1, type: 'text', prompt: 'Finish this sentence: "If I had one sentence to explain myself without apology, it would be…"' },

  // Pillar 2: Emotional (6-11)
  { index: 6, pillar: 2, type: 'slider', prompt: 'Emotional expression:', leftLabel: 'Contain internally', rightLabel: 'Express outwardly' },
  { index: 7, pillar: 2, type: 'text', prompt: 'What emotion is hardest for you to express out loud?' },
  { index: 8, pillar: 2, type: 'slider', prompt: 'When someone you care about is hurting:', leftLabel: 'Fix the issue', rightLabel: 'Sit with them in it' },
  { index: 9, pillar: 2, type: 'text', prompt: 'How do you reset after emotional conflict?' },
  { index: 10, pillar: 2, type: 'slider', prompt: 'Emotional boundary style:', leftLabel: 'Guarded', rightLabel: 'Open' },
  { index: 11, pillar: 2, type: 'text', prompt: 'Describe a time your emotions surprised you.' },

  // Pillar 3: Decision (12-17)
  { index: 12, pillar: 3, type: 'slider', prompt: 'Decision instinct:', leftLabel: 'Gut feeling', rightLabel: 'Full analysis' },
  { index: 13, pillar: 3, type: 'text', prompt: 'Describe a moment when hesitation cost you something.' },
  { index: 14, pillar: 3, type: 'slider', prompt: 'Response to uncertainty:', leftLabel: 'Charge forward', rightLabel: 'Slow down and evaluate' },
  { index: 15, pillar: 3, type: 'text', prompt: 'What does "acceptable risk" mean to you?' },
  { index: 16, pillar: 3, type: 'slider', prompt: 'Recovery after mistakes:', leftLabel: 'Move on quickly', rightLabel: 'Reflect deeply' },
  { index: 17, pillar: 3, type: 'text', prompt: 'Do you trust your future self with the consequences of your choices? Why?' },

  // Pillar 4: Social (18-23)
  { index: 18, pillar: 4, type: 'slider', prompt: 'Group presence:', leftLabel: 'Observer', rightLabel: 'Participant' },
  { index: 19, pillar: 4, type: 'text', prompt: 'What community or culture feels like home to you?' },
  { index: 20, pillar: 4, type: 'slider', prompt: 'Social connection preference:', leftLabel: 'Small trusted circle', rightLabel: 'Broad network' },
  { index: 21, pillar: 4, type: 'text', prompt: 'What values were you raised with that you kept or rejected?' },
  { index: 22, pillar: 4, type: 'slider', prompt: 'Code-switching:', leftLabel: 'Same self everywhere', rightLabel: 'Adapt depending on environment' },
  { index: 23, pillar: 4, type: 'text', prompt: 'What kind of people make you feel rooted and safe?' },

  // Pillar 5: Cognitive (24-29)
  { index: 24, pillar: 5, type: 'slider', prompt: 'Thinking style:', leftLabel: 'Concrete and literal', rightLabel: 'Abstract and conceptual' },
  { index: 25, pillar: 5, type: 'text', prompt: "When you're learning something new, what helps it stick?" },
  { index: 26, pillar: 5, type: 'slider', prompt: 'Responding to complexity:', leftLabel: 'Zoom into details', rightLabel: 'Pull back to see the whole' },
  { index: 27, pillar: 5, type: 'text', prompt: 'What kind of information drains you fastest?' },
  { index: 28, pillar: 5, type: 'slider', prompt: 'Best processing mode:', leftLabel: 'Speaking out loud', rightLabel: 'Writing it down' },
  { index: 29, pillar: 5, type: 'text', prompt: "When something doesn't make sense, what's your default move?" },

  // Pillar 6: Conflict (30-35)
  { index: 30, pillar: 6, type: 'slider', prompt: 'When someone crosses a line:', leftLabel: 'Call it out immediately', rightLabel: 'Let it sit until later' },
  { index: 31, pillar: 6, type: 'text', prompt: "When someone challenges you publicly, what's your instinct?" },
  { index: 32, pillar: 6, type: 'slider', prompt: 'Anger style:', leftLabel: 'Quieter', rightLabel: 'Sharper or louder' },
  { index: 33, pillar: 6, type: 'text', prompt: 'Do you avoid conflict, use it, or transform it?' },
  { index: 34, pillar: 6, type: 'slider', prompt: 'Being misunderstood:', leftLabel: 'Walk away', rightLabel: 'Correct and clarify' },
  { index: 35, pillar: 6, type: 'text', prompt: 'How would a close friend describe your conflict style?' },
];

// Validation helpers
export function validatePillarAnswer(answer: PillarAnswer): string | null {
  if (answer.questionIndex < 0 || answer.questionIndex >= 36) {
    return 'Invalid question index';
  }
  if (answer.pillar < 1 || answer.pillar > 6) {
    return 'Invalid pillar';
  }
  if (answer.questionType === 'slider') {
    if (answer.sliderValue === undefined || answer.sliderValue < 0 || answer.sliderValue > 100) {
      return 'Invalid slider value (must be 0-100)';
    }
  } else if (answer.questionType === 'text') {
    if (!answer.textValue || answer.textValue.trim().length === 0) {
      return 'Text answer cannot be empty';
    }
    if (answer.textValue.length > 5000) {
      return 'Text answer too long (max 5000 characters)';
    }
  }
  return null;
}

export function getQuestionPillar(questionIndex: number): number {
  return Math.floor(questionIndex / 6) + 1;
}

export function getQuestionType(questionIndex: number): QuestionType {
  return QUESTIONS[questionIndex]?.type || 'text';
}
