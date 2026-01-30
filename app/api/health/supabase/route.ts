import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ 
        healthy: false, 
        status: 'not_configured',
        message: 'Supabase credentials not configured'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Quick health check - count from a small table or run simple query
    const startTime = performance.now();
    const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
    const latency = Math.round(performance.now() - startTime);

    if (error) {
      return NextResponse.json({ 
        healthy: false, 
        status: 'query_failed',
        message: error.message,
        latency
      });
    }

    return NextResponse.json({ 
      healthy: true, 
      status: 'connected',
      message: 'Database responding',
      latency
    });
  } catch (err) {
    return NextResponse.json({ 
      healthy: false, 
      status: 'error',
      message: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}
