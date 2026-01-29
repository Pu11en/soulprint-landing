-- Learned facts table - stores facts extracted from ongoing conversations
-- Unlike conversation_chunks (one-time import), this GROWS over time

CREATE TABLE IF NOT EXISTS public.learned_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Fact content
  fact text NOT NULL,
  category text NOT NULL CHECK (category IN ('preferences', 'relationships', 'milestones', 'beliefs', 'decisions', 'events')),
  confidence float DEFAULT 0.8,
  
  -- Source tracking
  source_type text DEFAULT 'chat' CHECK (source_type IN ('chat', 'import', 'synthesis')),
  source_message_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  evidence text, -- The snippet that supports this fact
  
  -- Vector embedding for retrieval
  embedding vector(1536),
  
  -- Lifecycle
  status text DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'archived')),
  superseded_by uuid REFERENCES public.learned_facts(id) ON DELETE SET NULL,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_learned_facts_user_id ON public.learned_facts(user_id);
CREATE INDEX IF NOT EXISTS idx_learned_facts_category ON public.learned_facts(user_id, category);
CREATE INDEX IF NOT EXISTS idx_learned_facts_status ON public.learned_facts(user_id, status) WHERE status = 'active';

-- Vector similarity search index
CREATE INDEX IF NOT EXISTS idx_learned_facts_embedding 
ON public.learned_facts 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- RLS
ALTER TABLE public.learned_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own facts"
  ON public.learned_facts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own facts"
  ON public.learned_facts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access"
  ON public.learned_facts FOR ALL
  USING (auth.role() = 'service_role');

-- Vector similarity search function for learned facts
CREATE OR REPLACE FUNCTION match_learned_facts(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count int DEFAULT 5,
  match_threshold float DEFAULT 0.5
)
RETURNS TABLE (
  id uuid,
  fact text,
  category text,
  confidence float,
  created_at timestamptz,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT 
    lf.id,
    lf.fact,
    lf.category,
    lf.confidence,
    lf.created_at,
    1 - (lf.embedding <=> query_embedding) as similarity
  FROM public.learned_facts lf
  WHERE lf.user_id = match_user_id
    AND lf.status = 'active'
    AND lf.embedding IS NOT NULL
    AND 1 - (lf.embedding <=> query_embedding) > match_threshold
  ORDER BY lf.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Add soulprint_updated_at to track when soulprint was last synthesized
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS soulprint_updated_at timestamptz DEFAULT NULL;

COMMENT ON TABLE public.learned_facts IS 'Facts extracted from ongoing conversations - the evolving memory';
COMMENT ON COLUMN public.learned_facts.status IS 'active = current, superseded = replaced by newer fact, archived = no longer relevant';
COMMENT ON COLUMN public.user_profiles.soulprint_updated_at IS 'Last time soulprint_text was updated from learned facts';
