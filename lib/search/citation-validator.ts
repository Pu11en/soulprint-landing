/**
 * Citation Validator - Validates URLs from web search before passing to LLM
 *
 * Features:
 * - HEAD-only requests (no body download)
 * - Parallel validation with Promise.allSettled
 * - 3s timeout per URL
 * - SSRF protection (blocks localhost, private IPs)
 * - Accepts 2xx and 3xx status codes
 * - Returns valid/invalid split with error details
 */

export interface ValidationResult {
  valid: string[];
  invalid: string[];
  errors: Record<string, string>; // url -> error reason
}

export interface ValidationOptions {
  timeout?: number; // Milliseconds (default: 3000)
}

/**
 * Validate citations (URLs) for reachability
 * Uses HEAD requests to check if URLs are accessible without downloading content
 */
export async function validateCitations(
  urls: string[],
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const { timeout = 3000 } = options;

  const valid: string[] = [];
  const invalid: string[] = [];
  const errors: Record<string, string> = {};

  // Validate in parallel for speed
  const results = await Promise.allSettled(
    urls.map(url => validateSingleCitation(url, timeout))
  );

  results.forEach((result, i) => {
    const url = urls[i];
    if (!url) return; // Safety check

    if (result.status === 'fulfilled' && result.value.valid) {
      valid.push(url);
    } else {
      invalid.push(url);
      errors[url] = result.status === 'rejected'
        ? String(result.reason)
        : (result.status === 'fulfilled' ? result.value.error || 'Unknown error' : 'Unknown error');
    }
  });

  return { valid, invalid, errors };
}

interface ValidationSingleResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a single URL for reachability
 * Returns { valid: true } if URL is reachable, { valid: false, error: string } otherwise
 */
async function validateSingleCitation(
  url: string,
  timeout: number
): Promise<ValidationSingleResult> {
  // Step 1: URL format check
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Step 2: SSRF protection - block internal/private network addresses
  const hostname = parsed.hostname.toLowerCase();

  // Block localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return { valid: false, error: 'Internal URL blocked (localhost)' };
  }

  // Block IPv4 private ranges
  if (
    hostname.startsWith('127.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
  ) {
    return { valid: false, error: 'Internal URL blocked (private IP)' };
  }

  // Block IPv6 localhost
  if (hostname === '::1' || hostname === '[::1]') {
    return { valid: false, error: 'Internal URL blocked (IPv6 localhost)' };
  }

  // Block link-local addresses
  if (hostname.startsWith('169.254.')) {
    return { valid: false, error: 'Internal URL blocked (link-local)' };
  }

  // Step 3: HEAD request with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'SoulPrint/2.1 (Citation Validator)',
      },
      redirect: 'follow', // Follow redirects (301/302)
    });

    clearTimeout(timeoutId);

    // Accept 2xx (success) and 3xx (redirect - should be followed automatically)
    if (response.ok || (response.status >= 300 && response.status < 400)) {
      return { valid: true };
    }

    // 4xx/5xx errors
    return { valid: false, error: `HTTP ${response.status}` };

  } catch (error) {
    clearTimeout(timeoutId);

    // Check for specific error types
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return { valid: false, error: 'Timeout' };
      }
      if (error.message.includes('fetch failed')) {
        return { valid: false, error: 'Network error' };
      }
      return { valid: false, error: error.message };
    }

    return { valid: false, error: 'Unknown error' };
  }
}
