'use server'

import { createClient } from '@/lib/supabase/server'
import { createStreakLead } from '@/lib/streak'
import { redirect } from 'next/navigation'
import { env } from '@/lib/env'

// Constants for validation
const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;

export async function registerFromGate(prevState: unknown, formData: FormData) {
    const name = (formData.get('name') as string)?.trim();
    const email = (formData.get('email') as string)?.trim().toLowerCase();
    const password = formData.get('password') as string;
    const accessCode = (formData.get('accessCode') as string)?.trim();
    const nda = formData.get('nda') === 'on';

    // Input validation
    if (!email || !password || !name || !accessCode) {
        return { error: 'Missing required fields' }
    }

    // Validate name length
    if (name.length > MAX_NAME_LENGTH) {
        return { error: 'Name is too long' }
    }

    // Validate email format and length
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > MAX_EMAIL_LENGTH) {
        return { error: 'Invalid email format' }
    }

    // Validate password strength
    if (password.length < MIN_PASSWORD_LENGTH) {
        return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }
    }

    if (!nda) {
        return { error: 'You must agree to the NDA to enter.' }
    }

    // Access Code Validation - uses environment variable with fallback
    const validAccessCode = env.gate.accessCode;
    if (accessCode !== validAccessCode) {
        // Log failed attempt (without revealing the correct code)
        console.warn(`Invalid access code attempt from: ${email}`);
        return { error: 'Invalid Access Code. Entry denied.' }
    }

    const supabase = await createClient()

    // 1. Sign Up (Create Account)
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: name,
                // We'll update nda_agreed in the profile after, or trigger it here if Supabase copies metadata
                nda_agreed: true
            }
        }
    })

    if (authError) {
        return { error: authError.message }
    }

    const user = authData.user

    if (user) {
        // 2. Log to Streak (CRM) - Non-blocking
        // We do this concurrently so user doesn't wait for CRM
        createStreakLead(name, email, true).catch(err => console.error('Streak logging failed', err))

        // 3. Update Profile (Redundant backup if metadata sync fails, but good for enforcement)
        const { error: profileError } = await supabase
            .from('profiles')
            .update({
                nda_agreed: true,
                usage_count: 0
            })
            .eq('id', user.id)

        if (profileError) {
            console.error('Failed to update profile NDA status', profileError)
        }
    }

    // 4. Redirect
    // If email confirmation is required, this flow stops here usually.
    // Assuming "Immediate Access" implies Disabled Email Confirmation (or Auto-Confirm) in Supabase Settings.
    // If confirmation IS required, Supabase returns a session = null usually.

    // Check if we have a session to know if we can proceed
    if (authData.session) {
        redirect('/dashboard/welcome') // Or /questionnaire
    } else {
        // Email confirmation flow
        return { success: true, message: 'Check your email to confirm your entry.' }
    }
}
