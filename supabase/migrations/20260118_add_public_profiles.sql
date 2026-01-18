-- Add public profile sharing to soulprints table

-- Add is_public column (default false)
ALTER TABLE soulprints ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Add share_slug column (unique, for pretty URLs)
ALTER TABLE soulprints ADD COLUMN IF NOT EXISTS share_slug TEXT UNIQUE;

-- Create index for fast public profile lookups
CREATE INDEX IF NOT EXISTS idx_soulprints_share_slug ON soulprints (share_slug) WHERE share_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_soulprints_public ON soulprints (is_public) WHERE is_public = true;

-- RLS policy: Allow anyone to read public soulprints
CREATE POLICY "Public soulprints are viewable by everyone" ON soulprints
  FOR SELECT
  USING (is_public = true);
