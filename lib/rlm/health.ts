/**
 * RLM Circuit Breaker
 *
 * Tracks RLM service health to enable fast-fail when RLM is known to be down.
 * Instead of waiting 60s for a timeout on every request, we skip RLM entirely
 * if it failed recently.
 *
 * Pattern: Circuit Breaker
 * - CLOSED: Normal operation, calls go through
 * - OPEN: RLM is down, skip calls for COOLDOWN period
 * - HALF_OPEN: After cooldown, let one call through to test
 */

// Circuit breaker state (in-memory, per-instance)
let lastFailureTime: number | null = null;
let consecutiveFailures = 0;
let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

// Configuration
const FAILURE_THRESHOLD = 2; // Opens circuit after 2 failures
const COOLDOWN_MS = 30000; // 30 seconds before trying again
const HEALTH_CHECK_TIMEOUT_MS = 5000; // 5s for health check

/**
 * Check if we should attempt RLM call
 * Returns false if circuit is OPEN (skip RLM)
 */
export function shouldAttemptRLM(): boolean {
  if (state === 'CLOSED') {
    return true;
  }

  if (state === 'OPEN') {
    const timeSinceFailure = lastFailureTime ? Date.now() - lastFailureTime : Infinity;
    if (timeSinceFailure > COOLDOWN_MS) {
      state = 'HALF_OPEN';
      console.log('[RLM Circuit] State: HALF_OPEN - testing with single request');
      return true;
    }
    console.log(`[RLM Circuit] State: OPEN - skipping RLM (${Math.round((COOLDOWN_MS - timeSinceFailure) / 1000)}s until retry)`);
    return false;
  }

  // HALF_OPEN - allow the test request
  return true;
}

/**
 * Record a successful RLM call
 */
export function recordSuccess(): void {
  if (state === 'HALF_OPEN') {
    console.log('[RLM Circuit] State: CLOSED - RLM recovered');
  }
  consecutiveFailures = 0;
  state = 'CLOSED';
}

/**
 * Record a failed RLM call
 */
export function recordFailure(): void {
  lastFailureTime = Date.now();
  consecutiveFailures++;

  if (state === 'HALF_OPEN' || consecutiveFailures >= FAILURE_THRESHOLD) {
    state = 'OPEN';
    console.log(`[RLM Circuit] State: OPEN - ${consecutiveFailures} consecutive failures`);
  }
}

/**
 * Get circuit breaker status for monitoring
 */
export function getCircuitStatus(): {
  state: string;
  consecutiveFailures: number;
  lastFailureTime: string | null;
  cooldownRemaining: number | null;
} {
  const cooldownRemaining = lastFailureTime && state === 'OPEN'
    ? Math.max(0, COOLDOWN_MS - (Date.now() - lastFailureTime))
    : null;

  return {
    state,
    consecutiveFailures,
    lastFailureTime: lastFailureTime ? new Date(lastFailureTime).toISOString() : null,
    cooldownRemaining,
  };
}

/**
 * Quick health check for RLM (used proactively)
 */
export async function checkRLMHealth(): Promise<boolean> {
  const rlmUrl = process.env.RLM_SERVICE_URL;
  if (!rlmUrl) return false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

    const response = await fetch(`${rlmUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      recordSuccess();
      return true;
    }

    recordFailure();
    return false;
  } catch (error) {
    console.log('[RLM Health] Check failed:', error instanceof Error ? error.message : error);
    recordFailure();
    return false;
  }
}

/**
 * Reset circuit breaker (for testing or manual recovery)
 */
export function resetCircuit(): void {
  state = 'CLOSED';
  consecutiveFailures = 0;
  lastFailureTime = null;
  console.log('[RLM Circuit] Manually reset to CLOSED');
}
