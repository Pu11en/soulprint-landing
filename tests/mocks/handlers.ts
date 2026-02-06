import { http, HttpResponse } from 'msw'

export const handlers = [
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
]
