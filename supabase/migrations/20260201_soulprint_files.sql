-- Add SoulPrint file columns to user_profiles
-- These store the full SoulPrint spec files: SOUL.md, IDENTITY.md, AGENTS.md, USER.md

-- Soul.md - Core personality traits, communication style, emotional patterns
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS soul_md TEXT;

-- Identity.md - AI persona definition, name, signature emoji
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS identity_md TEXT;

-- Agents.md - Behavioral rules, context adaptation, memory protocol
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS agents_md TEXT;

-- User.md - Facts about the user, relationships, interests
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS user_md TEXT;

-- Memory log - Latest daily summary (updated on each chat)
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS memory_log TEXT;

-- Memory log date - When memory_log was last updated
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS memory_log_date DATE;

-- Comment for documentation
COMMENT ON COLUMN public.user_profiles.soul_md IS 'SOUL.md - Core personality, communication style, emotional patterns';
COMMENT ON COLUMN public.user_profiles.identity_md IS 'IDENTITY.md - AI persona name, emoji, vibe';
COMMENT ON COLUMN public.user_profiles.agents_md IS 'AGENTS.md - Response rules, context adaptation, memory protocol';
COMMENT ON COLUMN public.user_profiles.user_md IS 'USER.md - Facts about user: relationships, interests, work';
COMMENT ON COLUMN public.user_profiles.memory_log IS 'Latest memory log summary (daily)';
