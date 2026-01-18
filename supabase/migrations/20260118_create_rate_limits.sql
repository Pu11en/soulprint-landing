-- Rate Limits Table for API throttling
-- Simple sliding window rate limiting using Supabase

CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Index for fast lookups by user_id and time window
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_time 
ON rate_limits (user_id, created_at DESC);

-- Enable RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything (used by API routes)
CREATE POLICY "Service role full access" ON rate_limits
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-cleanup: Delete entries older than 5 minutes (runs on each insert via trigger)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS trigger AS $$
BEGIN
  DELETE FROM rate_limits WHERE created_at < NOW() - INTERVAL '5 minutes';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to cleanup on insert (runs occasionally, not every insert for performance)
DROP TRIGGER IF EXISTS trigger_cleanup_rate_limits ON rate_limits;
CREATE TRIGGER trigger_cleanup_rate_limits
  AFTER INSERT ON rate_limits
  FOR EACH STATEMENT
  WHEN (random() < 0.1)  -- Only run 10% of the time
  EXECUTE FUNCTION cleanup_old_rate_limits();
