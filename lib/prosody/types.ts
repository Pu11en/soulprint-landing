/**
 * TypeScript types for the prosodic analysis pipeline
 * Used to analyze voice recordings for SoulPrint cadence features
 */

// The six SoulPrint pillars that can have voice recordings
export type SoulPrintPillar = 
  | 'communication_style'
  | 'emotional_alignment'
  | 'decision_risk'
  | 'social_cultural'
  | 'cognitive_processing'
  | 'assertiveness_conflict';

/**
 * Raw prosodic features extracted from audio analysis
 * These are the numerical values from the Python prosody analyzer
 */
export interface ProsodyFeatures {
  // Fundamental frequency (pitch) in Hz
  pitch: {
    mean: number;
    min: number;
    max: number;
    stdDev: number;
    range: number;
    percentVoiced: number; // Percentage of voiced frames
  };
  
  // Intensity (volume) in dB
  intensity: {
    mean: number;
    min: number;
    max: number;
    stdDev: number;
    range: number;
  };
  
  // Duration metrics in seconds
  duration: {
    totalSpeech: number;      // Total duration of speech segments
    totalSilence: number;     // Total duration of silence/pauses
    speechSilenceRatio: number; // Ratio of speech to silence
    averagePauseLength: number; // Average pause duration
  };
  
  // Voice quality metrics
  voiceQuality: {
    hnrMean: number;    // Harmonics-to-noise ratio mean (dB)
    hnrMin: number;
    hnrMax: number;
    hnrStdDev: number;
  };
  
  // Total recording duration
  totalDuration: number;
}

/**
 * Qualitative traits derived from prosody features
 * Used to generate the cadence summary
 */
export interface CadenceTraits {
  rhythm: 'fast' | 'moderate' | 'slow';
  rhythmSmoothness: 'smooth' | 'varied' | 'choppy';
  pauseStyle: 'minimal' | 'thoughtful' | 'extended';
  expressiveness: 'flat' | 'moderate' | 'highly-expressive';
  energy: 'low' | 'moderate' | 'high';
  emphasis: 'subtle' | 'moderate' | 'emphatic';
  voiceClarity: 'breathy' | 'clear' | 'resonant';
}

/**
 * Complete prosody analysis result
 */
export interface ProsodyAnalysis {
  userId: string;
  pillarId: SoulPrintPillar | string;
  features: ProsodyFeatures;
  cadenceSummary: string;
  cadenceTraits: CadenceTraits;
  createdAt: string;
  analysisId?: string;
}

/**
 * Request payload for audio analysis API
 */
export interface AudioAnalysisRequest {
  userId: string;
  pillarId: SoulPrintPillar | string;
  // Audio file is sent as multipart form data
}

/**
 * Response from audio analysis API
 */
export interface AudioAnalysisResponse {
  success: boolean;
  data?: ProsodyAnalysis;
  error?: string;
}

/**
 * Webhook payload sent to external automation platform
 */
export interface WebhookPayload {
  userId: string;
  pillarId: SoulPrintPillar | string;
  audioUrl?: string;         // URL if audio is stored in S3/bucket
  prosodyFeatures: ProsodyFeatures;
  cadenceSummary: string;
  cadenceTraits: CadenceTraits;
  timestamp: string;
  analysisId: string;
  // Context for building final SoulPrint system prompt
  context: {
    source: 'voice_analysis';
    pillarName: string;
    version: string;
  };
}

/**
 * Voice question configuration
 */
export interface VoiceQuestion {
  id: string;
  question: string;
  category: string;
  pillarId: SoulPrintPillar;
  prompt: string;           // What to tell the user to talk about
  minDuration: number;      // Minimum recording duration in seconds
  maxDuration: number;      // Maximum recording duration in seconds
  type: 'voice';
}

/**
 * Map pillar IDs to human-readable names
 */
export const PILLAR_NAMES: Record<SoulPrintPillar, string> = {
  communication_style: 'Communication Style',
  emotional_alignment: 'Emotional Alignment',
  decision_risk: 'Decision & Risk',
  social_cultural: 'Social & Cultural Identity',
  cognitive_processing: 'Cognitive Processing',
  assertiveness_conflict: 'Assertiveness & Conflict',
};
