import { http, HttpResponse } from 'msw'

// Test Supabase URL - set in env via vitest.config.mts
const SUPABASE_URL = 'https://test.supabase.co'

export const handlers = [
  // RLM Service handlers
  http.get('https://soulprint-landing.onrender.com/health', () => {
    return HttpResponse.json({ status: 'ok' })
  }),

  http.post('https://soulprint-landing.onrender.com/query', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      response: `Mocked response for: ${body.query || 'unknown'}`,
      memory_used: true,
    })
  }),

  http.post('https://soulprint-landing.onrender.com/create-soulprint', () => {
    return HttpResponse.json({
      soulprint: 'Mocked soulprint text for testing',
      success: true,
    })
  }),

  // Supabase REST API handlers
  http.get(`${SUPABASE_URL}/rest/v1/profiles`, ({ request }) => {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || authHeader === 'Bearer invalid-token') {
      return HttpResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    return HttpResponse.json([
      {
        id: 'test-profile-id',
        user_id: 'test-user-id',
        created_at: '2024-01-01T00:00:00Z',
      },
    ])
  }),

  http.get(`${SUPABASE_URL}/rest/v1/user_profiles`, ({ request }) => {
    const authHeader = request.headers.get('authorization')
    const url = new URL(request.url)
    const userId = url.searchParams.get('user_id')

    if (!authHeader || authHeader === 'Bearer invalid-token') {
      return HttpResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Simulate not found
    if (userId === 'no-profile-user') {
      return HttpResponse.json(
        { message: 'Not found', code: 'PGRST116' },
        { status: 404 }
      )
    }

    return HttpResponse.json([
      {
        user_id: userId || 'test-user-id',
        import_status: 'complete',
        import_error: null,
        processing_started_at: '2024-01-01T00:00:00Z',
        total_conversations: 10,
        total_messages: 50,
        soulprint_generated_at: '2024-01-01T00:00:00Z',
        soulprint_locked: false,
        locked_at: null,
        embedding_status: 'complete',
        embedding_progress: 100,
        total_chunks: 100,
        processed_chunks: 100,
        memory_status: 'ready',
      },
    ])
  }),

  http.get(`${SUPABASE_URL}/rest/v1/chat_messages`, ({ request }) => {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || authHeader === 'Bearer invalid-token') {
      return HttpResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const userId = url.searchParams.get('user_id')

    return HttpResponse.json([
      {
        id: 'msg-1',
        user_id: userId || 'test-user-id',
        role: 'user',
        content: 'Hello',
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'msg-2',
        user_id: userId || 'test-user-id',
        role: 'assistant',
        content: 'Hi there!',
        created_at: '2024-01-01T00:01:00Z',
      },
    ])
  }),

  http.post(`${SUPABASE_URL}/rest/v1/chat_messages`, async ({ request }) => {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || authHeader === 'Bearer invalid-token') {
      return HttpResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json([
      {
        id: 'new-msg-id',
        user_id: body.user_id || 'test-user-id',
        role: body.role,
        content: body.content,
        created_at: new Date().toISOString(),
      },
    ])
  }),

  // User profiles upsert (for import process)
  http.post(`${SUPABASE_URL}/rest/v1/user_profiles`, async ({ request }) => {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || authHeader === 'Bearer invalid-token') {
      return HttpResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json([
      {
        user_id: body.user_id,
        import_status: body.import_status || 'processing',
        import_error: body.import_error || null,
        processing_started_at: body.processing_started_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
  }),

  // User profiles update (for import process)
  http.patch(`${SUPABASE_URL}/rest/v1/user_profiles`, async ({ request }) => {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || authHeader === 'Bearer invalid-token') {
      return HttpResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json([
      {
        user_id: body.user_id || 'test-user-id',
        import_status: body.import_status,
        import_error: body.import_error || null,
        updated_at: new Date().toISOString(),
      },
    ])
  }),

  http.get(`${SUPABASE_URL}/auth/v1/user`, ({ request }) => {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || authHeader === 'Bearer invalid-token') {
      return HttpResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    return HttpResponse.json({
      id: 'test-user-id',
      email: 'test@example.com',
      created_at: '2024-01-01T00:00:00Z',
    })
  }),
]
