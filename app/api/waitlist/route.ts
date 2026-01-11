import { NextResponse } from 'next/server';
import { sendConfirmationEmail } from '@/lib/email';
import { env } from '@/lib/env';
import { rateLimiters, getRateLimitHeaders, getClientIP, sanitizeInput } from '@/lib/security';

// Streak Configuration - Now uses environment variables
const STREAK_API_KEY = env.streak.apiKey;
const PIPELINE_KEY = env.streak.pipelineKey;
const STAGE_KEY_LEAD_COLLECTED = '5001';

// Field Keys from your pipeline.json
const FIELD_KEYS = {
    ROLE: '1001',
    AFFILIATION: '1002'
};

export async function POST(request: Request) {
    try {
        // Rate limiting
        const clientIP = getClientIP(request.headers);
        const rateLimitResult = rateLimiters.waitlist(clientIP);

        if (!rateLimitResult.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                {
                    status: 429,
                    headers: getRateLimitHeaders(rateLimitResult)
                }
            );
        }

        const body = await request.json();
        // Sanitize inputs
        const name = sanitizeInput((body.name || '').trim());
        const email = (body.email || '').trim().toLowerCase();

        if (!name || !email) {
            return NextResponse.json(
                { error: 'Name and Email are required' },
                { status: 400 }
            );
        }

        // Validate name length
        if (name.length > 100) {
            return NextResponse.json(
                { error: 'Name is too long' },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        // Check if Streak is configured
        if (!STREAK_API_KEY || !PIPELINE_KEY) {
            console.warn('⚠️ Streak CRM not configured - sending confirmation email only');
            await sendConfirmationEmail(email, name);
            return NextResponse.json({ success: true, message: 'Added to waitlist' });
        }

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
            throw new Error(`Failed to create box: ${createBoxResponse.statusText}`);
        }

        const box = await createBoxResponse.json();
        const boxKey = box.key;

        // 2. Add Email as a Comment/Note
        const noteContent = `Lead Contact Info:\nEmail: ${email}\nName: ${name}\nNDA Agreed: YES\n\nSubmitted via Website Waitlist`;

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
        await sendConfirmationEmail(email, name);


        return NextResponse.json({ success: true, boxKey });
    } catch (error) {
        console.error('Waitlist Submission Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
