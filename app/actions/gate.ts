'use server'

import { createClient } from '@/lib/supabase/server'
import { createStreakLead } from '@/lib/streak'
import { redirect } from 'next/navigation'

export async function registerFromGate(prevState: any, formData: FormData) {
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const accessCode = formData.get('accessCode') as string
    const nda = formData.get('nda') === 'on'

    if (!email || !password || !name || !accessCode) {
        return { error: 'Missing required fields' }
    }

    if (!nda) {
        return { error: 'You must agree to the NDA to enter.' }
    }

    // Access Code Validation
    if (accessCode !== '7423') {
        // We could log this attempt or create a 'waitlist-only' lead, but for now we block.
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
