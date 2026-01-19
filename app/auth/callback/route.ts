import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const error = requestUrl.searchParams.get('error')
    const errorDescription = requestUrl.searchParams.get('error_description')

    console.log('🔐 Auth callback started:', { 
        hasCode: !!code, 
        error, 
        origin: requestUrl.origin 
    })

    if (error) {
        console.error('❌ Auth error from Supabase:', error, errorDescription)
        return NextResponse.redirect(new URL(`/?error=${errorDescription || error}`, requestUrl.origin))
    }

    if (code) {
        // We need to collect cookies that Supabase sets during the exchange
        const cookiesToSet: { name: string; value: string; options: CookieOptions }[] = []

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll()
                    },
                    setAll(cookies: { name: string; value: string; options: CookieOptions }[]) {
                        // Collect all cookies that Supabase wants to set
                        cookies.forEach((cookie) => {
                            cookiesToSet.push(cookie)
                        })
                    },
                },
            }
        )

        const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        console.log('🔄 Code exchange result:', { 
            success: !exchangeError, 
            error: exchangeError?.message,
            hasSession: !!sessionData?.session,
            cookiesCollected: cookiesToSet.length
        })

        if (exchangeError) {
            console.error('❌ Exchange error:', exchangeError)
            return NextResponse.redirect(new URL(`/?error=${exchangeError.message}`, requestUrl.origin))
        }

        if (!exchangeError && sessionData?.session) {
            // Get user info to check for existing soulprint
            const { data: { user } } = await supabase.auth.getUser()

            let redirectUrl = '/dashboard/welcome'
            
            // Check for existing soulprint
            if (user) {
                console.log('👤 User authenticated:', user.email)
                
                const { count } = await supabase
                    .from('soulprints')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)

                if (count && count > 0) {
                    redirectUrl = '/dashboard/chat'
                }
            }

            console.log('🚀 Redirecting to:', redirectUrl)

            // Create redirect response
            const redirectResponse = NextResponse.redirect(new URL(redirectUrl, requestUrl.origin))
            
            // Apply all collected cookies to the redirect response
            // Using the exact options that Supabase SSR provides
            cookiesToSet.forEach(({ name, value, options }) => {
                console.log('🍪 Setting cookie:', name, 'length:', value.length)
                redirectResponse.cookies.set(name, value, {
                    ...options,
                    // Ensure these critical options are set for production
                    path: options.path || '/',
                    sameSite: options.sameSite || 'lax',
                    secure: process.env.NODE_ENV === 'production',
                    // 30 days - critical for Safari session persistence
                    maxAge: options.maxAge || 60 * 60 * 24 * 30,
                })
            })

            return redirectResponse
        }
    }

    // Capture auth code exchange error or missing code
    console.error('❌ Auth callback failed: no code or exchange failed')
    return NextResponse.redirect(new URL('/?error=auth_code_missing', requestUrl.origin))
}
