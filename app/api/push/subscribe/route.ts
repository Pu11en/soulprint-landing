/**
 * Push Notification Subscription API
 * Saves push subscription to user profile for later notifications
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const subscription = await request.json();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    // Save subscription to user profile
    const { error: updateError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        push_subscription: subscription,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (updateError) {
      console.error('[Push] Failed to save subscription:', updateError);
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
    }

    console.log(`[Push] Subscription saved for user ${user.id}`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Push] Error:', error);
    return NextResponse.json({ error: 'Subscription failed' }, { status: 500 });
  }
}

// Unsubscribe endpoint
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Remove subscription from user profile
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        push_subscription: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[Push] Failed to remove subscription:', updateError);
      return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 });
    }

    console.log(`[Push] Subscription removed for user ${user.id}`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Push] Error:', error);
    return NextResponse.json({ error: 'Unsubscribe failed' }, { status: 500 });
  }
}

// Get VAPID public key for client
export async function GET() {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;

  if (!vapidPublicKey) {
    return NextResponse.json({ error: 'Push not configured' }, { status: 503 });
  }

  return NextResponse.json({ publicKey: vapidPublicKey });
}
