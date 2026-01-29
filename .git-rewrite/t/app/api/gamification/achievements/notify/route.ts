import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

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

// POST /api/gamification/achievements/notify - Mark achievements as notified
export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { achievementIds } = await req.json() as { achievementIds: string[] };

    if (!achievementIds || achievementIds.length === 0) {
      return NextResponse.json({ error: 'No achievement IDs provided' }, { status: 400 });
    }

    // Mark as notified
    const { error } = await supabase
      .from('user_achievements')
      .update({ notified: true })
      .eq('user_id', user.id)
      .in('achievement_id', achievementIds);

    if (error) {
      console.error('Error marking achievements as notified:', error);
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notify error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// GET /api/gamification/achievements/notify - Get unnotified achievements
export async function GET() {
  try {
    const { user, supabase } = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('user_achievements')
      .select(`
        achievement_id,
        unlocked_at,
        achievements (*)
      `)
      .eq('user_id', user.id)
      .eq('notified', false);

    if (error) {
      console.error('Error fetching unnotified:', error);
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }

    return NextResponse.json({
      unnotified: data || [],
    });
  } catch (error) {
    console.error('Get unnotified error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
