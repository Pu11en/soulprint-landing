/**
 * Webhook Integration for SoulPrint Voice Analysis
 * 
 * Sends prosody analysis results to external automation platform
 * for integration with questionnaire data to build final SoulPrint system prompt.
 * 
 * Configuration:
 * - Set SOULPRINT_AUTOMATION_WEBHOOK_URL in environment variables
 * - Optional: Set SOULPRINT_WEBHOOK_SECRET for request signing
 */

import { 
  ProsodyFeatures, 
  CadenceTraits, 
  WebhookPayload, 
  SoulPrintPillar,
  PILLAR_NAMES 
} from './types';
import crypto from 'crypto';

/**
 * Configuration for webhook behavior
 */
interface WebhookConfig {
  url: string;
  secret?: string;
  timeout?: number;        // Request timeout in ms
  retryCount?: number;     // Number of retry attempts
  retryDelay?: number;     // Delay between retries in ms
}

/**
 * Get webhook configuration from environment
 */
function getWebhookConfig(): WebhookConfig | null {
  const url = process.env.SOULPRINT_AUTOMATION_WEBHOOK_URL;

  if (!url) {
    return null;
  }
  
  return {
    url,
    secret: process.env.SOULPRINT_WEBHOOK_SECRET,
    timeout: parseInt(process.env.SOULPRINT_WEBHOOK_TIMEOUT || '10000'),
    retryCount: parseInt(process.env.SOULPRINT_WEBHOOK_RETRY_COUNT || '2'),
    retryDelay: parseInt(process.env.SOULPRINT_WEBHOOK_RETRY_DELAY || '1000'),
  };
}

/**
 * Generate HMAC signature for webhook payload
 */
function signPayload(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Generate a unique analysis ID
 */
function generateAnalysisId(): string {
  return `prosody_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Build the webhook payload from analysis results
 */
export function buildWebhookPayload(
  userId: string,
  pillarId: SoulPrintPillar | string,
  features: ProsodyFeatures,
  cadenceSummary: string,
  cadenceTraits: CadenceTraits,
  audioUrl?: string
): WebhookPayload {
  const analysisId = generateAnalysisId();
  const pillarName = PILLAR_NAMES[pillarId as SoulPrintPillar] || pillarId;
  
  return {
    userId,
    pillarId,
    audioUrl,
    prosodyFeatures: features,
    cadenceSummary,
    cadenceTraits,
    timestamp: new Date().toISOString(),
    analysisId,
    context: {
      source: 'voice_analysis',
      pillarName,
      version: '1.0.0',
    },
  };
}

/**
 * Send webhook with retry logic
 */
async function sendWithRetry(
  config: WebhookConfig,
  payload: WebhookPayload,
  attempt: number = 1
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const payloadString = JSON.stringify(payload);
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-SoulPrint-Analysis-Id': payload.analysisId,
    'X-SoulPrint-Timestamp': payload.timestamp,
  };
  
  // Add signature if secret is configured
  if (config.secret) {
    headers['X-SoulPrint-Signature'] = signPayload(payloadString, config.secret);
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);
    
    const response = await fetch(config.url, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      return { success: true, statusCode: response.status };
    }
    
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error(`[Webhook] Failed with status ${response.status}: ${errorText}`);
    
    // Retry on 5xx errors
    if (response.status >= 500 && attempt < (config.retryCount || 2)) {
      await new Promise(resolve => setTimeout(resolve, config.retryDelay || 1000));
      return sendWithRetry(config, payload, attempt + 1);
    }
    
    return { success: false, statusCode: response.status, error: errorText };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Webhook] Request failed: ${errorMessage}`);
    
    // Retry on network errors
    if (attempt < (config.retryCount || 2)) {
      await new Promise(resolve => setTimeout(resolve, config.retryDelay || 1000));
      return sendWithRetry(config, payload, attempt + 1);
    }
    
    return { success: false, error: errorMessage };
  }
}

/**
 * Send prosody analysis results to the automation webhook
 * 
 * @param userId - User identifier
 * @param pillarId - SoulPrint pillar this recording belongs to
 * @param features - Raw prosodic features from analysis
 * @param cadenceSummary - Generated natural language summary
 * @param cadenceTraits - Qualitative traits derived from features
 * @param audioUrl - Optional URL where audio is stored
 * @returns Promise with success status
 */
export async function sendToAutomationWebhook(
  userId: string,
  pillarId: SoulPrintPillar | string,
  features: ProsodyFeatures,
  cadenceSummary: string,
  cadenceTraits: CadenceTraits,
  audioUrl?: string
): Promise<{ success: boolean; analysisId?: string; error?: string }> {
  const config = getWebhookConfig();
  
  if (!config) {
    return { 
      success: false, 
      error: 'Webhook URL not configured. Set SOULPRINT_AUTOMATION_WEBHOOK_URL environment variable.' 
    };
  }
  
  const payload = buildWebhookPayload(
    userId,
    pillarId,
    features,
    cadenceSummary,
    cadenceTraits,
    audioUrl
  );
  
  const result = await sendWithRetry(config, payload);
  
  return {
    success: result.success,
    analysisId: payload.analysisId,
    error: result.error,
  };
}

/**
 * Fire webhook asynchronously without blocking
 * Use this when you want to return the API response immediately
 */
export function sendToAutomationWebhookAsync(
  userId: string,
  pillarId: SoulPrintPillar | string,
  features: ProsodyFeatures,
  cadenceSummary: string,
  cadenceTraits: CadenceTraits,
  audioUrl?: string
): { analysisId: string } {
  const config = getWebhookConfig();
  
  if (!config) {
    return { analysisId: generateAnalysisId() };
  }
  
  const payload = buildWebhookPayload(
    userId,
    pillarId,
    features,
    cadenceSummary,
    cadenceTraits,
    audioUrl
  );
  
  // Fire and forget - don't await
  sendWithRetry(config, payload).catch(error => {
    console.error('[Webhook] Async webhook failed:', error);
  });
  
  return { analysisId: payload.analysisId };
}
