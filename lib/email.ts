import nodemailer from 'nodemailer';
import { google } from 'googleapis';

const OAuth2 = google.auth.OAuth2;

const oauth2Client = new OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});

async function getTransporter() {
  const accessToken = await oauth2Client.getAccessToken();
  
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.GMAIL_USER,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      accessToken: accessToken.token || '',
    },
  });
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}) {
  try {
    const transporter = await getTransporter();
    
    const result = await transporter.sendMail({
      from: `SoulPrint <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
      text: text || html?.replace(/<[^>]*>/g, ''),
    });
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Email send failed:', error);
    return { success: false, error: String(error) };
  }
}

export function formatTaskEmail({
  aiName,
  taskDescription,
  aiResponse,
}: {
  aiName: string;
  taskDescription: string;
  aiResponse: string;
}) {
  return {
    subject: `${aiName}: ${taskDescription}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 12px; padding: 24px; color: white;">
          <h2 style="margin: 0 0 8px 0; font-size: 20px;">✨ ${aiName}</h2>
          <p style="margin: 0; opacity: 0.7; font-size: 14px;">${taskDescription}</p>
        </div>
        
        <div style="padding: 24px 0; color: #333; line-height: 1.6;">
          ${aiResponse.split('\n').map(p => `<p style="margin: 0 0 12px 0;">${p}</p>`).join('')}
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 16px; text-align: center;">
          <a href="https://soulprint-landing.vercel.app/chat" style="display: inline-block; background: #EA580C; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
            Reply to ${aiName}
          </a>
        </div>
        
        <p style="text-align: center; color: #999; font-size: 12px; margin-top: 24px;">
          Sent by SoulPrint • <a href="https://soulprint-landing.vercel.app/chat" style="color: #999;">Manage tasks</a>
        </p>
      </div>
    `,
  };
}
