import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

const ADMIN_EMAILS = [
  'drew@archeforge.com',
  'drewspatterson@gmail.com',
]

interface RLMStatusResponse {
  timestamp: string
  configured: boolean
  url: string | null
  status: 'healthy' | 'degraded' | 'down' | 'unconfigured'
  latency_ms: number
  health_check: {
    success: boolean
    data?: Record<string, unknown>
    error?: string
  }
  query_test: {
    success: boolean
    method?: string
    chunks_used?: number
    latency_ms?: number
    error?: string
  } | null
  recommendations: string[]
}

async function testRLMHealth(rlmUrl: string): Promise<{
  success: boolean
  latency_ms: number
  data?: Record<string, unknown>
  error?: string
}> {
  const start = Date.now()
  
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(`${rlmUrl}/health`, {
      signal: controller.signal,
    })
    
    clearTimeout(timeout)
    const latency_ms = Date.now() - start
    
    if (!response.ok) {
      return {
        success: false,
        latency_ms,
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }
    
    const data = await response.json()
    return {
      success: true,
      latency_ms,
      data,
    }
  } catch (err) {
    return {
      success: false,
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : 'Connection failed',
    }
  }
}

async function testRLMQuery(rlmUrl: string): Promise<{
  success: boolean
  method?: string
  chunks_used?: number
  latency_ms?: number
  error?: string
}> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    
    const response = await fetch(`${rlmUrl}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: 'system-health-check',
        message: 'ping',
        soulprint_text: 'Health check test',
        history: [],
      }),
      signal: controller.signal,
    })
    
    clearTimeout(timeout)
    
    if (!response.ok) {
      const text = await response.text()
      return {
        success: false,
        error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
      }
    }
    
    const data = await response.json()
    return {
      success: true,
      method: data.method,
      chunks_used: data.chunks_used,
      latency_ms: data.latency_ms,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Query failed',
    }
  }
}

export async function GET(request: Request) {
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

    const rlmUrl = process.env.RLM_SERVICE_URL
    const recommendations: string[] = []
    
    // Check if URL query param requests a full test
    const { searchParams } = new URL(request.url)
    const fullTest = searchParams.get('full') === 'true'

    if (!rlmUrl) {
      const response: RLMStatusResponse = {
        timestamp: new Date().toISOString(),
        configured: false,
        url: null,
        status: 'unconfigured',
        latency_ms: 0,
        health_check: {
          success: false,
          error: 'RLM_SERVICE_URL environment variable not set',
        },
        query_test: null,
        recommendations: [
          'Set RLM_SERVICE_URL environment variable',
          'Deploy RLM service to Render or similar',
          'Ensure RLM service has access to Supabase and Anthropic API',
        ],
      }
      return NextResponse.json(response)
    }

    // Run health check
    const healthResult = await testRLMHealth(rlmUrl)
    
    // Determine if we should run query test
    let queryResult: RLMStatusResponse['query_test'] = null
    
    if (fullTest && healthResult.success) {
      queryResult = await testRLMQuery(rlmUrl)
      
      if (queryResult.success) {
        if (queryResult.method === 'fallback') {
          recommendations.push('RLM is falling back to direct API - check RLM library installation')
        }
        if (queryResult.latency_ms && queryResult.latency_ms > 5000) {
          recommendations.push(`Response time is slow (${queryResult.latency_ms}ms) - consider optimizing context window`)
        }
      } else {
        recommendations.push('Query test failed - check RLM service logs')
      }
    }

    // Build recommendations based on health
    if (!healthResult.success) {
      if (healthResult.error?.includes('abort') || healthResult.error?.includes('timeout')) {
        recommendations.push('Service is timing out - may be overloaded or starting up')
      } else if (healthResult.error?.includes('ECONNREFUSED')) {
        recommendations.push('Service is not running or not reachable')
      } else {
        recommendations.push('Check RLM service deployment and logs')
      }
    } else {
      if (healthResult.latency_ms > 1000) {
        recommendations.push('Health check latency is high - service may be under load')
      }
    }

    // Determine overall status
    let status: RLMStatusResponse['status'] = 'healthy'
    if (!healthResult.success) {
      status = 'down'
    } else if (
      healthResult.latency_ms > 2000 ||
      (queryResult && !queryResult.success) ||
      (queryResult && queryResult.method === 'fallback')
    ) {
      status = 'degraded'
    }

    const response: RLMStatusResponse = {
      timestamp: new Date().toISOString(),
      configured: true,
      url: rlmUrl.replace(/\/+$/, ''), // Remove trailing slash
      status,
      latency_ms: healthResult.latency_ms,
      health_check: healthResult,
      query_test: queryResult,
      recommendations: recommendations.length > 0 ? recommendations : ['Service is operating normally'],
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('RLM status error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
