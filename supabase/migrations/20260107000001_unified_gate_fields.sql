-- Migration: Add Unified Gate fields to profiles
-- Date: 2026-01-07
-- Description: Adds 'nda_agreed' for legal tracking and 'usage_count' for trial limiting.

DO $$
BEGIN
    -- Add nda_agreed if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'nda_agreed') THEN
        ALTER TABLE public.profiles ADD COLUMN nda_agreed BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add usage_count if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'usage_count') THEN
        ALTER TABLE public.profiles ADD COLUMN usage_count INTEGER DEFAULT 0;
    END IF;

    -- Add usage_limit if we want to config it per user later (optional, but good practice)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'usage_limit') THEN
        ALTER TABLE public.profiles ADD COLUMN usage_limit INTEGER DEFAULT 20;
    END IF;

END $$;
