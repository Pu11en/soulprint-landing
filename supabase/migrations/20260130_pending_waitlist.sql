-- Pending waitlist table for email confirmation
CREATE TABLE IF NOT EXISTS public.pending_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text,
  token text UNIQUE NOT NULL,
  confirmed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  confirmed_at timestamptz,
  streak_box_key text -- Set after confirmed and added to Streak
);

-- Index for token lookup
CREATE INDEX IF NOT EXISTS idx_pending_waitlist_token ON public.pending_waitlist(token);
CREATE INDEX IF NOT EXISTS idx_pending_waitlist_email ON public.pending_waitlist(email);

-- Auto-cleanup old unconfirmed entries (older than 7 days)
-- Can be run manually or via cron
CREATE OR REPLACE FUNCTION cleanup_pending_waitlist()
RETURNS void AS $$
BEGIN
  DELETE FROM public.pending_waitlist 
  WHERE confirmed = false 
  AND created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
