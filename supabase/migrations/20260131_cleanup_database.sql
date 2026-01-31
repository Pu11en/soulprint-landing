-- =============================================
-- DATABASE CLEANUP - Remove duplicate/unused tables
-- =============================================

-- Drop unused/legacy tables (in order to avoid FK issues)
DROP TABLE IF EXISTS public.memory_syntheses CASCADE;
DROP TABLE IF EXISTS public.memory_anchors CASCADE;
DROP TABLE IF EXISTS public.memory_chunks CASCADE;  -- embeddings now in conversation_chunks
DROP TABLE IF EXISTS public.soulprints CASCADE;     -- soulprint now in user_profiles
DROP TABLE IF EXISTS public.profiles CASCADE;       -- duplicate of user_profiles
DROP TABLE IF EXISTS public.chat_logs CASCADE;      -- duplicate of chat_messages
DROP TABLE IF EXISTS public.imported_chats CASCADE; -- legacy
DROP TABLE IF EXISTS public.conversations CASCADE;  -- unused
DROP TABLE IF EXISTS public.blueprints CASCADE;     -- unused
DROP TABLE IF EXISTS public.gemini_file_stores CASCADE; -- unused
DROP TABLE IF EXISTS public.api_keys CASCADE;       -- unused
DROP TABLE IF EXISTS public.rate_limits CASCADE;    -- unused
DROP TABLE IF EXISTS public.proxy_usage CASCADE;    -- unused
DROP TABLE IF EXISTS public.soulprint_evolution_log CASCADE; -- unused
DROP TABLE IF EXISTS public.used_companion_names CASCADE;    -- unused
DROP TABLE IF EXISTS public.team_members CASCADE;   -- unused
DROP TABLE IF EXISTS public.team_referral_codes CASCADE; -- unused
DROP TABLE IF EXISTS public.xp_history CASCADE;     -- can rebuild from user_stats
DROP TABLE IF EXISTS public.task_runs CASCADE;      -- can rebuild

-- Keep these tables (CORE):
-- user_profiles      - user data + soulprint
-- conversation_chunks - imported convos + embeddings  
-- chat_messages      - chat history
-- learned_facts      - extracted knowledge
-- import_jobs        - import tracking (keep for debugging)
-- raw_conversations  - raw data during import

-- Keep these tables (GAMIFICATION):
-- achievements       - achievement definitions
-- user_achievements  - unlocked achievements
-- user_stats         - XP, streaks

-- Keep these tables (FEATURES):
-- recurring_tasks    - scheduled tasks
-- pending_waitlist   - waitlist signups
-- referrals          - referral tracking

-- =============================================
-- Clean up orphaned data in remaining tables
-- =============================================

-- Remove conversation_chunks without valid users
DELETE FROM public.conversation_chunks 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Remove chat_messages without valid users
DELETE FROM public.chat_messages 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Remove learned_facts without valid users
DELETE FROM public.learned_facts 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Remove user_profiles without valid users
DELETE FROM public.user_profiles 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- =============================================
-- Ensure proper indexes exist
-- =============================================

-- conversation_chunks indexes
CREATE INDEX IF NOT EXISTS idx_conversation_chunks_user_created 
ON public.conversation_chunks(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_chunks_embedding 
ON public.conversation_chunks USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- chat_messages indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created 
ON public.chat_messages(user_id, created_at DESC);

-- user_profiles index
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id 
ON public.user_profiles(user_id);

-- =============================================
-- Update storage bucket for JSON uploads
-- =============================================
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY['application/zip', 'application/x-zip-compressed', 'application/json']
WHERE id = 'imports';
