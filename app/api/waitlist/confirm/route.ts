/**
 * Waitlist Confirmation Endpoint
 * Handles email confirmation links → adds to Streak CRM
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const STREAK_API_KEY = process.env.STREAK_API_KEY!;
const STREAK_PIPELINE_KEY = process.env.STREAK_PIPELINE_KEY!;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return redirectWithMessage('error', 'Invalid confirmation link');
  }

  const supabase = getSupabaseAdmin();

  // Find pending signup by token
  const { data: pending, error: findError } = await supabase
    .from('pending_waitlist')
    .select('*')
    .eq('token', token)
    .single();

  if (findError || !pending) {
    return redirectWithMessage('error', 'Invalid or expired confirmation link');
  }

  if (pending.confirmed) {
    return redirectWithMessage('success', "You're already confirmed!");
  }

  // Add to Streak CRM
  let streakBoxKey = null;
  try {
    const boxResponse = await fetch(`https://api.streak.com/api/v2/pipelines/${STREAK_PIPELINE_KEY}/boxes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(STREAK_API_KEY + ':').toString('base64')}`,
      },
      body: JSON.stringify({
        name: `${pending.name || pending.email.split('@')[0]} (${pending.email})`,
        notes: [
          '✅ CONFIRMED WAITLIST',
          '─────────────────',
          `Name: ${pending.name || 'N/A'}`,
          `Email: ${pending.email}`,
          `Source: soulprintengine.ai`,
          `Signed up: ${pending.created_at}`,
          `Confirmed: ${new Date().toISOString()}`,
        ].join('\n'),
      }),
    });

    if (boxResponse.ok) {
      const box = await boxResponse.json();
      streakBoxKey = box.boxKey;
      console.log(`[Waitlist] ${pending.email} added to Streak (box: ${streakBoxKey})`);
    } else {
      console.error('[Waitlist] Streak error:', await boxResponse.text());
    }
  } catch (streakError) {
    console.error('[Waitlist] Streak failed:', streakError);
    // Continue anyway - we still want to mark as confirmed
  }

  // Mark as confirmed in DB
  const { error: updateError } = await supabase
    .from('pending_waitlist')
    .update({
      confirmed: true,
      confirmed_at: new Date().toISOString(),
      streak_box_key: streakBoxKey,
    })
    .eq('token', token);

  if (updateError) {
    console.error('[Waitlist] DB update error:', updateError);
  }

  return redirectWithMessage('success', "You're on the list! We'll be in touch soon.");
}

function redirectWithMessage(status: 'success' | 'error', message: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://soulprintengine.ai';
  const url = new URL('/waitlist-confirmed', baseUrl);
  url.searchParams.set('status', status);
  url.searchParams.set('message', message);
  return NextResponse.redirect(url);
}
