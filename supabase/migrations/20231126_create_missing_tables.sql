-- Migration: Create missing API keys and proxy usage tables
-- Created: 2023-11-26
-- Purpose: Add tables needed for the chat API functionality

-- Create api_keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL, -- Using TEXT to support both UUID and "test" for demo
  label TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE,
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Create proxy_usage table
CREATE TABLE IF NOT EXISTS public.proxy_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  api_key_id UUID NOT NULL,
  model TEXT NOT NULL,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  FOREIGN KEY (api_key_id) REFERENCES public.api_keys(id) ON DELETE CASCADE
);

-- Enable Row Level Security (RLS) for new tables
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proxy_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for api_keys table
CREATE POLICY "Users can view their own API keys"
  ON public.api_keys FOR SELECT
  USING (auth.uid()::text = user_id OR user_id = 'test');

CREATE POLICY "Users can insert their own API keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (auth.uid()::text = user_id OR user_id = 'test');

CREATE POLICY "Users can update their own API keys"
  ON public.api_keys FOR UPDATE
  USING (auth.uid()::text = user_id OR user_id = 'test');

CREATE POLICY "Users can delete their own API keys"
  ON public.api_keys FOR DELETE
  USING (auth.uid()::text = user_id OR user_id = 'test');

CREATE POLICY "Service role can manage all API keys"
  ON public.api_keys FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for proxy_usage table
CREATE POLICY "Users can view their own proxy usage"
  ON public.proxy_usage FOR SELECT
  USING (auth.uid()::text = user_id OR user_id = 'test');

CREATE POLICY "Users can insert their own proxy usage"
  ON public.proxy_usage FOR INSERT
  WITH CHECK (auth.uid()::text = user_id OR user_id = 'test');

CREATE POLICY "Service role can manage all proxy usage"
  ON public.proxy_usage FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS proxy_usage_user_id_idx ON public.proxy_usage(user_id);
CREATE INDEX IF NOT EXISTS proxy_usage_api_key_id_idx ON public.proxy_usage(api_key_id);