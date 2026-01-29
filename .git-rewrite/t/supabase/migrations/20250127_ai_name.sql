-- Add AI name to user profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS ai_name TEXT;

-- Comment
COMMENT ON COLUMN public.user_profiles.ai_name IS 'User-chosen name for their AI assistant';
