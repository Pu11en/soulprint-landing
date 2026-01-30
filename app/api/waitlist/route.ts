/**
 * Waitlist API - Add email to Streak CRM pipeline
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const STREAK_API_KEY = process.env.STREAK_API_KEY!;
const STREAK_PIPELINE_KEY = process.env.STREAK_PIPELINE_KEY!;

export async function POST(request: Request) {
  try {
    const { email, name } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    // Create a box (lead) in Streak pipeline using v2 API
    const boxResponse = await fetch(`https://api.streak.com/api/v2/pipelines/${STREAK_PIPELINE_KEY}/boxes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(STREAK_API_KEY + ':').toString('base64')}`,
      },
      body: JSON.stringify({
        name: name || email.split('@')[0], // Use name or email prefix
        notes: `Waitlist signup from soulprintengine.ai\nEmail: ${email}\nDate: ${new Date().toISOString()}`,
      }),
    });

    if (!boxResponse.ok) {
      const errorText = await boxResponse.text();
      console.error('[Waitlist] Streak box creation failed:', errorText);
      // Don't expose Streak errors to user
      return NextResponse.json({ error: 'Failed to join waitlist' }, { status: 500 });
    }

    const box = await boxResponse.json();

    // Add email as a contact to the box
    const contactResponse = await fetch(`https://api.streak.com/api/v1/boxes/${box.key}/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(STREAK_API_KEY + ':').toString('base64')}`,
      },
      body: JSON.stringify({
        email: email,
      }),
    });

    if (!contactResponse.ok) {
      console.warn('[Waitlist] Failed to add contact to box, but box was created');
    }

    console.log(`[Waitlist] Added ${email} to Streak pipeline`);

    return NextResponse.json({ 
      success: true,
      message: "You're on the list! We'll reach out soon.",
    });

  } catch (error) {
    console.error('[Waitlist] Error:', error);
    return NextResponse.json({ 
      error: 'Something went wrong. Please try again.' 
    }, { status: 500 });
  }
}
