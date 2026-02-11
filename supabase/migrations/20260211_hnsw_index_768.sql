-- =============================================
-- HNSW Vector Index Migration
-- Switch from IVFFlat to HNSW, resize to 768 dimensions
-- =============================================
--
-- Purpose: Enable semantic search over conversation chunks using
-- AWS Bedrock Titan Embed v2 (768-dimensional embeddings).
-- HNSW index provides better recall than IVFFlat for datasets < 1M rows.
--
-- IMPORTANT: Run this migration manually in Supabase SQL Editor
-- (migrations are not auto-applied in production)

-- Step 1: Clear existing embeddings (wrong dimensions or missing)
UPDATE public.conversation_chunks SET embedding = NULL;

-- Step 2: Resize embedding column from vector(1024) to vector(768)
ALTER TABLE public.conversation_chunks
ALTER COLUMN embedding TYPE vector(768);

-- Step 3: Drop existing IVFFlat index
DROP INDEX IF EXISTS public.idx_conversation_chunks_embedding;

-- Step 4: Create HNSW index for fast approximate nearest neighbor search
-- Parameters:
--   m = 16              (max connections per layer, good default)
--   ef_construction = 64 (construction quality, higher = better recall but slower build)
-- These settings work well for datasets under 1M rows (~250K chunks expected)
CREATE INDEX idx_conversation_chunks_embedding_hnsw
ON public.conversation_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Step 5: Drop old functions (return type changed, CREATE OR REPLACE won't work)
DROP FUNCTION IF EXISTS public.match_conversation_chunks(vector, uuid, integer, double precision);
DROP FUNCTION IF EXISTS public.match_conversation_chunks_by_tier(vector, uuid, text, integer, double precision);

-- Step 6: Recreate match_conversation_chunks RPC with vector(768)
CREATE OR REPLACE FUNCTION public.match_conversation_chunks(
  query_embedding vector(768),
  match_user_id uuid,
  match_count int DEFAULT 10,
  match_threshold float DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  conversation_id text,
  title text,
  content text,
  chunk_tier text,
  message_count int,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id,
    cc.user_id,
    cc.conversation_id,
    cc.title,
    cc.content,
    cc.chunk_tier,
    cc.message_count,
    cc.created_at,
    1 - (cc.embedding <=> query_embedding) as similarity
  FROM conversation_chunks cc
  WHERE cc.user_id = match_user_id
    AND cc.embedding IS NOT NULL
    AND 1 - (cc.embedding <=> query_embedding) > match_threshold
  ORDER BY cc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Step 7: Recreate match_conversation_chunks_by_tier RPC with vector(768)
CREATE OR REPLACE FUNCTION public.match_conversation_chunks_by_tier(
  query_embedding vector(768),
  match_user_id uuid,
  match_tier text,
  match_count int DEFAULT 10,
  match_threshold float DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  conversation_id text,
  title text,
  content text,
  chunk_tier text,
  message_count int,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id,
    cc.user_id,
    cc.conversation_id,
    cc.title,
    cc.content,
    cc.chunk_tier,
    cc.message_count,
    cc.created_at,
    1 - (cc.embedding <=> query_embedding) as similarity
  FROM conversation_chunks cc
  WHERE cc.user_id = match_user_id
    AND cc.chunk_tier = match_tier
    AND cc.embedding IS NOT NULL
    AND 1 - (cc.embedding <=> query_embedding) > match_threshold
  ORDER BY cc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Step 8: Update column comment
COMMENT ON COLUMN public.conversation_chunks.embedding IS 'Titan Embed v2 (768 dimensions, cosine similarity, HNSW index)';
