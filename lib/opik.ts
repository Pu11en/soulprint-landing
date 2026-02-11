/**
 * Opik LLM Observability
 * Traces all LLM calls for evaluation and monitoring.
 * Dashboard: https://www.comet.com/opik
 */

import { Opik } from 'opik';

let _client: Opik | null = null;

export function getOpikClient(): Opik | null {
  if (!process.env.OPIK_API_KEY) return null;

  if (!_client) {
    _client = new Opik({
      apiKey: process.env.OPIK_API_KEY,
      projectName: process.env.OPIK_PROJECT_NAME || 'soulprint',
      workspaceName: process.env.OPIK_WORKSPACE_NAME || 'default',
    });
  }
  return _client;
}

/**
 * Trace a chat request end-to-end (RLM + Bedrock fallback + memory retrieval)
 */
export function traceChatRequest(params: {
  userId: string;
  message: string;
  aiName: string;
  hasSoulprint: boolean;
  historyLength: number;
  deepSearch: boolean;
  promptVersion?: string;
}) {
  const client = getOpikClient();
  if (!client) return null;

  const trace = client.trace({
    name: 'chat-request',
    input: {
      message: params.message,
      historyLength: params.historyLength,
      deepSearch: params.deepSearch,
    },
    metadata: {
      userId: params.userId,
      aiName: params.aiName,
      hasSoulprint: params.hasSoulprint,
      promptVersion: params.promptVersion || 'v1-technical',
    },
  });

  return trace;
}

/**
 * Trace soulprint generation (quick pass)
 */
export function traceQuickPass(params: {
  userId: string;
  conversationCount: number;
  messageCount: number;
}) {
  const client = getOpikClient();
  if (!client) return null;

  const trace = client.trace({
    name: 'quick-pass-generation',
    input: {
      conversationCount: params.conversationCount,
      messageCount: params.messageCount,
    },
    metadata: {
      userId: params.userId,
    },
  });

  return trace;
}

/**
 * Flush pending traces — call at end of request
 */
export async function flushOpik() {
  const client = getOpikClient();
  if (client) {
    await client.flush();
  }
}
