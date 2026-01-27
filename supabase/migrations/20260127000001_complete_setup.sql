-- ============================================
-- SOULPRINT COMPLETE DATABASE SETUP
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 1. PROFILES TABLE (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. SOULPRINTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.soulprints (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    soulprint_data JSONB DEFAULT '{}',
    source TEXT DEFAULT 'import',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_soulprints_user ON public.soulprints(user_id);

ALTER TABLE public.soulprints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own soulprint" ON public.soulprints;
CREATE POLICY "Users can view own soulprint" ON public.soulprints
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own soulprint" ON public.soulprints;
CREATE POLICY "Users can insert own soulprint" ON public.soulprints
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own soulprint" ON public.soulprints;
CREATE POLICY "Users can update own soulprint" ON public.soulprints
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access soulprints" ON public.soulprints;
CREATE POLICY "Service role full access soulprints" ON public.soulprints
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 3. IMPORTED CHATS (GPT History)
-- ============================================
CREATE TABLE IF NOT EXISTS public.imported_chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'chatgpt',
    original_id TEXT,
    conversation_title TEXT,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    embedding vector(768),
    original_timestamp TIMESTAMPTZ,
    imported_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_imported_chats_user ON imported_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_imported_chats_timestamp ON imported_chats(user_id, original_timestamp DESC);

ALTER TABLE public.imported_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own imports" ON public.imported_chats;
CREATE POLICY "Users view own imports" ON public.imported_chats
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own imports" ON public.imported_chats;
CREATE POLICY "Users insert own imports" ON public.imported_chats
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own imports" ON public.imported_chats;
CREATE POLICY "Users delete own imports" ON public.imported_chats
    FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access imports" ON public.imported_chats;
CREATE POLICY "Service role full access imports" ON public.imported_chats
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 4. IMPORT JOBS (Progress tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS public.import_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'chatgpt',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    total_messages INT DEFAULT 0,
    processed_messages INT DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own import jobs" ON public.import_jobs;
CREATE POLICY "Users view own import jobs" ON public.import_jobs
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own import jobs" ON public.import_jobs;
CREATE POLICY "Users insert own import jobs" ON public.import_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access import_jobs" ON public.import_jobs;
CREATE POLICY "Service role full access import_jobs" ON public.import_jobs
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 5. CHAT LOGS (Native conversations)
-- ============================================
CREATE TABLE IF NOT EXISTS public.chat_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_logs_user ON chat_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created ON chat_logs(user_id, created_at DESC);

ALTER TABLE public.chat_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own chat logs" ON public.chat_logs;
CREATE POLICY "Users view own chat logs" ON public.chat_logs
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own chat logs" ON public.chat_logs;
CREATE POLICY "Users insert own chat logs" ON public.chat_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access chat_logs" ON public.chat_logs;
CREATE POLICY "Service role full access chat_logs" ON public.chat_logs
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 6. HELPER FUNCTIONS
-- ============================================

-- Get user message stats
CREATE OR REPLACE FUNCTION get_user_message_stats(p_user_id UUID)
RETURNS TABLE (
    native_count BIGINT,
    imported_count BIGINT,
    total_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM chat_logs WHERE user_id = p_user_id)::BIGINT as native_count,
        (SELECT COUNT(*) FROM imported_chats WHERE user_id = p_user_id)::BIGINT as imported_count,
        (SELECT COUNT(*) FROM chat_logs WHERE user_id = p_user_id)::BIGINT +
        (SELECT COUNT(*) FROM imported_chats WHERE user_id = p_user_id)::BIGINT as total_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- DONE!
-- ============================================
-- Tables created:
--   1. profiles (user profiles)
--   2. soulprints (personality data)
--   3. imported_chats (GPT history)
--   4. import_jobs (import progress)
--   5. chat_logs (native chats)
--
-- All tables have RLS enabled with proper policies.
-- Service role has full access for backend operations.
