import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { XP_CONFIG, XPSource } from '@/lib/gamification/xp';
import { handleAPIError } from '@/lib/api/error-handler';

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return { user, supabase };
}

// POST /api/gamification/xp - Award XP for an action
export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, description } = await req.json() as { 
      action: 'message' | 'memory' | 'daily'; 
      description?: string;
    };

    // Get current stats
    let { data: stats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!stats) {
      // Create stats if not exist
      const { data: newStats } = await supabase
        .from('user_stats')
        .insert({ user_id: user.id })
        .select()
        .single();
      stats = newStats;
    }

    const today = new Date().toISOString().split('T')[0];
    const lastActive = stats?.last_active_date;
    const isNewDay = lastActive !== today;
    
    let xpGained = 0;
    let source: XPSource = 'message';
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    // Calculate streak
    if (isNewDay) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      if (lastActive === yesterdayStr) {
        // Continue streak
        updates.current_streak = (stats?.current_streak || 0) + 1;
        updates.longest_streak = Math.max(
          (stats?.longest_streak || 0),
          updates.current_streak as number
        );
      } else if (lastActive) {
        // Streak broken
        updates.current_streak = 1;
      } else {
        // First day
        updates.current_streak = 1;
      }
      
      updates.last_active_date = today;
      updates.days_active = (stats?.days_active || 0) + 1;
      
      // Daily login bonus
      xpGained += XP_CONFIG.actions.daily_login;
      
      // Streak bonus
      const streakBonus = Math.min((updates.current_streak as number) * XP_CONFIG.actions.streak_bonus, 50);
      xpGained += streakBonus;
    }

    // Action-specific XP
    switch (action) {
      case 'message':
        xpGained += XP_CONFIG.actions.message_sent;
        updates.messages_sent = (stats?.messages_sent || 0) + 1;
        source = 'message';
        break;
      case 'memory':
        xpGained += XP_CONFIG.actions.memory_created;
        updates.memories_created = (stats?.memories_created || 0) + 1;
        source = 'memory';
        break;
      case 'daily':
        source = 'daily_bonus';
        break;
    }

    // Update total XP
    updates.total_xp = (stats?.total_xp || 0) + xpGained;
    
    // Calculate new level
    const newLevel = XP_CONFIG.calculateLevel(updates.total_xp as number);
    const leveledUp = newLevel > (stats?.level || 1);
    updates.level = newLevel;

    // Update stats
    await supabase
      .from('user_stats')
      .update(updates)
      .eq('user_id', user.id);

    // Log XP gain
    if (xpGained > 0) {
      await supabase
        .from('xp_history')
        .insert({
          user_id: user.id,
          amount: xpGained,
          source,
          description: description || `${action} action`,
        });
    }

    // Check for new achievements
    const newAchievements = await checkAchievements(supabase, user.id, {
      ...stats,
      ...updates,
    });

    return NextResponse.json({
      xpGained,
      newTotal: updates.total_xp,
      level: newLevel,
      leveledUp,
      newAchievements,
      streak: updates.current_streak || stats?.current_streak,
    });
  } catch (error) {
    return handleAPIError(error, 'API:GamificationXP');
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkAchievements(supabase: any, userId: string, stats: Record<string, unknown>) {
  // Get all achievements
  const { data: achievements } = await supabase
    .from('achievements')
    .select('*');

  // Get user's unlocked achievements
  const { data: unlocked } = await supabase
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', userId);

  const unlockedIds = new Set((unlocked || []).map((u: {achievement_id: string}) => u.achievement_id));
  const newlyUnlocked = [];

  for (const achievement of achievements || []) {
    if (unlockedIds.has(achievement.id)) continue;

    let earned = false;
    switch (achievement.requirement_type) {
      case 'messages_sent':
        earned = (stats.messages_sent as number) >= achievement.requirement_value;
        break;
      case 'memories_created':
        earned = (stats.memories_created as number) >= achievement.requirement_value;
        break;
      case 'streak':
        earned = (stats.current_streak as number) >= achievement.requirement_value;
        break;
      case 'days_active':
        earned = (stats.days_active as number) >= achievement.requirement_value;
        break;
      case 'level':
        earned = (stats.level as number) >= achievement.requirement_value;
        break;
    }

    if (earned) {
      // Unlock achievement
      await supabase
        .from('user_achievements')
        .insert({
          user_id: userId,
          achievement_id: achievement.id,
          notified: false,
        });

      // Award XP
      if (achievement.xp_reward > 0) {
        await supabase
          .from('user_stats')
          .update({
            total_xp: (stats.total_xp as number) + achievement.xp_reward,
          })
          .eq('user_id', userId);

        await supabase
          .from('xp_history')
          .insert({
            user_id: userId,
            amount: achievement.xp_reward,
            source: 'achievement',
            description: `Unlocked: ${achievement.name}`,
          });
      }

      newlyUnlocked.push(achievement);
    }
  }

  return newlyUnlocked;
}
