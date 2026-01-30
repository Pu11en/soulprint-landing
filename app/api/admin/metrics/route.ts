import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const ADMIN_EMAILS = [
  'drew@archeforge.com',
  'drewspatterson@gmail.com',
]

interface MetricsResponse {
  timestamp: string
  users: {
    total: number
    active_today: number
    active_7d: number
    new_today: number
    new_7d: number
  }
  messages: {
    today: number
    yesterday: number
    total: number
    avg_per_user_today: number
  }
  performance: {
    avg_response_time_ms: number | null
    p95_response_time_ms: number | null
  }
  conversations: {
    active_today: number
    total: number
  }
}

export async function GET() {
  try {
    // Auth check
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!ADMIN_EMAILS.includes(user.email || '')) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString()
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString()

    // Run all queries in parallel
    const [
      totalUsersResult,
      newTodayResult,
      new7dResult,
      todayMessagesResult,
      yesterdayMessagesResult,
      totalMessagesResult,
      activeUsersResult,
      active7dUsersResult,
      totalConversationsResult,
      conversationsTodayResult,
      responseTimesResult,
    ] = await Promise.all([
      // Total users
      adminClient.from('profiles').select('id', { count: 'exact', head: true }),
      
      // New users today
      adminClient
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart),
      
      // New users last 7 days
      adminClient
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo),
      
      // Messages today
      adminClient
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart),
      
      // Messages yesterday
      adminClient
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', yesterdayStart)
        .lt('created_at', todayStart),
      
      // Total messages
      adminClient.from('messages').select('id', { count: 'exact', head: true }),
      
      // Active users today (users with messages today)
      adminClient
        .from('messages')
        .select('user_id')
        .gte('created_at', todayStart),
      
      // Active users 7 days
      adminClient
        .from('messages')
        .select('user_id')
        .gte('created_at', sevenDaysAgo),
      
      // Total conversations
      adminClient.from('conversations').select('id', { count: 'exact', head: true }),
      
      // Active conversations today
      adminClient
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .gte('updated_at', todayStart),
      
      // Response times from messages (look for assistant messages)
      adminClient
        .from('messages')
        .select('latency_ms')
        .eq('role', 'assistant')
        .gte('created_at', sevenDaysAgo)
        .not('latency_ms', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1000),
    ])

    // Calculate unique active users
    const activeUsersToday = new Set(
      (activeUsersResult.data || []).map((m: { user_id: string }) => m.user_id)
    ).size
    
    const activeUsers7d = new Set(
      (active7dUsersResult.data || []).map((m: { user_id: string }) => m.user_id)
    ).size

    // Calculate response time metrics
    const latencies = (responseTimesResult.data || [])
      .map((m: { latency_ms: number | null }) => m.latency_ms)
      .filter((l: number | null): l is number => l !== null && l > 0)
      .sort((a: number, b: number) => a - b)

    let avgResponseTime: number | null = null
    let p95ResponseTime: number | null = null
    
    if (latencies.length > 0) {
      avgResponseTime = Math.round(
        latencies.reduce((sum: number, l: number) => sum + l, 0) / latencies.length
      )
      const p95Index = Math.floor(latencies.length * 0.95)
      p95ResponseTime = latencies[p95Index] || latencies[latencies.length - 1]
    }

    const messagesToday = todayMessagesResult.count || 0
    const avgPerUserToday = activeUsersToday > 0 
      ? Math.round((messagesToday / activeUsersToday) * 10) / 10 
      : 0

    const response: MetricsResponse = {
      timestamp: now.toISOString(),
      users: {
        total: totalUsersResult.count || 0,
        active_today: activeUsersToday,
        active_7d: activeUsers7d,
        new_today: newTodayResult.count || 0,
        new_7d: new7dResult.count || 0,
      },
      messages: {
        today: messagesToday,
        yesterday: yesterdayMessagesResult.count || 0,
        total: totalMessagesResult.count || 0,
        avg_per_user_today: avgPerUserToday,
      },
      performance: {
        avg_response_time_ms: avgResponseTime,
        p95_response_time_ms: p95ResponseTime,
      },
      conversations: {
        active_today: conversationsTodayResult.count || 0,
        total: totalConversationsResult.count || 0,
      },
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('Metrics error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
