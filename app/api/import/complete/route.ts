/**
 * Import Completion Callback
 * Called by RLM when processing is done - sends email + push notification
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { handleAPIError } from '@/lib/api/error-handler';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function generateSoulPrintReadyEmail(userName: string, memoryBuilding = false) {
  const displayName = userName || 'there';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.soulprintengine.ai';

  // Add a note about memory improving if still building
  const memoryNote = memoryBuilding
    ? `<p style="margin: 0 0 24px; color: #EA580C; font-size: 14px; line-height: 1.6; text-align: center;">
        🧠 Memory is still building in the background — the more you chat, the better it gets!
       </p>`
    : '';

  return {
    subject: '✨ Your SoulPrint is Ready!',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 480px; background-color: #111; border-radius: 12px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #222;">
              <img src="https://soulprintengine.ai/images/soulprintlogomain.png" alt="SoulPrint" width="48" height="48" style="display: inline-block;">
              <h1 style="margin: 16px 0 0; color: #fff; font-size: 24px; font-weight: 700;">SoulPrint</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; color: #fff; font-size: 20px; text-align: center;">Hey ${displayName}! 🎉</p>
              <p style="margin: 0 0 24px; color: #EA580C; font-size: 18px; font-weight: 600; text-align: center;">
                Your SoulPrint is ready!
              </p>
              <p style="margin: 0 0 24px; color: #999; font-size: 15px; line-height: 1.6; text-align: center;">
                We've analyzed your conversations and created a unique AI personality that understands you.
              </p>
              <p style="margin: 0 0 24px; color: #999; font-size: 15px; line-height: 1.6; text-align: center;">
                Your AI now remembers your preferences, communication style, and the things that matter to you.
              </p>

              ${memoryNote}

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${appUrl}/chat" style="display: inline-block; padding: 16px 32px; background-color: #EA580C; color: #000; font-size: 16px; font-weight: 700; text-decoration: none; border-radius: 8px;">
                      Start Chatting
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #666; font-size: 13px; line-height: 1.6; text-align: center;">
                The more you chat, the smarter your SoulPrint becomes.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #0a0a0a; text-align: center; border-top: 1px solid #222;">
              <p style="margin: 0; color: #666; font-size: 12px;">
                © 2026 SoulPrint by ArcheForge
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      user_id,
      // Progressive availability: soulprint_ready comes first, memory_building continues
      soulprint_ready,
      memory_building,
      // Legacy params (for backwards compatibility)
      chunks_embedded,
      processing_time
    } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    const isProgressiveMode = soulprint_ready === true;
    console.log(`[ImportComplete] ${isProgressiveMode ? 'SoulPrint ready' : 'Full processing complete'} for user ${user_id}`);
    console.log(`[ImportComplete] Time: ${processing_time?.toFixed(1)}s${memory_building ? ' (memory still building)' : ''}`);

    const supabase = getSupabaseAdmin();

    // Get user profile (email/display_name/push_subscription columns may not exist in some deployments)
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, archetype')
      .eq('user_id', user_id)
      .single();

    if (profileError || !profile) {
      console.error('[ImportComplete] Profile not found:', profileError);
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get email from auth.users (the source of truth for user email)
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user_id);
    if (authError) {
      console.error('[ImportComplete] Auth user fetch failed:', authError);
    }
    const userEmail = authUser?.user?.email;
    const displayName = authUser?.user?.user_metadata?.display_name || authUser?.user?.user_metadata?.name || null;

    // Send email notification
    if (userEmail) {
      const emailContent = generateSoulPrintReadyEmail(displayName, memory_building);
      const emailResult = await sendEmail({
        to: userEmail,
        subject: emailContent.subject,
        html: emailContent.html,
      });

      if (emailResult.success) {
        console.log(`[ImportComplete] Email sent to ${userEmail}`);
      } else {
        console.error(`[ImportComplete] Email failed: ${emailResult.error}`);
      }
    } else {
      console.warn(`[ImportComplete] No email found for user ${user_id}`);
    }

    // Web Push disabled - push_subscription column doesn't exist in current schema
    // TODO: Add push_subscription column to user_profiles and re-enable
    // if (profile.push_subscription) {
    //   try {
    //     await sendPushNotification(profile.push_subscription, {
    //       title: '✨ Your SoulPrint is Ready!',
    //       body: 'Your AI now understands you. Start chatting!',
    //       url: '/chat',
    //     });
    //     console.log(`[ImportComplete] Push notification sent`);
    //   } catch (e) {
    //     console.error(`[ImportComplete] Push failed:`, e);
    //   }
    // }

    return NextResponse.json({
      success: true,
      email_sent: !!userEmail,
      push_sent: false, // Disabled until push_subscription column exists
    });

  } catch (error) {
    return handleAPIError(error, 'API:ImportComplete');
  }
}

// Web Push notification helper
async function sendPushNotification(
  subscription: any,
  payload: { title: string; body: string; url?: string }
) {
  // Web Push requires VAPID keys - check if configured
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[Push] VAPID keys not configured, skipping push');
    return;
  }

  // Dynamic import to avoid issues if web-push not installed
  const webpush = await import('web-push').catch(() => null);
  if (!webpush) {
    console.warn('[Push] web-push package not installed');
    return;
  }

  webpush.default.setVapidDetails(
    'mailto:support@soulprintengine.ai',
    vapidPublicKey,
    vapidPrivateKey
  );

  await webpush.default.sendNotification(
    subscription,
    JSON.stringify(payload)
  );
}
