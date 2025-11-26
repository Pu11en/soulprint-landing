-- =========================================
-- SUPABASE DATABASE RESET & FRESH SCHEMA
-- =========================================
-- This script will:
-- 1. DROP all existing tables, functions, and triggers
-- 2. Create a fresh, clean schema for SoulPrint

-- =========================================
-- PART 1: COMPLETE WIPE
-- =========================================

-- Drop all existing tables in public schema
DROP TABLE IF EXISTS public.soulprints CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;

-- Drop any other tables that might exist (add more if you see others)
-- List any additional tables you see in the schema visualizer here
-- Example: DROP TABLE IF EXISTS public.old_table_name CASCADE;

-- =========================================
-- PART 2: FRESH SCHEMA
-- =========================================

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create soulprints table (for storing user soulprint data)
CREATE TABLE public.soulprints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL, -- Changed to TEXT to support "drew" demo ID
  soulprint_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================
-- PART 3: ROW LEVEL SECURITY
-- =========================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soulprints ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Soulprints policies
CREATE POLICY "Users can view their own soulprints"
  ON public.soulprints FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own soulprints"
  ON public.soulprints FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own soulprints"
  ON public.soulprints FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own soulprints"
  ON public.soulprints FOR DELETE
  USING (auth.uid()::text = user_id);

-- =========================================
-- PART 4: FUNCTIONS & TRIGGERS
-- =========================================

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_soulprints
  BEFORE UPDATE ON public.soulprints
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =========================================
-- DONE! Your database is now fresh and clean
-- =========================================
