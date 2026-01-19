import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    // Get environment variables with fallback check
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // If env vars are missing, skip Supabase auth and just continue
    // This prevents the middleware from crashing during build or when env is not loaded
    if (!supabaseUrl || !supabaseAnonKey) {
        console.warn('Supabase environment variables not found, skipping auth middleware')
        return supabaseResponse
    }

    const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    const {
        data: { user },
        error: userError
    } = await supabase.auth.getUser()

    // Debug logging for protected routes
    const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname.startsWith('/questionnaire')
    if (isProtectedRoute) {
        console.log('🔒 Middleware check for protected route:', {
            path: request.nextUrl.pathname,
            hasUser: !!user,
            userEmail: user?.email,
            error: userError?.message,
            cookies: request.cookies.getAll().map(c => c.name)
        })
    }

    // Protected routes logic - keep it simple
    if (isProtectedRoute) {
        if (!user) {
            console.log('⛔ No user found, redirecting to home')
            return NextResponse.redirect(new URL('/', request.url))
        }

        // Layer 1 Safety: Ensure profile exists
        try {
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', user.id)
                .maybeSingle()

            if (!profile && !profileError) {
                console.log('🛡️ Layer 1: Creating missing profile in middleware for:', user.email)
                await supabase.from('profiles').insert({
                    id: user.id,
                    email: user.email!,
                    full_name: user.user_metadata?.full_name || '',
                    avatar_url: user.user_metadata?.avatar_url || ''
                })
            }
        } catch (e) {
            console.error('Middleware profile sync failed:', e)
        }
    }

    // Redirect authenticated users from landing page to dashboard chat
    if (request.nextUrl.pathname === '/' && user) {
        return NextResponse.redirect(new URL('/dashboard/chat', request.url))
    }

    return supabaseResponse
}
