import { sendConfirmationEmail } from '@/lib/email';
import { env } from '@/lib/env';

// Streak Configuration - Now uses environment variables
const STREAK_API_KEY = env.streak.apiKey;
const PIPELINE_KEY = env.streak.pipelineKey;
const STAGE_KEY_LEAD_COLLECTED = '5001';

/**
 * Creates a new Lead in Streak (creates Box + adds Comment + sends Email)
 */
export async function createStreakLead(name: string, email: string, ndaAgreed: boolean) {
    try {
        // Check if Streak is configured
        if (!STREAK_API_KEY || !PIPELINE_KEY) {
            console.warn('⚠️ Streak CRM not configured - skipping lead creation. Set STREAK_API_KEY and STREAK_PIPELINE_KEY env vars.');
            // Still send confirmation email even without CRM
            await sendConfirmationEmail(email, name);
            return { success: true, skipped: true, reason: 'Streak not configured' };
        }

        console.log(`Creating Streak Lead for: ${email}`);

        // 1. Create the Box
        const createBoxResponse = await fetch(
            `https://www.streak.com/api/v1/pipelines/${PIPELINE_KEY}/boxes`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Basic ${btoa(STREAK_API_KEY + ':')}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    name: name,
                    stageKey: STAGE_KEY_LEAD_COLLECTED
                })
            }
        );

        if (!createBoxResponse.ok) {
            const errorText = await createBoxResponse.text();
            console.error('Streak Create Box Error:', errorText);
            // We don't throw here to ensure we don't block the user flow if CRM fails
            return { success: false, error: errorText };
        }

        const box = await createBoxResponse.json();
        const boxKey = box.key;

        // 2. Add Email as a Comment/Note
        const noteContent = `Lead Contact Info:\nEmail: ${email}\nName: ${name}\nNDA Agreed: ${ndaAgreed ? 'YES' : 'NO'}\n\nSubmitted via Unified Gate`;

        await fetch(
            `https://www.streak.com/api/v1/boxes/${boxKey}/comments`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${btoa(STREAK_API_KEY + ':')}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    message: noteContent
                })
            }
        );

        // 3. Send Confirmation Email
        // Note: For the Unified Gate flow, the user might be getting a "Welcome" email from Supabase Auth too?
        // But let's keep this as the "Application Received" signal for now.
        // We might want to customize this email to say "Access Granted" instead of "Waitlist".
        await sendConfirmationEmail(email, name);

        return { success: true, boxKey };

    } catch (error) {
        console.error('Streak Integration Error:', error);
        return { success: false, error: String(error) };
    }
}
