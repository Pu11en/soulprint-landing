'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'

/**
 * Verify access PIN server-side (prevents exposing the PIN in client code)
 * Uses constant-time comparison to prevent timing attacks
 */
export async function verifyAccessPin(pin: string): Promise<boolean> {
    const validPin = env.gate.accessCode;

    // Prevent timing attacks with constant-time comparison
    if (pin.length !== validPin.length) {
        // Still do a fake comparison to maintain constant time
        let dummy = 0;
        for (let i = 0; i < validPin.length; i++) {
            dummy |= validPin.charCodeAt(i) ^ 0;
        }
        return false;
    }

    let result = 0;
    for (let i = 0; i < pin.length; i++) {
        result |= pin.charCodeAt(i) ^ validPin.charCodeAt(i);
    }
    return result === 0;
}

/**
 * Check if demo mode is enabled (based on environment variables)
 */
export async function isDemoEnabled(): Promise<boolean> {
    return env.demo.enabled;
}

export async function signUp(formData: FormData) {
    const supabase = await createClient()

    const data = {
        email: formData.get('email') as string,
        password: formData.get('password') as string,
    }

    const { data: signUpData, error } = await supabase.auth.signUp(data)

    if (error) {
        return { error: error.message }
    }

    // If user is auto-confirmed (email confirmation is off), redirect to welcome
    if (signUpData?.user?.email_confirmed_at || signUpData?.session) {
        revalidatePath('/', 'layout')
        redirect('/dashboard/welcome')
    }

    // Otherwise return success (email confirmation required)
    revalidatePath('/', 'layout')
    return { success: true }
}

export async function signIn(formData: FormData) {
    const supabase = await createClient()

    const data = {
        email: formData.get('email') as string,
        password: formData.get('password') as string,
    }

    const { error } = await supabase.auth.signInWithPassword(data)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard/welcome')
}

export async function signOut() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    revalidatePath('/', 'layout')
    redirect('/')
}

export async function signInWithGoogle() {
    const supabase = await createClient()

    // Get the base URL (works for both local and production)
    // Get the base URL
    let baseUrl = process.env.NEXT_PUBLIC_SITE_URL

    if (!baseUrl) {
        if (process.env.NODE_ENV === 'production') {
            // Default to custom domain in production
            baseUrl = 'https://soulprintengine.ai'
        } else if (process.env.VERCEL_URL) {
            // Fallback for Vercel previews if NODE_ENV is somehow not prod or handled differently
            baseUrl = `https://${process.env.VERCEL_URL}`
        } else {
            // Local development
            baseUrl = 'http://localhost:3000'
        }
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${baseUrl}/auth/callback`,
            queryParams: {
                prompt: 'select_account',
            },
        },
    })

    if (error) {
        return { error: error.message }
    }

    if (data.url) {
        redirect(data.url)
    }
}

export async function signInAsDemo() {
    // Check if demo mode is enabled
    if (!env.demo.enabled) {
        return { error: 'Demo mode is not enabled' }
    }

    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
        email: env.demo.email,
        password: env.demo.password
    })

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard/chat')
}
