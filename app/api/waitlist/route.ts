/**
 * Waitlist API - Email confirmation flow
 * 1. User submits email → we send confirmation email
 * 2. User clicks link → confirmed, added to Streak
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { sendEmail, generateWaitlistConfirmationEmail } from '@/lib/email';

export const runtime = 'nodejs';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: Request) {
  try {
    const { email, name } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Check if already confirmed
    const { data: existing } = await supabase
      .from('pending_waitlist')
      .select('confirmed')
      .eq('email', email.toLowerCase())
      .single();

    if (existing?.confirmed) {
      return NextResponse.json({ 
        success: true,
        message: "You're already on the list!",
      });
    }

    // Generate unique token
    const token = randomBytes(32).toString('hex');

    // Upsert pending signup (updates if email exists)
    const { error: insertError } = await supabase
      .from('pending_waitlist')
      .upsert({
        email: email.toLowerCase(),
        name: name?.trim() || null,
        token,
        confirmed: false,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'email',
      });

    if (insertError) {
      console.error('[Waitlist] DB error:', insertError);
      return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }

    // Generate confirmation URL
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://soulprintengine.ai';
    const confirmUrl = `${baseUrl}/api/waitlist/confirm?token=${token}`;

    // Send confirmation email
    const emailContent = generateWaitlistConfirmationEmail(name || '', confirmUrl);
    
    const emailResult = await sendEmail({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
    });
    
    if (!emailResult.success) {
      console.error('[Waitlist] Email send failed:', emailResult.error);
      return NextResponse.json({ error: 'Failed to send confirmation email' }, { status: 500 });
    }
    
    console.log(`[Waitlist] Confirmation email sent to ${email}`);

    return NextResponse.json({ 
      success: true,
      message: "Check your email to confirm your spot!",
      requiresConfirmation: true,
    });

  } catch (error) {
    console.error('[Waitlist] Error:', error);
    return NextResponse.json({ 
      error: 'Something went wrong. Please try again.' 
    }, { status: 500 });
  }
}
