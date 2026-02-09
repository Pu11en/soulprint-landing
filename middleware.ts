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

  // Skip CSRF for Next.js server actions (identified by Next-Action header).
  // Server actions are POST requests to the page URL with Content-Type text/plain.
  // The CSRF middleware reads the request body to look for a token, which consumes
  // the body and breaks the server action. Next.js already protects server actions
  // against CSRF by comparing Origin and Host headers.
  const isServerAction = request.headers.get('Next-Action') !== null

  // Apply CSRF protection (validates token on POST/PUT/DELETE, sets cookie on GET)
  // Skip entirely for server actions to avoid consuming the request body
  const csrfResponse = isServerAction ? null : await csrfMiddleware(request)

  // If CSRF validation failed and this is NOT an internal call, return 403
  if (csrfResponse && csrfResponse.status === 403 && !isInternalCall) {
    return csrfResponse
  }

  // Pass through to Supabase auth session refresh
  const authResponse = await updateSession(request)

  // Copy CSRF cookies and token from csrfResponse to authResponse (when CSRF was applied)
  if (csrfResponse) {
    csrfResponse.cookies.getAll().forEach(cookie => {
      authResponse.cookies.set(cookie.name, cookie.value, cookie)
    })

    const csrfToken = csrfResponse.headers.get('X-CSRF-Token')
    if (csrfToken) {
      authResponse.headers.set('X-CSRF-Token', csrfToken)
    }
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
