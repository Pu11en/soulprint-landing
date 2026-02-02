import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getCircuitStatus } from '@/lib/rlm/health'

// Admin check constants
const ADMIN_EMAILS = [
  'drew@archeforge.com',
  'drewspatterson@gmail.com',
]

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'down'
  latency_ms: number
  message?: string
  details?: Record<string, unknown>
}

interface HealthResponse {
  overall_status: 'healthy' | 'degraded' | 'down'
  timestamp: string
  services: {
    supabase: ServiceHealth
    rlm: ServiceHealth
    perplexity: ServiceHealth
  }
}

async function checkSupabase(): Promise<ServiceHealth> {
  const start = Date.now()
  try {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    
    // Simple query to test connection
    const { data, error } = await adminClient
      .from('profiles')
      .select('id')
      .limit(1)
    
    const latency_ms = Date.now() - start
    
    if (error) {
      return {
        status: 'degraded',
        latency_ms,
        message: error.message,
      }
    }
    
    return {
      status: 'healthy',
      latency_ms,
      message: 'Connected successfully',
    }
  } catch (err) {
    return {
      status: 'down',
      latency_ms: Date.now() - start,
      message: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

async function checkRLM(): Promise<ServiceHealth> {
  const start = Date.now()
  const rlmUrl = process.env.RLM_SERVICE_URL
  
  if (!rlmUrl) {
    return {
      status: 'down',
      latency_ms: 0,
      message: 'RLM_SERVICE_URL not configured',
    }
  }
  
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
        status: 'degraded',
        latency_ms,
        message: `HTTP ${response.status}: ${response.statusText}`,
      }
    }
    
    const data = await response.json()
    
    return {
      status: 'healthy',
      latency_ms,
      message: 'Service responding',
      details: {
        ...data,
        circuit_breaker: getCircuitStatus(),
      },
    }
  } catch (err) {
    return {
      status: 'down',
      latency_ms: Date.now() - start,
      message: err instanceof Error ? err.message : 'Connection failed',
      details: {
        circuit_breaker: getCircuitStatus(),
      },
    }
  }
}

async function checkPerplexity(): Promise<ServiceHealth> {
  const start = Date.now()
  const apiKey = process.env.PERPLEXITY_API_KEY
  
  if (!apiKey) {
    return {
      status: 'down',
      latency_ms: 0,
      message: 'PERPLEXITY_API_KEY not configured',
    }
  }
  
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    
    // Light health check - just verify API key is valid with minimal call
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    })
    
    clearTimeout(timeout)
    const latency_ms = Date.now() - start
    
    // 200 = success, 401 = bad key, 429 = rate limited but key works
    if (response.ok || response.status === 429) {
      return {
        status: response.status === 429 ? 'degraded' : 'healthy',
        latency_ms,
        message: response.status === 429 ? 'Rate limited but responding' : 'API key valid',
      }
    }
    
    if (response.status === 401) {
      return {
        status: 'down',
        latency_ms,
        message: 'Invalid API key',
      }
    }
    
    return {
      status: 'degraded',
      latency_ms,
      message: `HTTP ${response.status}`,
    }
  } catch (err) {
    return {
      status: 'down',
      latency_ms: Date.now() - start,
      message: err instanceof Error ? err.message : 'Connection failed',
    }
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

    // Run all health checks in parallel
    const [supabaseHealth, rlmHealth, perplexityHealth] = await Promise.all([
      checkSupabase(),
      checkRLM(),
      checkPerplexity(),
    ])

    // Determine overall status
    const statuses = [supabaseHealth.status, rlmHealth.status, perplexityHealth.status]
    let overall_status: 'healthy' | 'degraded' | 'down' = 'healthy'
    
    if (statuses.includes('down')) {
      overall_status = 'down'
    } else if (statuses.includes('degraded')) {
      overall_status = 'degraded'
    }

    const response: HealthResponse = {
      overall_status,
      timestamp: new Date().toISOString(),
      services: {
        supabase: supabaseHealth,
        rlm: rlmHealth,
        perplexity: perplexityHealth,
      },
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('Health check error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
