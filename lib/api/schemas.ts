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
  conversation_id: z.string().uuid('Invalid conversation ID'),
});

// ============================================
// Conversation Schemas
// ============================================

export const createConversationSchema = z.object({
  title: z.string().min(1).max(200).optional().default('New Chat'),
});

export const updateConversationSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').trim(),
});

export const generateTitleSchema = z.object({
  userMessage: z.string().min(1).max(1000),
  aiMessage: z.string().min(1).max(1000),
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

// ============================================
// ChatGPT Export Format Schemas (Phase 7)
// ============================================

/**
 * ChatGPT Raw Conversation Schema
 * Minimal validation for ChatGPT export format - just enough to confirm structure.
 * Uses .nullish() (null | undefined) because real exports have null fields.
 * Uses .passthrough() to allow any extra fields ChatGPT may add.
 */
export const chatGPTRawConversationSchema = z.object({
  id: z.string().nullish(),
  conversation_id: z.string().nullish(),
  title: z.string().nullish(),
  create_time: z.number().nullish(),
  update_time: z.number().nullish(),
  mapping: z.record(z.string(), z.unknown()).nullish(),
}).passthrough();

export const chatGPTExportSchema = z.array(chatGPTRawConversationSchema);

export type ChatGPTRawConversation = z.infer<typeof chatGPTRawConversationSchema>;

// ============================================
// External API Response Schemas (Phase 7)
// ============================================

/**
 * Bedrock Titan Embedding Response Schema
 * Validates response from AWS Bedrock Titan embedding model
 */
export const bedrockEmbedResponseSchema = z.object({
  embedding: z.array(z.number()),
  inputTextTokenCount: z.number().optional(),
});

/**
 * RLM Process Response Schema
 * Validates response from RLM /process-full endpoint
 */
export const rlmProcessResponseSchema = z.object({
  status: z.string().optional(),
  message: z.string().optional(),
});

// ============================================
// Mem0 API Response Schemas (Phase 7)
// ============================================


/**
 * Cloudinary Upload Result Schema
 * Validates response from Cloudinary upload_stream
 */
export const cloudinaryUploadResultSchema = z.object({
  secure_url: z.string(),
  public_id: z.string(),
  duration: z.number().optional(),
  bytes: z.number(),
});
