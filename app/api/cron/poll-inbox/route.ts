/**
 * Gmail Inbox Poller
 * Polls waitlist@archeforge.com for ChatGPT exports
 * Handles both: ZIP attachments AND forwarded emails with download links
 */

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function getGmailClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );
  
  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });
  
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const gmail = await getGmailClient();
    const supabase = getSupabaseAdmin();
    
    // Search for unread emails - both with attachments AND potential forwarded ChatGPT emails
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread (has:attachment filename:zip OR subject:chatgpt OR subject:export OR from:openai)',
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
    
    return NextResponse.json({ processed: results.length, results });
  } catch (error) {
    console.error('Inbox poll error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to poll inbox' },
      { status: 500 }
    );
  }
}

async function processEmail(
  gmail: ReturnType<typeof google.gmail>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  messageId: string
): Promise<{ email: string; status: string; error?: string }> {
  const message = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });
  
  const headers = message.data.payload?.headers || [];
  const fromHeader = headers.find(h => h.name?.toLowerCase() === 'from');
  const senderEmail = extractEmail(fromHeader?.value || '');
  
  if (!senderEmail) {
    return { email: 'unknown', status: 'skipped', error: 'Could not extract sender email' };
  }
  
  // Look up user
  const { data: userData } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', senderEmail)
    .single();
  
  let userId: string | null = userData?.id || null;
  
  if (!userId) {
    const { data: authData } = await supabase.auth.admin.listUsers();
    const authUser = authData?.users?.find((u: { email?: string }) => u.email === senderEmail);
    userId = authUser?.id || null;
  }
  
  if (!userId) {
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { removeLabelIds: ['UNREAD'] },
    });
    return { email: senderEmail, status: 'skipped', error: 'User not found in system' };
  }
  
  let zipBuffer: Buffer | null = null;
  
  // Method 1: Try to find ZIP attachment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts = (message.data.payload?.parts || []) as any[];
  const zipPart = findZipAttachment(parts);
  
  if (zipPart?.body?.attachmentId) {
    const attachment = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: zipPart.body.attachmentId,
    });
    
    if (attachment.data.data) {
      zipBuffer = Buffer.from(attachment.data.data, 'base64');
    }
  }
  
  // Method 2: If no attachment, look for ChatGPT download link in email body
  if (!zipBuffer) {
    const emailBody = getEmailBody(message.data.payload);
    const downloadUrl = extractChatGPTDownloadLink(emailBody);
    
    if (downloadUrl) {
      console.log(`[Import] Found ChatGPT download link, fetching...`);
      try {
        const response = await fetch(downloadUrl);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          zipBuffer = Buffer.from(arrayBuffer);
        }
      } catch (e) {
        console.error(`[Import] Failed to download from ChatGPT link:`, e);
      }
    }
  }
  
  if (!zipBuffer) {
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { removeLabelIds: ['UNREAD'] },
    });
    return { email: senderEmail, status: 'skipped', error: 'No ZIP attachment or download link found' };
  }
  
  // Create import job
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
  
  // Process the import
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
    await supabase
      .from('import_jobs')
      .update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Processing failed',
      })
      .eq('id', importJob.id);
    
    return { email: senderEmail, status: 'error', error: error instanceof Error ? error.message : 'Processing failed' };
  }
  
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['UNREAD'] },
  });
  
  return { email: senderEmail, status: 'processing' };
}

function extractEmail(from: string): string | null {
  const match = from.match(/<([^>]+)>/) || from.match(/([^\s<>]+@[^\s<>]+)/);
  return match ? match[1].toLowerCase() : null;
}

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
    if (part.parts) {
      const nested = findZipAttachment(part.parts as typeof parts);
      if (nested) return nested;
    }
  }
  return null;
}

/**
 * Extract email body text from message payload
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getEmailBody(payload: any): string {
  if (!payload) return '';
  
  // Direct body
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }
  
  // Check parts
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      if (part.mimeType === 'text/html' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      // Recurse into nested parts
      if (part.parts) {
        const nested = getEmailBody(part);
        if (nested) return nested;
      }
    }
  }
  
  return '';
}

/**
 * Extract ChatGPT export download link from email body
 * ChatGPT sends emails with links like:
 * - https://chatgpt.com/backend-api/accounts/.../export/download
 * - https://chat.openai.com/backend-api/...
 */
function extractChatGPTDownloadLink(body: string): string | null {
  // Common patterns for ChatGPT export download links
  const patterns = [
    /https:\/\/chatgpt\.com\/[^\s"'<>]+export[^\s"'<>]+download[^\s"'<>]*/i,
    /https:\/\/chat\.openai\.com\/[^\s"'<>]+export[^\s"'<>]+download[^\s"'<>]*/i,
    /https:\/\/[^\s"'<>]*openai[^\s"'<>]*\/[^\s"'<>]*export[^\s"'<>]*/i,
    // Generic pattern for download links in ChatGPT emails
    /https:\/\/[^\s"'<>]+\.zip[^\s"'<>]*/i,
  ];
  
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) {
      // Clean up any trailing HTML entities or characters
      let url = match[0].replace(/&amp;/g, '&');
      url = url.replace(/['">\s].*$/, '');
      return url;
    }
  }
  
  return null;
}
