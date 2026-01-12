-- Compete Stack Database Migration
-- Creates tables for mem0 fallback, personality profiles, and fine-tuning data

-- =====================================================
-- USER MEMORIES TABLE (mem0 Supabase fallback)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    memory TEXT NOT NULL,
    memory_type VARCHAR(50) DEFAULT 'fact', -- 'fact', 'preference', 'event', 'reinforced'
    metadata JSONB DEFAULT '{}',
    embedding VECTOR(1536), -- For future semantic search
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for user_memories
CREATE INDEX IF NOT EXISTS idx_user_memories_user_id ON user_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memories_type ON user_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_user_memories_created ON user_memories(created_at DESC);

-- Full text search index
CREATE INDEX IF NOT EXISTS idx_user_memories_fts ON user_memories USING gin(to_tsvector('english', memory));

-- RLS for user_memories
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memories"
    ON user_memories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memories"
    ON user_memories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own memories"
    ON user_memories FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- USER PERSONALITY PROFILE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_personality_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    personality JSONB NOT NULL DEFAULT '{
        "openness": 50,
        "conscientiousness": 50,
        "extraversion": 50,
        "agreeableness": 50,
        "neuroticism": 50
    }',
    confidence INTEGER DEFAULT 0, -- 0-100
    analysis_count INTEGER DEFAULT 0, -- Number of messages analyzed
    last_analyzed TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Index for personality profile
CREATE INDEX IF NOT EXISTS idx_personality_user_id ON user_personality_profile(user_id);

-- RLS for personality profile
ALTER TABLE user_personality_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own personality"
    ON user_personality_profile FOR SELECT
    USING (auth.uid() = user_id);

-- =====================================================
-- FINE-TUNING DATA TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS finetuning_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Input context
    soulprint_summary TEXT,
    memories_used TEXT[] DEFAULT '{}',
    detected_personality JSONB,
    detected_emotion JSONB,
    relationship_stage VARCHAR(50),

    -- Conversation
    system_prompt TEXT NOT NULL,
    user_message TEXT NOT NULL,
    assistant_response TEXT NOT NULL,

    -- Quality signals
    user_continued BOOLEAN DEFAULT FALSE,
    session_duration INTEGER, -- seconds
    sentiment_shift INTEGER, -- -100 to 100
    explicit_feedback SMALLINT, -- -1, 0, 1

    -- Metadata
    model_used VARCHAR(100) NOT NULL,
    response_time_ms INTEGER,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for finetuning_data
CREATE INDEX IF NOT EXISTS idx_finetuning_user_id ON finetuning_data(user_id);
CREATE INDEX IF NOT EXISTS idx_finetuning_session ON finetuning_data(session_id);
CREATE INDEX IF NOT EXISTS idx_finetuning_timestamp ON finetuning_data(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_finetuning_quality ON finetuning_data(user_continued, explicit_feedback);

-- RLS for finetuning_data (admin only access for export)
ALTER TABLE finetuning_data ENABLE ROW LEVEL SECURITY;

-- Only service role can access (for admin exports)
CREATE POLICY "Service role full access"
    ON finetuning_data
    USING (auth.role() = 'service_role');

-- =====================================================
-- CHAT SESSIONS TABLE (for session tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    message_count INTEGER DEFAULT 0,
    avg_sentiment FLOAT,
    UNIQUE(session_id)
);

-- Index for chat_sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);

-- RLS for chat_sessions
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
    ON chat_sessions FOR SELECT
    USING (auth.uid() = user_id);

-- =====================================================
-- UPDATE chat_logs TABLE (add session tracking)
-- =====================================================
ALTER TABLE chat_logs
ADD COLUMN IF NOT EXISTS session_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS emotion_detected VARCHAR(50),
ADD COLUMN IF NOT EXISTS response_time_ms INTEGER;

CREATE INDEX IF NOT EXISTS idx_chat_logs_session ON chat_logs(session_id);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update personality profile
CREATE OR REPLACE FUNCTION update_personality_profile(
    p_user_id UUID,
    p_personality JSONB,
    p_confidence INTEGER
)
RETURNS void AS $$
BEGIN
    INSERT INTO user_personality_profile (user_id, personality, confidence, analysis_count, last_analyzed)
    VALUES (p_user_id, p_personality, p_confidence, 1, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
        personality = (
            SELECT jsonb_build_object(
                'openness', ROUND((COALESCE((user_personality_profile.personality->>'openness')::numeric, 50) * 0.7 + (p_personality->>'openness')::numeric * 0.3)::numeric, 0),
                'conscientiousness', ROUND((COALESCE((user_personality_profile.personality->>'conscientiousness')::numeric, 50) * 0.7 + (p_personality->>'conscientiousness')::numeric * 0.3)::numeric, 0),
                'extraversion', ROUND((COALESCE((user_personality_profile.personality->>'extraversion')::numeric, 50) * 0.7 + (p_personality->>'extraversion')::numeric * 0.3)::numeric, 0),
                'agreeableness', ROUND((COALESCE((user_personality_profile.personality->>'agreeableness')::numeric, 50) * 0.7 + (p_personality->>'agreeableness')::numeric * 0.3)::numeric, 0),
                'neuroticism', ROUND((COALESCE((user_personality_profile.personality->>'neuroticism')::numeric, 50) * 0.7 + (p_personality->>'neuroticism')::numeric * 0.3)::numeric, 0)
            )
        ),
        confidence = LEAST(100, user_personality_profile.confidence + 2),
        analysis_count = user_personality_profile.analysis_count + 1,
        last_analyzed = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get quality training examples
CREATE OR REPLACE FUNCTION get_quality_training_data(
    min_quality INTEGER DEFAULT 60,
    max_rows INTEGER DEFAULT 10000
)
RETURNS TABLE (
    id UUID,
    system_prompt TEXT,
    user_message TEXT,
    assistant_response TEXT,
    quality_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        f.id,
        f.system_prompt,
        f.user_message,
        f.assistant_response,
        (
            50 +
            CASE WHEN f.user_continued THEN 20 ELSE -10 END +
            CASE WHEN f.explicit_feedback = 1 THEN 30 WHEN f.explicit_feedback = -1 THEN -40 ELSE 0 END +
            CASE WHEN f.sentiment_shift > 0 THEN 15 WHEN f.sentiment_shift < -20 THEN -15 ELSE 0 END +
            CASE WHEN f.session_duration > 300 THEN 10 ELSE 0 END
        )::INTEGER as quality_score
    FROM finetuning_data f
    WHERE (
        50 +
        CASE WHEN f.user_continued THEN 20 ELSE -10 END +
        CASE WHEN f.explicit_feedback = 1 THEN 30 WHEN f.explicit_feedback = -1 THEN -40 ELSE 0 END +
        CASE WHEN f.sentiment_shift > 0 THEN 15 WHEN f.sentiment_shift < -20 THEN -15 ELSE 0 END +
        CASE WHEN f.session_duration > 300 THEN 10 ELSE 0 END
    ) >= min_quality
    ORDER BY f.timestamp DESC
    LIMIT max_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANTS (for service role access)
-- =====================================================
GRANT ALL ON user_memories TO service_role;
GRANT ALL ON user_personality_profile TO service_role;
GRANT ALL ON finetuning_data TO service_role;
GRANT ALL ON chat_sessions TO service_role;
