-- Add soulprint lock field to prevent re-imports
-- Once a soulprint is imported and locked, it cannot be re-imported

-- Add locked field to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS soulprint_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for checking locked status
CREATE INDEX IF NOT EXISTS idx_user_profiles_soulprint_locked 
ON public.user_profiles(user_id, soulprint_locked) 
WHERE soulprint_locked = TRUE;

-- Update the import_status constraint to include 'locked' status
-- First drop the existing constraint if it exists
DO $$ 
BEGIN
    -- Try to drop existing constraint
    ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_import_status_check;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Add new constraint with all valid statuses
ALTER TABLE public.user_profiles 
ADD CONSTRAINT user_profiles_import_status_check 
CHECK (import_status IN ('none', 'quick_ready', 'processing', 'complete', 'locked'));

COMMENT ON COLUMN public.user_profiles.soulprint_locked IS 'When TRUE, soulprint is finalized and cannot be re-imported';
COMMENT ON COLUMN public.user_profiles.locked_at IS 'Timestamp when soulprint was locked/finalized';
