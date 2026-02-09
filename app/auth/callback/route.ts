import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Helper function to record referral for OAuth users
async function recordOAuthReferral(
    userId: string,
    userEmail: string,
    referralCode: string,
    supabaseUrl: string,
    supabaseKey: string
) {
    try {
        // Use fetch to call the RPC function since we need service role for this
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/record_referral`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
                p_referral_code: referralCode.toUpperCase(),
                p_user_id: userId,
                p_user_email: userEmail,
            }),
        })

        if (!response.ok) {
            console.error('Failed to record OAuth referral:', await response.text())
        }
    } catch (err) {
        console.error('Error recording OAuth referral:', err)
    }
}

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const error = requestUrl.searchParams.get('error')
    const errorDescription = requestUrl.searchParams.get('error_description')

    // Get pending referral code from cookie
    const pendingReferralCode = request.cookies.get('pending_referral_code')?.value

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

        if (exchangeError) {
            console.error('❌ Exchange error:', exchangeError)
            return NextResponse.redirect(new URL(`/?error=${exchangeError.message}`, requestUrl.origin))
        }

        if (!exchangeError && sessionData?.session) {
            // Get user info to check for existing soulprint
            const { data: { user } } = await supabase.auth.getUser()

            let redirectUrl = '/import' // New users go to import
            let isNewUser = true

            // Check for existing soulprint or imported chats
            if (user) {
                const { count: soulprintCount } = await supabase
                    .from('soulprints')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)

                const { count: importCount } = await supabase
                    .from('imported_chats')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)

                if ((soulprintCount && soulprintCount > 0) || (importCount && importCount > 0)) {
                    // Existing user with data - go to dashboard (they can navigate to chat from there)
                    redirectUrl = '/dashboard'
                    isNewUser = false
                }

                // Record referral for new users with a referral code
                if (isNewUser && pendingReferralCode && user.email) {
                    await recordOAuthReferral(
                        user.id,
                        user.email,
                        pendingReferralCode,
                        process.env.NEXT_PUBLIC_SUPABASE_URL!,
                        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                    )
                }
            }

            // Create redirect response
            const redirectResponse = NextResponse.redirect(new URL(redirectUrl, requestUrl.origin))

            // Apply all collected cookies to the redirect response
            // Using the exact options that Supabase SSR provides
            cookiesToSet.forEach(({ name, value, options }) => {
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

            // Clear the pending referral cookie
            if (pendingReferralCode) {
                redirectResponse.cookies.delete('pending_referral_code')
            }

            return redirectResponse
        }
    }

    // Capture auth code exchange error or missing code
    console.error('❌ Auth callback failed: no code or exchange failed')
    return NextResponse.redirect(new URL('/?error=auth_code_missing', requestUrl.origin))
}
