-- Add import_error column and 'failed' status to user_profiles
-- Allows tracking failed imports so users can retry

-- Add import_error column
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS import_error TEXT DEFAULT NULL;

-- Update the import_status constraint to include 'failed' status
DO $$ 
BEGIN
    -- Drop existing constraint
    ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_import_status_check;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Add new constraint with all valid statuses including 'failed'
ALTER TABLE public.user_profiles 
ADD CONSTRAINT user_profiles_import_status_check 
CHECK (import_status IN ('none', 'quick_ready', 'processing', 'complete', 'locked', 'failed'));

COMMENT ON COLUMN public.user_profiles.import_error IS 'Error message when import_status is failed';
