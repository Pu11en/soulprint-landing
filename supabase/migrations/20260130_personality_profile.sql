-- Add personality_profile column for RLM deep analysis results
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS personality_profile jsonb DEFAULT NULL;

COMMENT ON COLUMN public.user_profiles.personality_profile IS 'RLM-generated deep personality analysis from ChatGPT history';
