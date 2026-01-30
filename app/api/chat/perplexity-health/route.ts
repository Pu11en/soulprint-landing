import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ 
        healthy: false, 
        status: 'no_api_key',
        message: 'Perplexity API key not configured' 
      });
    }

    // Quick health check - just verify the API key format is valid
    // We don't make actual API calls to avoid rate limits
    const isValidKeyFormat = apiKey.startsWith('pplx-') && apiKey.length > 20;
    
    return NextResponse.json({ 
      healthy: isValidKeyFormat, 
      status: isValidKeyFormat ? 'connected' : 'invalid_key',
      message: isValidKeyFormat ? 'API key configured' : 'Invalid API key format'
    });
  } catch {
    return NextResponse.json({ 
      healthy: false, 
      status: 'error',
      message: 'Health check failed' 
    }, { status: 500 });
  }
}
