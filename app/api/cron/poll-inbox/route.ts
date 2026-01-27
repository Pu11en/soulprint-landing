/**
 * Gmail Inbox Poller
 * Polls waitlist@archeforge.com for ChatGPT export ZIPs
 */

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

// Cron endpoint - should be protected by Vercel cron or similar
export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minute max

/**
 * Get authenticated Gmail client using OAuth2
 */
async function getGmailClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground' // Redirect URI used for refresh token
  );
  
  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });
  
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Get Supabase admin client
 */
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function GET(request: Request) {
  // Verify cron secret if configured
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const gmail = await getGmailClient();
    const supabase = getSupabaseAdmin();
    
    // Search for unread emails with ZIP attachments
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread has:attachment filename:zip',
      maxResults: 10,
    });
    
    const messages = response.data.messages || [];
    const results: Array<{ email: string; status: string; error?: string }> = [];
    
    for (const message of messages) {
      try {
        const result = await processEmail(gmail, supabase, message.id!);
        results.push(result);
      } catch (error) {
        results.push({
          email: 'unknown',
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    return NextResponse.json({
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('Inbox poll error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to poll inbox' },
      { status: 500 }
    );
  }
}

/**
 * Process a single email message
 */
async function processEmail(
  gmail: ReturnType<typeof google.gmail>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  messageId: string
): Promise<{ email: string; status: string; error?: string }> {
  // Get full message details
  const message = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });
  
  // Extract sender email
  const headers = message.data.payload?.headers || [];
  const fromHeader = headers.find(h => h.name?.toLowerCase() === 'from');
  const senderEmail = extractEmail(fromHeader?.value || '');
  
  if (!senderEmail) {
    return { email: 'unknown', status: 'skipped', error: 'Could not extract sender email' };
  }
  
  // Look up user by email
  const { data: userData, error: userError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', senderEmail)
    .single();
  
  // If no profiles table, try auth.users via admin API
  let userId: string | null = userData?.id || null;
  
  if (!userId) {
    // Try to find user in auth.users
    const { data: authData } = await supabase.auth.admin.listUsers();
    const authUser = authData?.users?.find((u: { email?: string }) => u.email === senderEmail);
    userId = authUser?.id || null;
  }
  
  if (!userId) {
    // Mark as read but don't process - user not registered
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { removeLabelIds: ['UNREAD'] },
    });
    return { email: senderEmail, status: 'skipped', error: 'User not found in system' };
  }
  
  // Find ZIP attachment
  const parts = message.data.payload?.parts || [];
  const zipPart = findZipAttachment(parts);
  
  if (!zipPart || !zipPart.body?.attachmentId) {
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { removeLabelIds: ['UNREAD'] },
    });
    return { email: senderEmail, status: 'skipped', error: 'No ZIP attachment found' };
  }
  
  // Download the attachment
  const attachment = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: zipPart.body.attachmentId,
  });
  
  if (!attachment.data.data) {
    return { email: senderEmail, status: 'error', error: 'Could not download attachment' };
  }
  
  // Decode base64 attachment
  const zipBuffer = Buffer.from(attachment.data.data, 'base64');
  
  // Create import job record
  const { data: importJob, error: jobError } = await supabase
    .from('import_jobs')
    .insert({
      user_id: userId,
      status: 'pending',
      source_email: senderEmail,
      source_type: 'chatgpt_export',
    })
    .select()
    .single();
  
  if (jobError || !importJob) {
    return { email: senderEmail, status: 'error', error: `Failed to create import job: ${jobError?.message}` };
  }
  
  // Call the process endpoint to handle the import
  const processUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/import/process`;
  
  try {
    const processResponse = await fetch(processUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        importJobId: importJob.id,
        userId,
        zipBase64: zipBuffer.toString('base64'),
      }),
    });
    
    if (!processResponse.ok) {
      const error = await processResponse.text();
      throw new Error(`Process endpoint returned ${processResponse.status}: ${error}`);
    }
  } catch (error) {
    // Update job status to failed
    await supabase
      .from('import_jobs')
      .update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Processing failed',
      })
      .eq('id', importJob.id);
    
    return { email: senderEmail, status: 'error', error: error instanceof Error ? error.message : 'Processing failed' };
  }
  
  // Mark email as read
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['UNREAD'] },
  });
  
  return { email: senderEmail, status: 'processing' };
}

/**
 * Extract email address from "Name <email>" format
 */
function extractEmail(from: string): string | null {
  const match = from.match(/<([^>]+)>/) || from.match(/([^\s<>]+@[^\s<>]+)/);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Recursively find ZIP attachment in message parts
 */
function findZipAttachment(parts: Array<{
  mimeType?: string;
  filename?: string;
  body?: { attachmentId?: string };
  parts?: Array<unknown>;
}>): { body?: { attachmentId?: string } } | null {
  for (const part of parts) {
    if (part.filename?.toLowerCase().endsWith('.zip') ||
        part.mimeType === 'application/zip' ||
        part.mimeType === 'application/x-zip-compressed') {
      return part;
    }
    
    // Check nested parts
    if (part.parts) {
      const nested = findZipAttachment(part.parts as typeof parts);
      if (nested) return nested;
    }
  }
  
  return null;
}
