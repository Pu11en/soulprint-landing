-- Update vector dimensions from 768 to 1024 (Titan Embed v2 default)
-- This requires clearing existing embeddings first

-- Clear existing embeddings (they were wrong dimension anyway)
UPDATE public.conversation_chunks SET embedding = NULL;

-- Alter column to new dimension
ALTER TABLE public.conversation_chunks
ALTER COLUMN embedding TYPE vector(1024);

-- Update the tier-aware search function
CREATE OR REPLACE FUNCTION match_conversation_chunks_by_tier(
  query_embedding vector(1024),
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

-- Update the regular search function too
CREATE OR REPLACE FUNCTION match_conversation_chunks(
  query_embedding vector(1024),
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

COMMENT ON COLUMN public.conversation_chunks.embedding IS 'Vector embedding (1024 dimensions - Titan Embed v2)';
