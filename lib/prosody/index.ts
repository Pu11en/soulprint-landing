/**
 * SoulPrint Prosody Analysis Module
 * 
 * This module provides voice analysis capabilities for the SoulPrint platform,
 * enabling the extraction of prosodic features and generation of cadence summaries
 * from user voice recordings.
 * 
 * ## Architecture Overview
 * 
 * 1. **Audio Upload** → API Route receives audio file via multipart form
 * 2. **Conversion** → FFmpeg converts to WAV if needed
 * 3. **Analysis** → Python script extracts prosodic features using Praat
 * 4. **Summary** → TypeScript generates natural language cadence description
 * 5. **Webhook** → Results sent to automation platform for SoulPrint generation
 * 
 * ## Usage
 * 
 * ```typescript
 * import { analyzeCadence, sendToAutomationWebhook } from '@/lib/prosody';
 * import type { ProsodyFeatures, SoulPrintPillar } from '@/lib/prosody';
 * ```
 * 
 * ## Configuration
 * 
 * Set the following environment variables:
 * - `SOULPRINT_AUTOMATION_WEBHOOK_URL` - Webhook endpoint
 * - `SOULPRINT_WEBHOOK_SECRET` - Optional HMAC signing secret
 * - `PYTHON_PATH` - Path to Python executable (default: "python")
 * - `AUDIO_TEMP_DIR` - Temp directory for audio files
 * 
 * ## SoulPrint Pillars
 * 
 * Voice analysis maps to these SoulPrint pillars:
 * - communication_style
 * - emotional_alignment
 * - decision_risk
 * - social_cultural
 * - cognitive_processing
 * - assertiveness_conflict
 */

// Types
export * from './types';

// Cadence analysis
export { 
  analyzeCadence,
  deriveCadenceTraits,
  generateCadenceSummary,
  getDetailedInsights,
} from './cadence-summary';

// Webhook integration
export {
  sendToAutomationWebhook,
  sendToAutomationWebhookAsync,
  buildWebhookPayload,
} from './webhook';
