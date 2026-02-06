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

// ============================================
// ChatGPT Export Format Schemas (Phase 7)
// ============================================

/**
 * ChatGPT Raw Conversation Schema
 * Minimal validation for ChatGPT export format - just enough to confirm structure
 */
export const chatGPTRawConversationSchema = z.object({
  id: z.string().optional(),
  conversation_id: z.string().optional(),
  title: z.string().optional(),
  create_time: z.number().optional(),
  update_time: z.number().optional(),
  mapping: z.record(z.unknown()).optional(),
});

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

/**
 * Chunked Upload Result Schema
 * Validates response from chunked upload endpoint
 */
export const chunkedUploadResultSchema = z.object({
  complete: z.boolean().optional(),
  path: z.string().optional(),
});

// ============================================
// Mem0 API Response Schemas (Phase 7)
// ============================================

/**
 * Mem0 Memory Object Schema
 * Single memory entry returned by Mem0 API
 */
export const mem0MemorySchema = z.object({
  id: z.string(),
  memory: z.string(),
  hash: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

/**
 * Mem0 Add Memory Response Schema
 * Response from POST /v1/memories/ (add operation)
 */
export const mem0AddResponseSchema = z.object({
  results: z.array(mem0MemorySchema),
  relations: z.array(z.unknown()).optional(),
});

/**
 * Mem0 Search Result Schema
 * Single search result with relevance score
 */
export const mem0SearchResultSchema = z.object({
  id: z.string(),
  memory: z.string(),
  score: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Mem0 Search Response Schema
 * Response from POST /v1/memories/search/
 */
export const mem0SearchResponseSchema = z.object({
  results: z.array(mem0SearchResultSchema),
});

/**
 * Mem0 Get All Response Schema
 * Response from GET /v1/memories/ (get all operation)
 */
export const mem0GetAllResponseSchema = z.object({
  results: z.array(mem0MemorySchema),
});

/**
 * Mem0 Delete Response Schema
 * Response from DELETE operations
 */
export const mem0DeleteResponseSchema = z.object({
  message: z.string(),
});

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
