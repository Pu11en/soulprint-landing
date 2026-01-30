/**
 * Gmail OAuth2 Email Sender
 */

import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: process.env.GMAIL_USER,
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const mailOptions = {
      from: `SoulPrint <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[Email] Send failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Format task notification email (for recurring tasks feature)
 */
interface TaskEmailParams {
  aiName: string;
  taskDescription: string;
  aiResponse: string;
  citations?: string[];
}

export function formatTaskEmail({ aiName, taskDescription, aiResponse, citations }: TaskEmailParams) {
  const citationsHtml = citations && citations.length > 0
    ? `<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #333;">
         <p style="color: #888; font-size: 12px; margin: 0 0 8px;">Sources:</p>
         ${citations.map(url => `<a href="${url}" style="color: #EA580C; font-size: 12px; display: block; margin: 4px 0;">${url}</a>`).join('')}
       </div>`
    : '';

  return {
    subject: `${aiName}: ${taskDescription}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin: 0; padding: 20px; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background: #111; border-radius: 12px; padding: 24px;">
    <h2 style="color: #fff; margin: 0 0 16px;">${aiName}</h2>
    <p style="color: #888; margin: 0 0 16px; font-size: 14px;">${taskDescription}</p>
    <div style="color: #ccc; line-height: 1.6; white-space: pre-wrap;">${aiResponse}</div>
    ${citationsHtml}
  </div>
</body>
</html>
    `,
  };
}

export function generateWaitlistConfirmationEmail(name: string, confirmUrl: string) {
  const displayName = name || 'there';
  
  return {
    subject: 'Confirm your SoulPrint waitlist spot',
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
              <p style="margin: 0 0 16px; color: #fff; font-size: 18px;">Hey ${displayName}! 👋</p>
              <p style="margin: 0 0 24px; color: #999; font-size: 15px; line-height: 1.6;">
                Thanks for your interest in SoulPrint — the AI that actually remembers you.
              </p>
              <p style="margin: 0 0 24px; color: #999; font-size: 15px; line-height: 1.6;">
                Click the button below to confirm your spot on our waitlist:
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${confirmUrl}" style="display: inline-block; padding: 16px 32px; background-color: #EA580C; color: #000; font-size: 16px; font-weight: 700; text-decoration: none; border-radius: 8px;">
                      Confirm My Spot
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; color: #666; font-size: 13px; line-height: 1.6;">
                If you didn't sign up for SoulPrint, you can ignore this email.
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
