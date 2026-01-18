import { createClient } from "@supabase/supabase-js";

// Supabase admin client for rate limiting
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Rate limit config
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check rate limit for a user using Supabase
 * Uses a simple sliding window approach stored in the rate_limits table
 * @param identifier - User ID or API key hash
 * @returns Rate limit result
 */
export async function checkRateLimit(identifier: string): Promise<RateLimitResult | null> {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  try {
    // Get recent requests in the current window
    const { count, error: countError } = await supabaseAdmin
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("user_id", identifier)
      .gte("created_at", new Date(windowStart).toISOString());

    if (countError) {
      console.error("[RateLimit] Count error:", countError);
      // Fail open - allow request if rate limiting fails
      return null;
    }

    const requestCount = count || 0;
    const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - requestCount);
    const success = requestCount < RATE_LIMIT_MAX_REQUESTS;

    // Log this request
    if (success) {
      await supabaseAdmin.from("rate_limits").insert({
        user_id: identifier,
        created_at: new Date().toISOString(),
      });

      // Cleanup old entries (fire and forget) - delete entries older than 2 minutes
      void supabaseAdmin
        .from("rate_limits")
        .delete()
        .lt("created_at", new Date(now - 2 * RATE_LIMIT_WINDOW_MS).toISOString());
    }

    return {
      success,
      limit: RATE_LIMIT_MAX_REQUESTS,
      remaining,
      reset: Math.ceil((windowStart + RATE_LIMIT_WINDOW_MS) / 1000),
    };
  } catch (error) {
    console.error("[RateLimit] Error:", error);
    // Fail open - allow request if rate limiting fails
    return null;
  }
}

/**
 * Rate limit error response
 */
export function rateLimitResponse() {
  return {
    error: "Rate limit exceeded. You're sending too many requests. Please slow down or contact Drew to increase your limit.",
    code: "RATE_LIMIT_EXCEEDED"
  };
}
