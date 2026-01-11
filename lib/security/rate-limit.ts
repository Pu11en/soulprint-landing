/**
 * Rate Limiting Utility
 * Simple in-memory rate limiter for API endpoints
 */

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

// In-memory store - in production, consider using Redis
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanup() {
    if (cleanupTimer) return;
    cleanupTimer = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of rateLimitStore.entries()) {
            if (now > entry.resetTime) {
                rateLimitStore.delete(key);
            }
        }
    }, CLEANUP_INTERVAL);
}

export interface RateLimitConfig {
    /** Maximum number of requests allowed in the window */
    maxRequests: number;
    /** Time window in milliseconds */
    windowMs: number;
    /** Identifier for the rate limit (e.g., 'chat', 'auth', 'api') */
    identifier?: string;
}

export interface RateLimitResult {
    /** Whether the request is allowed */
    allowed: boolean;
    /** Current request count */
    current: number;
    /** Maximum allowed requests */
    limit: number;
    /** Time in ms until the rate limit resets */
    resetIn: number;
    /** Number of remaining requests */
    remaining: number;
}

/**
 * Check if a request should be rate limited
 * @param key Unique identifier (e.g., user ID, IP address)
 * @param config Rate limit configuration
 * @returns Rate limit result
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
    startCleanup();

    const now = Date.now();
    const fullKey = config.identifier ? `${config.identifier}:${key}` : key;
    const entry = rateLimitStore.get(fullKey);

    // If no entry or expired, create new one
    if (!entry || now > entry.resetTime) {
        rateLimitStore.set(fullKey, {
            count: 1,
            resetTime: now + config.windowMs
        });
        return {
            allowed: true,
            current: 1,
            limit: config.maxRequests,
            resetIn: config.windowMs,
            remaining: config.maxRequests - 1
        };
    }

    // Increment count
    entry.count++;
    const resetIn = entry.resetTime - now;

    if (entry.count > config.maxRequests) {
        return {
            allowed: false,
            current: entry.count,
            limit: config.maxRequests,
            resetIn,
            remaining: 0
        };
    }

    return {
        allowed: true,
        current: entry.count,
        limit: config.maxRequests,
        resetIn,
        remaining: config.maxRequests - entry.count
    };
}

/**
 * Create a rate limiter with preset configuration
 */
export function createRateLimiter(config: RateLimitConfig) {
    return (key: string) => checkRateLimit(key, config);
}

// Pre-configured rate limiters for common use cases
export const rateLimiters = {
    /** Auth attempts: 5 per minute */
    auth: createRateLimiter({
        maxRequests: 5,
        windowMs: 60 * 1000,
        identifier: 'auth'
    }),

    /** API calls: 60 per minute */
    api: createRateLimiter({
        maxRequests: 60,
        windowMs: 60 * 1000,
        identifier: 'api'
    }),

    /** Chat messages: 30 per minute */
    chat: createRateLimiter({
        maxRequests: 30,
        windowMs: 60 * 1000,
        identifier: 'chat'
    }),

    /** Waitlist submissions: 3 per hour */
    waitlist: createRateLimiter({
        maxRequests: 3,
        windowMs: 60 * 60 * 1000,
        identifier: 'waitlist'
    }),

    /** Gate registrations: 5 per hour */
    gate: createRateLimiter({
        maxRequests: 5,
        windowMs: 60 * 60 * 1000,
        identifier: 'gate'
    })
};

/**
 * Get rate limit headers for HTTP response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
    return {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(result.resetIn / 1000).toString(),
    };
}
