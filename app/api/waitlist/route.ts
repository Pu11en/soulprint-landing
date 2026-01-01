import { NextResponse } from 'next/server';
import { sendConfirmationEmail } from '@/lib/email';


// Streak Configuration
const STREAK_API_KEY = 'strk_LitL1WFFkGdFSuTpHRQDNYIZQ2l';
const PIPELINE_KEY = 'agxzfm1haWxmb29nYWVyNQsSDE9yZ2FuaXphdGlvbiIOYXJjaGVmb3JnZS5jb20MCxIIV29ya2Zsb3cYgIClntjvsAoM';
const STAGE_KEY_LEAD_COLLECTED = '5001';

// Field Keys from your pipeline.json
const FIELD_KEYS = {
    ROLE: '1001',
    AFFILIATION: '1002'
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, email } = body;

        if (!name || !email) {
            return NextResponse.json(
                { error: 'Name and Email are required' },
                { status: 400 }
            );
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
