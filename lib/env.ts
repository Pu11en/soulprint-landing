/**
 * Environment Variable Validator
 * Ensures all required secrets are present before the app attempts logic
 */

import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const REQUIRED_ENVS = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GEMINI_API_KEY',
    'ASSEMBLYAI_API_KEY'
];

// Optional but recommended for production
const OPTIONAL_ENVS = [
    'STREAK_API_KEY',
    'STREAK_PIPELINE_KEY',
    'ACCESS_GATE_CODE',
    'API_KEY_ENCRYPTION_SECRET',
    'DEMO_USER_EMAIL',
    'DEMO_USER_PASSWORD',
];

export function validateEnv() {
    const missing = REQUIRED_ENVS.filter(key => !process.env[key]);

    if (missing.length > 0) {
        const error = `❌ MISSING CRITICAL ENVIRONMENT VARIABLES: ${missing.join(', ')}`;
        console.error(error);

        if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Running in development mode with missing env vars');
        }

        return { valid: false, missing };
    }

    // Warn about missing optional vars in production
    if (process.env.NODE_ENV === 'production') {
        const missingOptional = OPTIONAL_ENVS.filter(key => !process.env[key]);
        if (missingOptional.length > 0) {
            console.warn(`⚠️ MISSING OPTIONAL ENVIRONMENT VARIABLES: ${missingOptional.join(', ')}`);
        }
    }

    return { valid: true, missing: [] };
}

// Map for easy access with type safety/hints
export const env = {
    supabase: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    },
    ai: {
        gemini: process.env.GEMINI_API_KEY!,
        assembly: process.env.ASSEMBLYAI_API_KEY!,
    },
    streak: {
        apiKey: process.env.STREAK_API_KEY || '',
        pipelineKey: process.env.STREAK_PIPELINE_KEY || '',
    },
    gate: {
        accessCode: process.env.ACCESS_GATE_CODE || '7423', // Fallback for backwards compatibility
    },
    demo: {
        email: process.env.DEMO_USER_EMAIL || '',
        password: process.env.DEMO_USER_PASSWORD || '',
        enabled: !!process.env.DEMO_USER_EMAIL && !!process.env.DEMO_USER_PASSWORD,
    },
    security: {
        apiKeyEncryptionSecret: process.env.API_KEY_ENCRYPTION_SECRET || '',
    },
    isProd: process.env.NODE_ENV === 'production',
};

// ============================================
// API Key Encryption Utilities
// ============================================

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts an API key for secure storage
 * @param plaintext The raw API key to encrypt
 * @returns Encrypted string in format: iv:authTag:ciphertext (base64)
 */
export function encryptApiKey(plaintext: string): string {
    const secret = env.security.apiKeyEncryptionSecret;

    if (!secret) {
        // In development without encryption secret, return base64 encoded (not secure for prod!)
        if (!env.isProd) {
            console.warn('⚠️ API_KEY_ENCRYPTION_SECRET not set - using base64 encoding (not secure for production)');
            return `unencrypted:${Buffer.from(plaintext).toString('base64')}`;
        }
        throw new Error('API_KEY_ENCRYPTION_SECRET is required in production');
    }

    // Derive a 32-byte key from the secret
    const key = createHash('sha256').update(secret).digest();

    // Generate a random IV
    const iv = randomBytes(IV_LENGTH);

    // Create cipher and encrypt
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get the auth tag
    const authTag = cipher.getAuthTag();

    // Return combined string
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypts an encrypted API key
 * @param encryptedData The encrypted string from encryptApiKey
 * @returns The original plaintext API key
 */
export function decryptApiKey(encryptedData: string): string {
    // Handle legacy unencrypted keys
    if (encryptedData.startsWith('unencrypted:')) {
        return Buffer.from(encryptedData.slice(12), 'base64').toString('utf8');
    }

    // Handle raw keys (backwards compatibility)
    if (encryptedData.startsWith('sk-soulprint-')) {
        return encryptedData;
    }

    const secret = env.security.apiKeyEncryptionSecret;

    if (!secret) {
        throw new Error('API_KEY_ENCRYPTION_SECRET is required to decrypt keys');
    }

    // Derive the key
    const key = createHash('sha256').update(secret).digest();

    // Parse the encrypted data
    const [ivB64, authTagB64, ciphertext] = encryptedData.split(':');

    if (!ivB64 || !authTagB64 || !ciphertext) {
        throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');

    // Create decipher and decrypt
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * Checks if a value looks like an encrypted API key
 */
export function isEncryptedApiKey(value: string): boolean {
    if (value.startsWith('unencrypted:')) return true;
    if (value.startsWith('sk-soulprint-')) return false; // Raw key

    const parts = value.split(':');
    return parts.length === 3;
}
