-- Migration: Email-based user identification
-- Created: 2024-11-26
-- Purpose: Enable email-based user identification while maintaining compatibility

-- 1. Remove foreign key constraint from api_keys table to allow email-based user_id
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_user_id_fkey;

-- 2. Convert soulprints.user_id from UUID to TEXT to support email-based identification
ALTER TABLE soulprints ALTER COLUMN user_id TYPE TEXT;

-- 3. Remove foreign key constraint from soulprints table
ALTER TABLE soulprints DROP CONSTRAINT IF EXISTS soulprints_user_id_fkey;

-- 4. Add email-based lookup indexes for performance
CREATE INDEX IF NOT EXISTS soulprints_user_email_idx ON soulprints(user_id);
CREATE INDEX IF NOT EXISTS api_keys_user_email_idx ON api_keys(user_id);

-- 5. Update RLS policies to support both UUID and email-based identification

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own soulprints" ON public.soulprints;
DROP POLICY IF EXISTS "Users can insert their own soulprints" ON public.soulprints;
DROP POLICY IF EXISTS "Users can update their own soulprints" ON public.soulprints;
DROP POLICY IF EXISTS "Users can delete their own soulprints" ON public.soulprints;

DROP POLICY IF EXISTS "Users can view their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can insert their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can update their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can delete their own API keys" ON public.api_keys;

-- Create updated policies that support both UUID and email
CREATE POLICY "Users can view their own soulprints"
  ON public.soulprints FOR SELECT
  USING (auth.uid()::text = user_id OR auth.email() = user_id);

CREATE POLICY "Users can insert their own soulprints"
  ON public.soulprints FOR INSERT
  WITH CHECK (auth.uid()::text = user_id OR auth.email() = user_id);

CREATE POLICY "Users can update their own soulprints"
  ON public.soulprints FOR UPDATE
  USING (auth.uid()::text = user_id OR auth.email() = user_id);

CREATE POLICY "Users can delete their own soulprints"
  ON public.soulprints FOR DELETE
  USING (auth.uid()::text = user_id OR auth.email() = user_id);

CREATE POLICY "Users can view their own API keys"
  ON public.api_keys FOR SELECT
  USING (auth.uid()::text = user_id OR auth.email() = user_id);

CREATE POLICY "Users can insert their own API keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (auth.uid()::text = user_id OR auth.email() = user_id);

CREATE POLICY "Users can update their own API keys"
  ON public.api_keys FOR UPDATE
  USING (auth.uid()::text = user_id OR auth.email() = user_id);

CREATE POLICY "Users can delete their own API keys"
  ON public.api_keys FOR DELETE
  USING (auth.uid()::text = user_id OR auth.email() = user_id);

-- Keep existing demo/test user support
UPDATE api_keys SET user_id = 'demo' WHERE user_id::text = '00000000-0000-0000-0000-000000000001';
UPDATE soulprints SET user_id = 'demo' WHERE user_id::text = '00000000-0000-0000-0000-000000000001';