import { z } from 'zod';

// ============================================
// Chat Schemas
// ============================================

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(100000),
});

export const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message is required').max(50000),
  history: z.array(chatMessageSchema).max(100).default([]),
  voiceVerified: z.boolean().default(true),
  deepSearch: z.boolean().default(false),
});

export const saveMessageSchema = z.object({
  role: z.enum(['user', 'assistant'], {
    message: 'Role must be "user" or "assistant"',
  }),
  content: z.string().min(1, 'Content is required').max(100000, 'Message too long (max 100,000 chars)'),
});

// ============================================
// Memory Schemas
// ============================================

export const memoryQuerySchema = z.object({
  query: z.string().min(1, 'Query is required').max(5000),
  topK: z.number().int().min(1).max(50).default(5),
  includeFacts: z.boolean().default(false),
});

export const memoryDeleteSchema = z.object({
  memoryId: z.string().uuid().optional(),
  memoryIds: z.array(z.string().uuid()).optional(),
}).refine(data => data.memoryId || (data.memoryIds && data.memoryIds.length > 0), {
  message: 'Either memoryId or memoryIds must be provided',
});

// ============================================
// Import Schemas
// ============================================

export const importCompleteSchema = z.object({
  user_id: z.string().min(1, 'user_id is required'),
  soulprint_ready: z.boolean().optional(),
  memory_building: z.boolean().optional(),
  chunks_embedded: z.number().optional(),
  processing_time: z.number().optional(),
});

// ============================================
// Profile Schemas
// ============================================

export const aiNameSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name too long (max 50 chars)').trim(),
});

// ============================================
// Waitlist Schemas
// ============================================

export const waitlistSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  name: z.string().min(1).max(100).optional(),
  source: z.string().max(100).optional(),
});

// ============================================
// Push Subscription Schema
// ============================================

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url('Invalid endpoint URL'),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  expirationTime: z.number().nullable().optional(),
});

// ============================================
// Validation Helper
// ============================================

/**
 * Parse and validate a request body against a Zod schema.
 * Returns either the validated data or a 400 Response.
 *
 * Usage:
 *   const result = await parseRequestBody(request, chatRequestSchema);
 *   if (result instanceof Response) return result; // Validation failed
 *   const { message, history } = result; // Typed data
 */
export async function parseRequestBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<z.infer<T> | Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body', code: 'INVALID_JSON' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const result = schema.safeParse(body);

  if (!result.success) {
    // Convert Zod errors to human-readable message
    // Do NOT expose raw Zod error details (security: schema disclosure)
    const issues = result.error.issues.map(i => i.message).join('; ');
    return new Response(
      JSON.stringify({ error: issues, code: 'VALIDATION_ERROR' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return result.data;
}
