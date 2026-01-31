/**
 * Email sending utility using Resend
 */

import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = 'SoulPrint <noreply@soulprint.so>';

export async function sendSoulprintReadyEmail(
  to: string,
  aiName: string,
  archetype: string
): Promise<boolean> {
  if (!resend) {
    console.log('[Email] Resend not configured, skipping email');
    return false;
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `${aiName} is ready to chat! 🎉`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #EA580C; margin: 0;">Your SoulPrint is Ready!</h1>
          </div>
          
          <p style="font-size: 16px; line-height: 1.6; color: #333;">
            Great news! Your AI has finished analyzing your conversations and is ready to chat.
          </p>
          
          <div style="background: linear-gradient(135deg, #EA580C 0%, #DC2626 100%); border-radius: 12px; padding: 24px; margin: 24px 0; color: white;">
            <p style="margin: 0 0 8px 0; font-size: 14px; opacity: 0.9;">Your AI's name:</p>
            <p style="margin: 0; font-size: 28px; font-weight: bold;">${aiName}</p>
            <p style="margin: 16px 0 0 0; font-size: 14px; opacity: 0.9;">Archetype: ${archetype}</p>
          </div>
          
          <p style="font-size: 16px; line-height: 1.6; color: #333;">
            ${aiName} has learned from your chat history and is ready to assist you with your unique communication style.
          </p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="https://soulprint.so/chat" style="display: inline-block; background: #EA580C; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Start Chatting →
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666; text-align: center;">
            Your SoulPrint will continue to learn and evolve as you chat.
          </p>
        </div>
      `,
    });
    
    console.log(`[Email] Soulprint ready email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send:', error);
    return false;
  }
}
