-- ═══════════════════════════════════════════════════════════════════════════
-- MEMORY ANCHORS TABLE
-- Stores extracted insights and key phrases for RAG retrieval
-- Part of the "Evolution Engine" for SoulPrint identity growth
-- ═══════════════════════════════════════════════════════════════════════════

-- Create memory_anchors table
CREATE TABLE IF NOT EXISTS public.memory_anchors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'anchor' CHECK (type IN ('anchor', 'insight', 'pattern', 'value_shift', 'emotional_anchor')),
    confidence REAL DEFAULT 1.0,
    conversation_id TEXT,
    metadata JSONB DEFAULT '{}',
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_memory_anchors_user_id ON public.memory_anchors(user_id);

-- Index for type filtering
CREATE INDEX IF NOT EXISTS idx_memory_anchors_type ON public.memory_anchors(type);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_memory_anchors_embedding ON public.memory_anchors 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- RLS Policies
ALTER TABLE public.memory_anchors ENABLE ROW LEVEL SECURITY;

-- Users can only see their own memory anchors
CREATE POLICY "Users can view own memory anchors"
    ON public.memory_anchors FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own memory anchors
CREATE POLICY "Users can insert own memory anchors"
    ON public.memory_anchors FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role has full access to memory anchors"
    ON public.memory_anchors FOR ALL
    USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════════════════
-- VECTOR SEARCH RPC FOR MEMORY ANCHORS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION match_memory_anchors(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5,
    match_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    content text,
    type text,
    confidence real,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ma.id,
        ma.content,
        ma.type,
        ma.confidence,
        1 - (ma.embedding <=> query_embedding) as similarity
    FROM public.memory_anchors ma
    WHERE 
        (match_user_id IS NULL OR ma.user_id = match_user_id)
        AND ma.embedding IS NOT NULL
        AND 1 - (ma.embedding <=> query_embedding) > match_threshold
    ORDER BY ma.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- EVOLUTION LOG TABLE (Optional - tracks changes over time)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.soulprint_evolution_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    soulprint_id UUID NOT NULL REFERENCES public.soulprints(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    significance_score INTEGER,
    insights JSONB DEFAULT '[]',
    changes_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_evolution_log_soulprint ON public.soulprint_evolution_log(soulprint_id);
CREATE INDEX IF NOT EXISTS idx_evolution_log_user ON public.soulprint_evolution_log(user_id);

-- RLS
ALTER TABLE public.soulprint_evolution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own evolution log"
    ON public.soulprint_evolution_log FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to evolution log"
    ON public.soulprint_evolution_log FOR ALL
    USING (auth.role() = 'service_role');

COMMENT ON TABLE public.memory_anchors IS 'Stores extracted insights and key phrases from conversations for identity evolution';
COMMENT ON TABLE public.soulprint_evolution_log IS 'Tracks SoulPrint identity changes over time';
