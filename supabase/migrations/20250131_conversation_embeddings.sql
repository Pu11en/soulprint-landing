-- Add embedding column to conversation_chunks for vector search
-- Using 1536 dimensions for OpenAI text-embedding-3-small

-- Add embedding column
ALTER TABLE public.conversation_chunks 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create ivfflat index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_conversation_chunks_embedding 
ON public.conversation_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create vector similarity search function
CREATE OR REPLACE FUNCTION match_conversation_chunks(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count int DEFAULT 5,
  match_threshold float DEFAULT 0.5
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  created_at timestamptz,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT 
    cc.id,
    cc.title,
    cc.content,
    cc.created_at,
    1 - (cc.embedding <=> query_embedding) as similarity
  FROM public.conversation_chunks cc
  WHERE cc.user_id = match_user_id
    AND cc.embedding IS NOT NULL
    AND 1 - (cc.embedding <=> query_embedding) > match_threshold
  ORDER BY cc.embedding <=> query_embedding
  LIMIT match_count;
$$;
