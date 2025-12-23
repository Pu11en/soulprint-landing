import { GoogleGenAI } from '@google/genai';

// Gemini client singleton
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    // Only warn if we are not in a build step (to avoid build noise)
    if (process.env.NODE_ENV !== 'production') {
        console.warn('[Gemini] GEMINI_API_KEY not set - Gemini features will not work');
    }
}

// Initialize with empty key if missing to prevent crash on import, 
// but calls will fail if key is needed.
export const gemini = new GoogleGenAI({ apiKey: apiKey || 'dummy-key' });

// Default model for generation tasks
export const DEFAULT_MODEL = 'gemini-1.5-flash';

// Re-export for convenience
export { GoogleGenAI };
