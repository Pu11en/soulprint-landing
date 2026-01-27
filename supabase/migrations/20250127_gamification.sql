-- Gamification system: XP, achievements, streaks

-- User stats table for tracking XP and streaks
CREATE TABLE IF NOT EXISTS user_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  total_xp integer DEFAULT 0,
  level integer DEFAULT 1,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  last_active_date date,
  messages_sent integer DEFAULT 0,
  memories_created integer DEFAULT 0,
  days_active integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Achievements definition table
CREATE TABLE IF NOT EXISTS achievements (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  xp_reward integer DEFAULT 0,
  category text DEFAULT 'general', -- general, messages, memories, streaks, milestones
  requirement_type text NOT NULL, -- messages_sent, days_active, memories_created, streak, level, etc
  requirement_value integer NOT NULL,
  rarity text DEFAULT 'common', -- common, uncommon, rare, epic, legendary
  created_at timestamp with time zone DEFAULT now()
);

-- User achievements (unlocked badges)
CREATE TABLE IF NOT EXISTS user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id text REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at timestamp with time zone DEFAULT now(),
  notified boolean DEFAULT false,
  UNIQUE(user_id, achievement_id)
);

-- XP history for tracking gains
CREATE TABLE IF NOT EXISTS xp_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  source text NOT NULL, -- message, memory, streak, achievement, daily_bonus
  description text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

-- Policies for user_stats
CREATE POLICY "Users can view own stats" ON user_stats
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own stats" ON user_stats
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stats" ON user_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for user_achievements
CREATE POLICY "Users can view own achievements" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own achievements" ON user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own achievements" ON user_achievements
  FOR UPDATE USING (auth.uid() = user_id);

-- Policies for xp_history
CREATE POLICY "Users can view own xp history" ON xp_history
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own xp history" ON xp_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Achievements are public (read-only for all)
CREATE POLICY "Anyone can view achievements" ON achievements
  FOR SELECT USING (true);

-- Insert default achievements
INSERT INTO achievements (id, name, description, icon, xp_reward, category, requirement_type, requirement_value, rarity) VALUES
  -- First steps
  ('first_chat', 'First Words', 'Send your first message', '💬', 50, 'messages', 'messages_sent', 1, 'common'),
  ('getting_started', 'Getting Started', 'Complete onboarding and name your AI', '🚀', 100, 'milestones', 'onboarding_complete', 1, 'common'),
  
  -- Message milestones
  ('chatterbox', 'Chatterbox', 'Send 10 messages', '🗣️', 100, 'messages', 'messages_sent', 10, 'common'),
  ('conversationalist', 'Conversationalist', 'Send 50 messages', '💭', 250, 'messages', 'messages_sent', 50, 'uncommon'),
  ('storyteller', 'Storyteller', 'Send 100 messages', '📖', 500, 'messages', 'messages_sent', 100, 'uncommon'),
  ('legendary_talker', 'Legendary Talker', 'Send 500 messages', '🎤', 1000, 'messages', 'messages_sent', 500, 'rare'),
  ('message_master', 'Message Master', 'Send 1000 messages', '👑', 2500, 'messages', 'messages_sent', 1000, 'epic'),
  
  -- Memory milestones
  ('memory_keeper', 'Memory Keeper', 'Create your first memory', '🧠', 100, 'memories', 'memories_created', 1, 'common'),
  ('collector', 'Collector', 'Create 10 memories', '📚', 250, 'memories', 'memories_created', 10, 'uncommon'),
  ('archivist', 'Archivist', 'Create 50 memories', '🗄️', 500, 'memories', 'memories_created', 50, 'rare'),
  ('memory_vault', 'Memory Vault', 'Create 100 memories', '🏛️', 1000, 'memories', 'memories_created', 100, 'epic'),
  
  -- Streak achievements
  ('streak_starter', 'Streak Starter', '3-day activity streak', '🔥', 150, 'streaks', 'streak', 3, 'common'),
  ('week_warrior', 'Week Warrior', '7-day activity streak', '⚡', 350, 'streaks', 'streak', 7, 'uncommon'),
  ('fortnight_force', 'Fortnight Force', '14-day activity streak', '💪', 750, 'streaks', 'streak', 14, 'rare'),
  ('month_master', 'Month Master', '30-day activity streak', '🏆', 1500, 'streaks', 'streak', 30, 'epic'),
  ('streak_legend', 'Streak Legend', '100-day activity streak', '🌟', 5000, 'streaks', 'streak', 100, 'legendary'),
  
  -- Daily activity
  ('day_one', 'Day One', 'Your first day with SoulPrint', '🌅', 50, 'general', 'days_active', 1, 'common'),
  ('regular', 'Regular', 'Active for 7 days total', '📅', 200, 'general', 'days_active', 7, 'common'),
  ('dedicated', 'Dedicated', 'Active for 30 days total', '🎯', 500, 'general', 'days_active', 30, 'uncommon'),
  ('veteran', 'Veteran', 'Active for 100 days total', '🎖️', 1500, 'general', 'days_active', 100, 'rare'),
  
  -- Level achievements
  ('level_5', 'Rising Star', 'Reach level 5', '⭐', 200, 'milestones', 'level', 5, 'common'),
  ('level_10', 'Explorer', 'Reach level 10', '🧭', 500, 'milestones', 'level', 10, 'uncommon'),
  ('level_25', 'Adventurer', 'Reach level 25', '🗺️', 1000, 'milestones', 'level', 25, 'rare'),
  ('level_50', 'Champion', 'Reach level 50', '🏅', 2500, 'milestones', 'level', 50, 'epic'),
  ('level_100', 'Grandmaster', 'Reach level 100', '👑', 10000, 'milestones', 'level', 100, 'legendary')
ON CONFLICT (id) DO NOTHING;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_history_user_id ON xp_history(user_id);
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);
