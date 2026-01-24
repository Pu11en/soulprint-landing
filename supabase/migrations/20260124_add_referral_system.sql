-- ═══════════════════════════════════════════════════════════════════════════
-- REFERRAL SYSTEM
-- Team members with unique referral codes to track signups
-- ═══════════════════════════════════════════════════════════════════════════

-- Create team_members table (stores team members who can generate referral links)
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    referral_code TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    total_referrals INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for referral code lookups (critical for performance)
CREATE INDEX IF NOT EXISTS idx_team_members_referral_code ON public.team_members(referral_code);
CREATE INDEX IF NOT EXISTS idx_team_members_is_active ON public.team_members(is_active);

-- Create referrals tracking table
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
    referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    referred_email TEXT NOT NULL,
    status TEXT DEFAULT 'signed_up' CHECK (status IN ('signed_up', 'active', 'churned')),
    created_at TIMESTAMPTZ DEFAULT now(),
    converted_at TIMESTAMPTZ
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_referrals_team_member ON public.referrals(team_member_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user ON public.referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_email ON public.referrals(referred_email);

-- Add referred_by column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.team_members(id) ON DELETE SET NULL;

-- Index for referral tracking on profiles
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

-- Team members table - public read for referral code validation
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Anyone can look up a team member by referral code (for validation)
CREATE POLICY "Anyone can validate referral codes"
    ON public.team_members FOR SELECT
    USING (is_active = true);

-- Service role can manage team members
CREATE POLICY "Service role has full access to team members"
    ON public.team_members FOR ALL
    USING (auth.role() = 'service_role');

-- Referrals table - only service role can access
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to referrals"
    ON public.referrals FOR ALL
    USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- Function to validate a referral code and return team member info
CREATE OR REPLACE FUNCTION validate_referral_code(code TEXT)
RETURNS TABLE (
    id uuid,
    name text,
    is_valid boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        tm.id,
        tm.name,
        true as is_valid
    FROM public.team_members tm
    WHERE tm.referral_code = code
    AND tm.is_active = true
    LIMIT 1;

    -- If no rows returned, return invalid result
    IF NOT FOUND THEN
        RETURN QUERY SELECT
            NULL::uuid as id,
            NULL::text as name,
            false as is_valid;
    END IF;
END;
$$;

-- Function to record a referral (called during signup)
CREATE OR REPLACE FUNCTION record_referral(
    p_referral_code TEXT,
    p_user_id UUID,
    p_user_email TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_team_member_id UUID;
BEGIN
    -- Find the team member
    SELECT id INTO v_team_member_id
    FROM public.team_members
    WHERE referral_code = p_referral_code
    AND is_active = true;

    IF v_team_member_id IS NULL THEN
        RETURN false;
    END IF;

    -- Insert the referral record
    INSERT INTO public.referrals (team_member_id, referred_user_id, referred_email)
    VALUES (v_team_member_id, p_user_id, p_user_email);

    -- Update the profile with referred_by
    UPDATE public.profiles
    SET referred_by = v_team_member_id
    WHERE id = p_user_id;

    -- Increment the team member's referral count
    UPDATE public.team_members
    SET total_referrals = total_referrals + 1,
        updated_at = now()
    WHERE id = v_team_member_id;

    RETURN true;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED INITIAL TEAM MEMBERS (you can add more via Supabase dashboard)
-- ═══════════════════════════════════════════════════════════════════════════

-- Insert some initial team members with referral codes
-- You can customize these or add more through the Supabase dashboard
INSERT INTO public.team_members (name, email, referral_code) VALUES
    ('Team SoulPrint', 'team@soulprintengine.ai', 'SOULPRINT'),
    ('Alex', 'alex@soulprintengine.ai', 'ALEX2024'),
    ('Jordan', 'jordan@soulprintengine.ai', 'JORDAN2024'),
    ('Casey', 'casey@soulprintengine.ai', 'CASEY2024'),
    ('Morgan', 'morgan@soulprintengine.ai', 'MORGAN2024')
ON CONFLICT (email) DO NOTHING;

COMMENT ON TABLE public.team_members IS 'Team members who can share referral links to track signups';
COMMENT ON TABLE public.referrals IS 'Tracks which users signed up through which team member referral';
COMMENT ON COLUMN public.profiles.referred_by IS 'The team member who referred this user';
