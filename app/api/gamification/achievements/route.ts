import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
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

// GET /api/gamification/achievements - Get all achievements and user's unlocked ones
export async function GET() {
  try {
    const { user, supabase } = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all achievements
    const { data: achievements, error: achievementsError } = await supabase
      .from('achievements')
      .select('*')
      .order('requirement_value', { ascending: true });

    if (achievementsError) {
      console.error('Error fetching achievements:', achievementsError);
      return NextResponse.json({ error: 'Failed to fetch achievements' }, { status: 500 });
    }

    // Get user's unlocked achievements
    const { data: userAchievements, error: userError } = await supabase
      .from('user_achievements')
      .select('achievement_id, unlocked_at, notified')
      .eq('user_id', user.id);

    if (userError) {
      console.error('Error fetching user achievements:', userError);
      return NextResponse.json({ error: 'Failed to fetch user achievements' }, { status: 500 });
    }

    // Create a map of unlocked achievements
    const unlockedMap = new Map(
      (userAchievements || []).map(ua => [ua.achievement_id, ua])
    );

    // Combine achievements with unlock status
    const combined = (achievements || []).map(a => ({
      ...a,
      unlocked: unlockedMap.has(a.id),
      unlocked_at: unlockedMap.get(a.id)?.unlocked_at || null,
      notified: unlockedMap.get(a.id)?.notified ?? true,
    }));

    // Group by category
    const byCategory = combined.reduce((acc, a) => {
      if (!acc[a.category]) acc[a.category] = [];
      acc[a.category].push(a);
      return acc;
    }, {} as Record<string, typeof combined>);

    return NextResponse.json({
      achievements: combined,
      byCategory,
      unlockedCount: userAchievements?.length || 0,
      totalCount: achievements?.length || 0,
    });
  } catch (error) {
    return handleAPIError(error, 'API:GamificationAchievements');
  }
}
