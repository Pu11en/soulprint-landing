ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS tools_md TEXT;
COMMENT ON COLUMN public.user_profiles.tools_md IS 'TOOLS section - AI capabilities, usage patterns, output preferences';
