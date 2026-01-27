import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { XP_CONFIG } from '@/lib/gamification/xp';

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

// GET /api/gamification/stats - Get user stats
export async function GET() {
  try {
    const { user, supabase } = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create user stats
    let { data: stats, error } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error?.code === 'PGRST116') {
      // No stats yet, create them
      const { data: newStats, error: insertError } = await supabase
        .from('user_stats')
        .insert({ user_id: user.id })
        .select()
        .single();
      
      if (insertError) {
        console.error('Error creating stats:', insertError);
        return NextResponse.json({ error: 'Failed to create stats' }, { status: 500 });
      }
      stats = newStats;
    } else if (error) {
      console.error('Error fetching stats:', error);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    // Calculate level progress
    const levelProgress = XP_CONFIG.getLevelProgress(stats.total_xp);
    const calculatedLevel = XP_CONFIG.calculateLevel(stats.total_xp);

    // Update level if it changed
    if (calculatedLevel !== stats.level) {
      await supabase
        .from('user_stats')
        .update({ level: calculatedLevel })
        .eq('user_id', user.id);
      stats.level = calculatedLevel;
    }

    return NextResponse.json({
      stats: {
        ...stats,
        level_progress: levelProgress,
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
