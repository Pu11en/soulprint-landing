import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Cookie options for Safari session persistence (30 days)
const cookieOptions = {
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
}

export async function createClient() {
    const cookieStore = await cookies()

    return createSupabaseServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        // Set cookies in Server Actions (critical for PKCE flow)
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, value, { ...options, ...cookieOptions })
                        })
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )
}
