-- Add memory_status column for progressive availability
-- Tracks whether memory search is still building or fully ready

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS memory_status TEXT DEFAULT 'none';

-- Values:
-- 'none' = No import yet
-- 'building' = SoulPrint ready, embeddings still processing (chat works, memory improving)
-- 'ready' = Full memory available (embeddings complete)

COMMENT ON COLUMN public.user_profiles.memory_status IS 'Memory availability: none, building, ready';

-- Index for finding users with building memory (for background completion jobs)
CREATE INDEX IF NOT EXISTS idx_user_profiles_memory_status
ON public.user_profiles(memory_status)
WHERE memory_status = 'building';
