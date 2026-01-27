/**
 * Debug endpoint to see email body content
 */

import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const messageId = url.searchParams.get('id');
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );
    
    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    });
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // If no ID, get the first unread
    let targetId: string | null = messageId;
    if (!targetId) {
      const messages = await gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread',
        maxResults: 1,
      });
      targetId = messages.data.messages?.[0]?.id ?? null;
    }
    
    if (!targetId) {
      return NextResponse.json({ error: 'No message found' });
    }
    
    const message = await gmail.users.messages.get({
      userId: 'me',
      id: targetId,
      format: 'full',
    });
    
    const headers = message.data.payload?.headers || [];
    const fromHeader = headers.find(h => h.name?.toLowerCase() === 'from');
    const subjectHeader = headers.find(h => h.name?.toLowerCase() === 'subject');
    
    // Extract body
    const body = getEmailBody(message.data.payload);
    
    // Try to find links
    const links = body.match(/https?:\/\/[^\s"'<>]+/gi) || [];
    
    return NextResponse.json({
      id: targetId,
      from: fromHeader?.value,
      subject: subjectHeader?.value,
      bodyLength: body.length,
      bodyPreview: body.substring(0, 2000),
      allLinks: links.slice(0, 20),
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

function getEmailBody(payload: any): string {
  if (!payload) return '';
  
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }
  
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      if (part.mimeType === 'text/html' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      if (part.parts) {
        const nested = getEmailBody(part);
        if (nested) return nested;
      }
    }
  }
  
  return '';
}
