/**
 * Debug endpoint to test Gmail API connection
 */

import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // Check env vars
    const hasClientId = !!process.env.GMAIL_CLIENT_ID;
    const hasClientSecret = !!process.env.GMAIL_CLIENT_SECRET;
    const hasRefreshToken = !!process.env.GMAIL_REFRESH_TOKEN;
    
    if (!hasClientId || !hasClientSecret || !hasRefreshToken) {
      return NextResponse.json({
        status: 'missing_credentials',
        hasClientId,
        hasClientSecret,
        hasRefreshToken,
      });
    }
    
    // Try to connect
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );
    
    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    });
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Get profile to verify connection
    const profile = await gmail.users.getProfile({ userId: 'me' });
    
    // List recent emails
    const messages = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: 5,
    });
    
    // Get details of first message if any
    let firstMessageDetails = null;
    if (messages.data.messages && messages.data.messages.length > 0) {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: messages.data.messages[0].id!,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });
      firstMessageDetails = {
        id: msg.data.id,
        headers: msg.data.payload?.headers,
      };
    }
    
    return NextResponse.json({
      status: 'connected',
      email: profile.data.emailAddress,
      messagesTotal: profile.data.messagesTotal,
      unreadCount: messages.data.messages?.length || 0,
      unreadMessages: messages.data.messages?.map(m => m.id) || [],
      firstMessageDetails,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
