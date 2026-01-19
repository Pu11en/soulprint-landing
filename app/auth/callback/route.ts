import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const error = requestUrl.searchParams.get('error')
    const errorDescription = requestUrl.searchParams.get('error_description')

    if (error) {
        return NextResponse.redirect(new URL(`/?error=${errorDescription || error}`, requestUrl.origin))
    }

    if (code) {
        // Create response object first - we'll set cookies on it
        const response = NextResponse.next({
            request: {
                headers: request.headers,
            },
        })

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll()
                    },
                    setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            response.cookies.set(name, value, options)
                        })
                    },
                },
            }
        )

        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (!exchangeError) {
            // Get user info to check for existing soulprint
            const { data: { user } } = await supabase.auth.getUser()

            let redirectUrl = '/dashboard/welcome'
            
            // Check for existing soulprint
            if (user) {
                const { count } = await supabase
                    .from('soulprints')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)

                if (count && count > 0) {
                    redirectUrl = '/dashboard/chat'
                }
            }

            // Create redirect response and copy cookies from the response object
            const redirectResponse = NextResponse.redirect(new URL(redirectUrl, requestUrl.origin))
            
            // Copy all cookies from the original response to the redirect response
            response.cookies.getAll().forEach((cookie) => {
                redirectResponse.cookies.set(cookie.name, cookie.value, {
                    path: '/',
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    maxAge: 60 * 60 * 24 * 365, // 1 year
                })
            })

            return redirectResponse
        }
    }

    // Capture auth code exchange error or missing code
    return NextResponse.redirect(new URL('/?error=auth_code_missing', requestUrl.origin))
}
