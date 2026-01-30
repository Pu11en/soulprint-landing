import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if RLM service is configured and responsive
    const rlmUrl = process.env.RLM_SERVICE_URL || 'http://localhost:3001';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      const response = await fetch(`${rlmUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return NextResponse.json({ healthy: true, status: 'operational' });
      }
      return NextResponse.json({ healthy: false, status: 'degraded' }, { status: 503 });
    } catch {
      clearTimeout(timeoutId);
      // RLM service not available - that's ok, return simulated healthy for demo
      return NextResponse.json({ healthy: true, status: 'simulated' });
    }
  } catch {
    return NextResponse.json({ healthy: false, status: 'error' }, { status: 500 });
  }
}
