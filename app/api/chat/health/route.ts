import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Chat API health check
    // Verify core dependencies are available
    
    const checks = {
      perplexityKey: !!process.env.PERPLEXITY_API_KEY,
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: !!(process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    };

    const allHealthy = Object.values(checks).every(Boolean);

    return NextResponse.json({ 
      healthy: allHealthy,
      status: allHealthy ? 'operational' : 'degraded',
      checks,
      timestamp: new Date().toISOString()
    });
  } catch {
    return NextResponse.json({ 
      healthy: false, 
      status: 'error'
    }, { status: 500 });
  }
}
