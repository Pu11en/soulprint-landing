-- Add chunk_tier column for multi-tier chunking
-- micro (200 chars) - precise facts, names, dates
-- medium (2000 chars) - conversation context
-- macro (5000 chars) - themes, relationships

ALTER TABLE public.conversation_chunks
ADD COLUMN IF NOT EXISTS chunk_tier TEXT DEFAULT 'medium'
CHECK (chunk_tier IN ('micro', 'medium', 'macro'));

-- Index for tier-based queries
CREATE INDEX IF NOT EXISTS idx_conversation_chunks_tier
ON public.conversation_chunks(user_id, chunk_tier);

COMMENT ON COLUMN public.conversation_chunks.chunk_tier IS 'Chunk size tier: micro (200), medium (2000), macro (5000)';
