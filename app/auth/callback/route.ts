import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (error) {
            console.error('Auth callback error:', error)
            return NextResponse.redirect(new URL('/?error=auth_failed', requestUrl.origin))
        }

        // Check if user already has a soulprint (existing user)
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user?.email) {
            // BYPASS: Demo/Test/Elon users go straight to chat
            const isDemoUser = 
                user.email.includes('demo') || 
                user.email.includes('test') || 
                user.email === 'elon@soulprint.ai' ||
                user.user_metadata?.is_demo === true;

            if (isDemoUser) {
                return NextResponse.redirect(new URL('/dashboard/chat', requestUrl.origin))
            }

            const { data: existingSoulprint } = await supabase
                .from('soulprints')
                .select('id')
                .eq('user_id', user.email)
                .maybeSingle()

            if (existingSoulprint) {
                // Existing user with soulprint - go to chat
                return NextResponse.redirect(new URL('/dashboard/chat', requestUrl.origin))
            }
        }
    }

    // New user - go to questionnaire
    return NextResponse.redirect(new URL('/questionnaire', requestUrl.origin))
}
