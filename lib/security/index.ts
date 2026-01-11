/**
 * Security Utilities
 * Centralized security functions for the application
 */

export * from './rate-limit';

/**
 * Sanitize user input to prevent XSS
 * @param input The input string to sanitize
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
    if (!input) return '';

    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Validate email format
 * @param email The email to validate
 * @returns Whether the email is valid
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate password strength
 * @param password The password to validate
 * @returns Object with validation result and message
 */
export function validatePassword(password: string): { valid: boolean; message?: string } {
    if (password.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters' };
    }

    // Check for at least one letter and one number
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);

    if (!hasLetter || !hasNumber) {
        return { valid: false, message: 'Password must contain at least one letter and one number' };
    }

    return { valid: true };
}

/**
 * Generate a secure random token
 * @param length The length of the token in bytes (output will be hex, so 2x length)
 * @returns Random hex string
 */
export function generateSecureToken(length: number = 32): string {
    const crypto = require('crypto');
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a value using SHA-256
 * @param value The value to hash
 * @returns SHA-256 hash as hex string
 */
export function hashValue(value: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks
 * @param a First string
 * @param b Second string
 * @returns Whether the strings are equal
 */
export function secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
        // Still do a fake comparison to maintain constant time
        let dummy = 0;
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            dummy |= 0;
        }
        return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

/**
 * Extract client IP from request headers
 * @param headers Request headers
 * @returns Client IP address or 'unknown'
 */
export function getClientIP(headers: Headers): string {
    // Check common proxy headers
    const forwardedFor = headers.get('x-forwarded-for');
    if (forwardedFor) {
        // Take the first IP in the chain
        return forwardedFor.split(',')[0].trim();
    }

    const realIP = headers.get('x-real-ip');
    if (realIP) {
        return realIP;
    }

    return 'unknown';
}
