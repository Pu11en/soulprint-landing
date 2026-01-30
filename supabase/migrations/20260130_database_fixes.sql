-- SoulPrint Database Fixes - Jan 30, 2026
-- Creates missing gamification tables + fixes policies

-- 1. Service role policy for chat_messages
DROP POLICY IF EXISTS "Service role full access" ON chat_messages;
CREATE POLICY "Service role full access" ON chat_messages
FOR ALL USING (auth.role() = 'service_role');

-- 2. Create user_stats table (was missing!)
CREATE TABLE IF NOT EXISTS public.user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  total_chats INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  total_facts_learned INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_chat_at TIMESTAMPTZ,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on user_stats
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- User can read own stats
CREATE POLICY "Users can view own stats" ON user_stats
FOR SELECT USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role stats access" ON user_stats
FOR ALL USING (auth.role() = 'service_role');

-- 3. Create achievements table (was missing!)
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  xp_reward INTEGER DEFAULT 0,
  requirement_type TEXT, -- 'chats', 'facts', 'streak', 'messages'
  requirement_value INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_achievements join table
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  achievement_id UUID REFERENCES public.achievements(id) ON DELETE CASCADE NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Enable RLS
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Achievements are public readable
CREATE POLICY "Achievements readable" ON achievements FOR SELECT USING (true);

-- Users see own earned achievements
CREATE POLICY "Users view own achievements" ON user_achievements
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role achievements access" ON user_achievements
FOR ALL USING (auth.role() = 'service_role');

-- 4. Auto-create user_stats on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_stats ON auth.users;
CREATE TRIGGER on_auth_user_created_stats
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_stats();

-- 5. Backfill: create user_stats for existing users
INSERT INTO public.user_stats (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_stats WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;

-- 6. Seed some starter achievements
INSERT INTO public.achievements (name, description, icon, xp_reward, requirement_type, requirement_value) VALUES
  ('First Chat', 'Start your first conversation', '💬', 10, 'chats', 1),
  ('Getting to Know You', 'Have 10 conversations', '🤝', 50, 'chats', 10),
  ('Deep Thinker', 'Have 50 conversations', '🧠', 200, 'chats', 50),
  ('Memory Keeper', 'Learn 10 facts about you', '📝', 50, 'facts', 10),
  ('Life Story', 'Learn 50 facts about you', '📚', 200, 'facts', 50),
  ('Streak Starter', '3 day streak', '🔥', 30, 'streak', 3),
  ('On Fire', '7 day streak', '🔥🔥', 100, 'streak', 7),
  ('Dedicated', '30 day streak', '⭐', 500, 'streak', 30)
ON CONFLICT DO NOTHING;
