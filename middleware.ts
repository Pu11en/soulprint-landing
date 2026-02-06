import { createCsrfMiddleware } from '@edge-csrf/nextjs'
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Create CSRF middleware with Double Submit Cookie pattern
const csrfMiddleware = createCsrfMiddleware({
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
})

export async function middleware(request: NextRequest) {
  // Generate correlation ID for request tracing
  const correlationId = crypto.randomUUID()

  // Inject correlation ID into request headers (for API routes to read)
  request.headers.set('x-correlation-id', correlationId)

  // Skip CSRF for internal server-to-server calls (e.g., queue-processing → process-server)
  const isInternalCall = request.headers.get('X-Internal-User-Id') !== null

  // Apply CSRF protection (validates token on POST/PUT/DELETE, sets cookie on GET)
  const csrfResponse = await csrfMiddleware(request)

  // If CSRF validation failed and this is NOT an internal call, return 403
  if (csrfResponse.status === 403 && !isInternalCall) {
    return csrfResponse
  }

  // Pass through to Supabase auth session refresh
  const authResponse = await updateSession(request)

  // Copy CSRF cookies from csrfResponse to authResponse
  csrfResponse.cookies.getAll().forEach(cookie => {
    authResponse.cookies.set(cookie.name, cookie.value, cookie)
  })

  // Copy CSRF token header to auth response (for Server Components to read)
  const csrfToken = csrfResponse.headers.get('X-CSRF-Token')
  if (csrfToken) {
    authResponse.headers.set('X-CSRF-Token', csrfToken)
  }

  // Set correlation ID on response header (for client-side debugging)
  authResponse.headers.set('x-correlation-id', correlationId)

  return authResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
