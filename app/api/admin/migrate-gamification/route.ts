/**
 * Gamification migration endpoint - DELETE AFTER USE
 * Creates user_stats, achievements, user_achievements, xp_history tables
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const MIGRATION_SQL = `
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
  category text DEFAULT 'general',
  requirement_type text NOT NULL,
  requirement_value integer NOT NULL,
  rarity text DEFAULT 'common',
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
  source text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now()
);
`;

const RLS_SQL = `
-- Enable RLS
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view own stats" ON user_stats;
DROP POLICY IF EXISTS "Users can update own stats" ON user_stats;
DROP POLICY IF EXISTS "Users can insert own stats" ON user_stats;
DROP POLICY IF EXISTS "Users can view own achievements" ON user_achievements;
DROP POLICY IF EXISTS "Users can insert own achievements" ON user_achievements;
DROP POLICY IF EXISTS "Users can update own achievements" ON user_achievements;
DROP POLICY IF EXISTS "Users can view own xp history" ON xp_history;
DROP POLICY IF EXISTS "Users can insert own xp history" ON xp_history;
DROP POLICY IF EXISTS "Anyone can view achievements" ON achievements;

-- Policies for user_stats
CREATE POLICY "Users can view own stats" ON user_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own stats" ON user_stats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stats" ON user_stats FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for user_achievements
CREATE POLICY "Users can view own achievements" ON user_achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own achievements" ON user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own achievements" ON user_achievements FOR UPDATE USING (auth.uid() = user_id);

-- Policies for xp_history
CREATE POLICY "Users can view own xp history" ON xp_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own xp history" ON xp_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Achievements are public (read-only for all)
CREATE POLICY "Anyone can view achievements" ON achievements FOR SELECT USING (true);
`;

const ACHIEVEMENTS_SQL = `
-- Insert default achievements
INSERT INTO achievements (id, name, description, icon, xp_reward, category, requirement_type, requirement_value, rarity) VALUES
  ('first_chat', 'First Words', 'Send your first message', '💬', 50, 'messages', 'messages_sent', 1, 'common'),
  ('getting_started', 'Getting Started', 'Complete onboarding and name your AI', '🚀', 100, 'milestones', 'onboarding_complete', 1, 'common'),
  ('chatterbox', 'Chatterbox', 'Send 10 messages', '🗣️', 100, 'messages', 'messages_sent', 10, 'common'),
  ('conversationalist', 'Conversationalist', 'Send 50 messages', '💭', 250, 'messages', 'messages_sent', 50, 'uncommon'),
  ('storyteller', 'Storyteller', 'Send 100 messages', '📖', 500, 'messages', 'messages_sent', 100, 'uncommon'),
  ('legendary_talker', 'Legendary Talker', 'Send 500 messages', '🎤', 1000, 'messages', 'messages_sent', 500, 'rare'),
  ('message_master', 'Message Master', 'Send 1000 messages', '👑', 2500, 'messages', 'messages_sent', 1000, 'epic'),
  ('memory_keeper', 'Memory Keeper', 'Create your first memory', '🧠', 100, 'memories', 'memories_created', 1, 'common'),
  ('collector', 'Collector', 'Create 10 memories', '📚', 250, 'memories', 'memories_created', 10, 'uncommon'),
  ('archivist', 'Archivist', 'Create 50 memories', '🗄️', 500, 'memories', 'memories_created', 50, 'rare'),
  ('memory_vault', 'Memory Vault', 'Create 100 memories', '🏛️', 1000, 'memories', 'memories_created', 100, 'epic'),
  ('streak_starter', 'Streak Starter', '3-day activity streak', '🔥', 150, 'streaks', 'streak', 3, 'common'),
  ('week_warrior', 'Week Warrior', '7-day activity streak', '⚡', 350, 'streaks', 'streak', 7, 'uncommon'),
  ('fortnight_force', 'Fortnight Force', '14-day activity streak', '💪', 750, 'streaks', 'streak', 14, 'rare'),
  ('month_master', 'Month Master', '30-day activity streak', '🏆', 1500, 'streaks', 'streak', 30, 'epic'),
  ('streak_legend', 'Streak Legend', '100-day activity streak', '🌟', 5000, 'streaks', 'streak', 100, 'legendary'),
  ('day_one', 'Day One', 'Your first day with SoulPrint', '🌅', 50, 'general', 'days_active', 1, 'common'),
  ('regular', 'Regular', 'Active for 7 days total', '📅', 200, 'general', 'days_active', 7, 'common'),
  ('dedicated', 'Dedicated', 'Active for 30 days total', '🎯', 500, 'general', 'days_active', 30, 'uncommon'),
  ('veteran', 'Veteran', 'Active for 100 days total', '🎖️', 1500, 'general', 'days_active', 100, 'rare'),
  ('level_5', 'Rising Star', 'Reach level 5', '⭐', 200, 'milestones', 'level', 5, 'common'),
  ('level_10', 'Explorer', 'Reach level 10', '🧭', 500, 'milestones', 'level', 10, 'uncommon'),
  ('level_25', 'Adventurer', 'Reach level 25', '🗺️', 1000, 'milestones', 'level', 25, 'rare'),
  ('level_50', 'Champion', 'Reach level 50', '🏅', 2500, 'milestones', 'level', 50, 'epic'),
  ('level_100', 'Grandmaster', 'Reach level 100', '👑', 10000, 'milestones', 'level', 100, 'legendary')
ON CONFLICT (id) DO NOTHING;
`;

const INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_history_user_id ON xp_history(user_id);
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);
`;

export async function POST(request: Request) {
  // Simple auth check
  const { secret } = await request.json();
  if (secret !== 'run-gamification-migration') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const results: { step: string; success: boolean; error?: string }[] = [];

  // Step 1: Create tables
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: MIGRATION_SQL });
    if (error) throw error;
    results.push({ step: 'Create tables', success: true });
  } catch (error) {
    // Try alternative: check if tables exist by querying
    try {
      const { error: checkError } = await supabase.from('user_stats').select('id').limit(1);
      if (checkError && !checkError.message.includes('does not exist')) {
        results.push({ step: 'Create tables', success: true, error: 'Tables may already exist' });
      } else if (checkError) {
        results.push({ step: 'Create tables', success: false, error: String(error) });
        return NextResponse.json({ results, needsManualRun: true, sql: MIGRATION_SQL });
      } else {
        results.push({ step: 'Create tables', success: true, error: 'Tables already exist' });
      }
    } catch {
      results.push({ step: 'Create tables', success: false, error: String(error) });
      return NextResponse.json({ results, needsManualRun: true, sql: MIGRATION_SQL });
    }
  }

  // Step 2: Try to insert achievements directly
  try {
    // Check if achievements table has data
    const { data: existingAchievements } = await supabase
      .from('achievements')
      .select('id')
      .limit(1);

    if (!existingAchievements || existingAchievements.length === 0) {
      // Insert achievements one by one
      const achievements = [
        { id: 'first_chat', name: 'First Words', description: 'Send your first message', icon: '💬', xp_reward: 50, category: 'messages', requirement_type: 'messages_sent', requirement_value: 1, rarity: 'common' },
        { id: 'getting_started', name: 'Getting Started', description: 'Complete onboarding and name your AI', icon: '🚀', xp_reward: 100, category: 'milestones', requirement_type: 'onboarding_complete', requirement_value: 1, rarity: 'common' },
        { id: 'chatterbox', name: 'Chatterbox', description: 'Send 10 messages', icon: '🗣️', xp_reward: 100, category: 'messages', requirement_type: 'messages_sent', requirement_value: 10, rarity: 'common' },
        { id: 'conversationalist', name: 'Conversationalist', description: 'Send 50 messages', icon: '💭', xp_reward: 250, category: 'messages', requirement_type: 'messages_sent', requirement_value: 50, rarity: 'uncommon' },
        { id: 'storyteller', name: 'Storyteller', description: 'Send 100 messages', icon: '📖', xp_reward: 500, category: 'messages', requirement_type: 'messages_sent', requirement_value: 100, rarity: 'uncommon' },
        { id: 'legendary_talker', name: 'Legendary Talker', description: 'Send 500 messages', icon: '🎤', xp_reward: 1000, category: 'messages', requirement_type: 'messages_sent', requirement_value: 500, rarity: 'rare' },
        { id: 'message_master', name: 'Message Master', description: 'Send 1000 messages', icon: '👑', xp_reward: 2500, category: 'messages', requirement_type: 'messages_sent', requirement_value: 1000, rarity: 'epic' },
        { id: 'memory_keeper', name: 'Memory Keeper', description: 'Create your first memory', icon: '🧠', xp_reward: 100, category: 'memories', requirement_type: 'memories_created', requirement_value: 1, rarity: 'common' },
        { id: 'collector', name: 'Collector', description: 'Create 10 memories', icon: '📚', xp_reward: 250, category: 'memories', requirement_type: 'memories_created', requirement_value: 10, rarity: 'uncommon' },
        { id: 'archivist', name: 'Archivist', description: 'Create 50 memories', icon: '🗄️', xp_reward: 500, category: 'memories', requirement_type: 'memories_created', requirement_value: 50, rarity: 'rare' },
        { id: 'memory_vault', name: 'Memory Vault', description: 'Create 100 memories', icon: '🏛️', xp_reward: 1000, category: 'memories', requirement_type: 'memories_created', requirement_value: 100, rarity: 'epic' },
        { id: 'streak_starter', name: 'Streak Starter', description: '3-day activity streak', icon: '🔥', xp_reward: 150, category: 'streaks', requirement_type: 'streak', requirement_value: 3, rarity: 'common' },
        { id: 'week_warrior', name: 'Week Warrior', description: '7-day activity streak', icon: '⚡', xp_reward: 350, category: 'streaks', requirement_type: 'streak', requirement_value: 7, rarity: 'uncommon' },
        { id: 'fortnight_force', name: 'Fortnight Force', description: '14-day activity streak', icon: '💪', xp_reward: 750, category: 'streaks', requirement_type: 'streak', requirement_value: 14, rarity: 'rare' },
        { id: 'month_master', name: 'Month Master', description: '30-day activity streak', icon: '🏆', xp_reward: 1500, category: 'streaks', requirement_type: 'streak', requirement_value: 30, rarity: 'epic' },
        { id: 'streak_legend', name: 'Streak Legend', description: '100-day activity streak', icon: '🌟', xp_reward: 5000, category: 'streaks', requirement_type: 'streak', requirement_value: 100, rarity: 'legendary' },
        { id: 'day_one', name: 'Day One', description: 'Your first day with SoulPrint', icon: '🌅', xp_reward: 50, category: 'general', requirement_type: 'days_active', requirement_value: 1, rarity: 'common' },
        { id: 'regular', name: 'Regular', description: 'Active for 7 days total', icon: '📅', xp_reward: 200, category: 'general', requirement_type: 'days_active', requirement_value: 7, rarity: 'common' },
        { id: 'dedicated', name: 'Dedicated', description: 'Active for 30 days total', icon: '🎯', xp_reward: 500, category: 'general', requirement_type: 'days_active', requirement_value: 30, rarity: 'uncommon' },
        { id: 'veteran', name: 'Veteran', description: 'Active for 100 days total', icon: '🎖️', xp_reward: 1500, category: 'general', requirement_type: 'days_active', requirement_value: 100, rarity: 'rare' },
        { id: 'level_5', name: 'Rising Star', description: 'Reach level 5', icon: '⭐', xp_reward: 200, category: 'milestones', requirement_type: 'level', requirement_value: 5, rarity: 'common' },
        { id: 'level_10', name: 'Explorer', description: 'Reach level 10', icon: '🧭', xp_reward: 500, category: 'milestones', requirement_type: 'level', requirement_value: 10, rarity: 'uncommon' },
        { id: 'level_25', name: 'Adventurer', description: 'Reach level 25', icon: '🗺️', xp_reward: 1000, category: 'milestones', requirement_type: 'level', requirement_value: 25, rarity: 'rare' },
        { id: 'level_50', name: 'Champion', description: 'Reach level 50', icon: '🏅', xp_reward: 2500, category: 'milestones', requirement_type: 'level', requirement_value: 50, rarity: 'epic' },
        { id: 'level_100', name: 'Grandmaster', description: 'Reach level 100', icon: '👑', xp_reward: 10000, category: 'milestones', requirement_type: 'level', requirement_value: 100, rarity: 'legendary' },
      ];

      const { error: insertError } = await supabase
        .from('achievements')
        .upsert(achievements, { onConflict: 'id' });

      if (insertError) {
        results.push({ step: 'Insert achievements', success: false, error: insertError.message });
      } else {
        results.push({ step: 'Insert achievements', success: true });
      }
    } else {
      results.push({ step: 'Insert achievements', success: true, error: 'Achievements already exist' });
    }
  } catch (error) {
    results.push({ step: 'Insert achievements', success: false, error: String(error) });
  }

  return NextResponse.json({ 
    success: results.every(r => r.success),
    results,
    rlsSql: RLS_SQL,
    indexesSql: INDEXES_SQL,
    message: 'Run the RLS and indexes SQL manually in Supabase dashboard if needed'
  });
}
