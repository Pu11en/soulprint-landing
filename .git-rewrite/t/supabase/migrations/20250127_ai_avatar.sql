-- Add AI avatar to user profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS ai_avatar_url TEXT;

-- Comment
COMMENT ON COLUMN public.user_profiles.ai_avatar_url IS 'AI-generated profile image URL';
