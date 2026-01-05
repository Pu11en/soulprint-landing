-- Final Schema Reconciliation for SoulPrint Engine
-- Ensures all tables exist with correct names and column types (Standardizing on UUID user_id)

-- 1. Ensure Profiles table has required columns
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'current_soulprint_id') THEN 
        ALTER TABLE public.profiles ADD COLUMN current_soulprint_id UUID NULL; 
    END IF; 
END $$;

-- 2. Consolidate Chat Table (Using chat_logs as the standard)
CREATE TABLE IF NOT EXISTS public.chat_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    session_id UUID NULL, 
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    embedding vector(1536), -- Vector embedding for search/memory
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for chat_logs
ALTER TABLE public.chat_logs ENABLE ROW LEVEL SECURITY;

-- Re-create RLS policies for chat_logs
DROP POLICY IF EXISTS "Users can view their own chat logs" ON public.chat_logs;
DROP POLICY IF EXISTS "Users can insert their own chat logs" ON public.chat_logs;

CREATE POLICY "Users can view their own chat logs"
  ON public.chat_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat logs"
  ON public.chat_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 3. Gemini File Stores
CREATE TABLE IF NOT EXISTS public.gemini_file_stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  store_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.gemini_file_stores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own store" ON public.gemini_file_stores;
DROP POLICY IF EXISTS "Users can insert their own store" ON public.gemini_file_stores;
DROP POLICY IF EXISTS "Users can update their own store" ON public.gemini_file_stores;

CREATE POLICY "Users can view their own store" ON public.gemini_file_stores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own store" ON public.gemini_file_stores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own store" ON public.gemini_file_stores FOR UPDATE USING (auth.uid() = user_id);

-- 4. Clean up the deprecated chat_messages table if it exists (by renaming or dropping)
-- Since it might have data with email-based user_id, it's safer to just let it exist or drop if empty.
-- We will move the code to use chat_logs.

-- 5. Refresh schema cache
NOTIFY pgrst, 'reload config';
