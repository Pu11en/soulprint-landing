/**
 * Gmail Reader for ChatGPT Export Import
 * Reads forwarded emails containing OpenAI export download links
 * and fetches the ZIP to extract conversations.json
 */

import { google } from 'googleapis';
import JSZip from 'jszip';

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

export interface EmailWithExportLink {
  messageId: string;
  from: string;
  subject: string;
  date: Date;
  downloadUrl: string;
  forwarderEmail: string;
}

export interface ExtractedConversations {
  email: EmailWithExportLink;
  conversationsJson: string;
  senderEmail: string;
}

/**
 * Find recent emails containing ChatGPT export download links
 */
export async function findEmailsWithExportLinks(
  maxResults: number = 20,
  afterDate?: Date
): Promise<EmailWithExportLink[]> {
  const emails: EmailWithExportLink[] = [];

  // Search for emails mentioning OpenAI data export
  // This catches both direct emails from OpenAI and forwarded ones
  let query = '(from:openai OR subject:"data export" OR subject:"export" OR "chat.openai.com" OR "Your data export")';
  if (afterDate) {
    const dateStr = afterDate.toISOString().split('T')[0].replace(/-/g, '/');
    query += ` after:${dateStr}`;
  }

  console.log('📧 [Gmail] Searching with query:', query);

  try {
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
    });

    const messages = listResponse.data.messages || [];
    console.log(`📧 [Gmail] Found ${messages.length} potential emails`);

    for (const msg of messages) {
      if (!msg.id) continue;

      // Get full message with body
      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      });

      const headers = fullMessage.data.payload?.headers || [];
      const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';
      const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || '';
      const dateHeader = headers.find(h => h.name?.toLowerCase() === 'date')?.value;

      // Extract email body
      const body = extractEmailBody(fullMessage.data.payload);
      
      // Look for OpenAI download links in the body
      const downloadUrl = extractOpenAIDownloadLink(body);
      
      if (downloadUrl) {
        console.log(`📧 [Gmail] Found download link in: ${subject}`);
        
        // Get the forwarder's email (the person who forwarded it to us)
        const forwarderEmail = extractEmailAddress(from);
        
        emails.push({
          messageId: msg.id,
          from,
          subject,
          date: dateHeader ? new Date(dateHeader) : new Date(),
          downloadUrl,
          forwarderEmail,
        });
      }
    }

    console.log(`📧 [Gmail] Found ${emails.length} emails with export links`);
    return emails;
  } catch (error) {
    console.error('📧 [Gmail] Error fetching emails:', error);
    throw error;
  }
}

/**
 * Extract email body from message payload
 */
function extractEmailBody(payload: any): string {
  let body = '';

  if (payload.body?.data) {
    body += Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        body += Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        body += Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.parts) {
        // Recursive for nested multipart
        body += extractEmailBody(part);
      }
    }
  }

  return body;
}

/**
 * Extract OpenAI data export download link from email body
 */
function extractOpenAIDownloadLink(body: string): string | null {
  // OpenAI export links look like:
  // https://chat.openai.com/export/download/...
  // or might be in an anchor tag
  
  const patterns = [
    // Direct URL pattern
    /https:\/\/chat\.openai\.com\/[^\s"'<>]+download[^\s"'<>]*/gi,
    // General OpenAI export pattern  
    /https:\/\/[^"'\s<>]*openai[^"'\s<>]*export[^"'\s<>]*/gi,
    // Href pattern in HTML
    /href=["']?(https:\/\/[^"'\s<>]*openai[^"'\s<>]*download[^"'\s<>]*)["']?/gi,
    // Any openai.com URL with export or download
    /https:\/\/[^"'\s<>]*\.openai\.com[^"'\s<>]*(?:export|download)[^"'\s<>]*/gi,
  ];

  for (const pattern of patterns) {
    const matches = body.match(pattern);
    if (matches && matches.length > 0) {
      // Clean up the URL
      let url = matches[0];
      // Remove href=" prefix if present
      url = url.replace(/^href=["']?/, '');
      // Remove trailing quotes or brackets
      url = url.replace(/["'>\]]+$/, '');
      return url;
    }
  }

  return null;
}

/**
 * Extract sender's email address from "From" header
 */
function extractEmailAddress(from: string): string {
  const match = from.match(/<([^>]+)>/) || from.match(/([^\s<>]+@[^\s<>]+)/);
  return match ? match[1].toLowerCase() : from.toLowerCase();
}

/**
 * Download ZIP from OpenAI link and extract conversations.json
 */
export async function extractConversationsFromEmail(
  email: EmailWithExportLink
): Promise<ExtractedConversations | null> {
  try {
    console.log(`📧 [Gmail] Fetching ZIP from: ${email.downloadUrl}`);
    
    // Fetch the ZIP file from OpenAI
    const response = await fetch(email.downloadUrl);
    
    if (!response.ok) {
      console.error(`📧 [Gmail] Failed to fetch ZIP: ${response.status} ${response.statusText}`);
      return null;
    }

    const zipBuffer = await response.arrayBuffer();
    console.log(`📧 [Gmail] Downloaded ${zipBuffer.byteLength} bytes`);

    // Extract conversations.json from ZIP
    const zip = new JSZip();
    const contents = await zip.loadAsync(zipBuffer);
    
    const conversationsFile = contents.file('conversations.json');
    if (!conversationsFile) {
      console.error('📧 [Gmail] conversations.json not found in ZIP');
      // List files in ZIP for debugging
      const files = Object.keys(contents.files);
      console.log('📧 [Gmail] Files in ZIP:', files);
      return null;
    }

    const conversationsJson = await conversationsFile.async('text');
    console.log(`📧 [Gmail] Extracted conversations.json (${conversationsJson.length} chars)`);

    return {
      email,
      conversationsJson,
      senderEmail: email.forwarderEmail,
    };
  } catch (error) {
    console.error('📧 [Gmail] Error extracting conversations:', error);
    throw error;
  }
}

/**
 * Mark email as processed by adding a label
 */
export async function markEmailAsProcessed(messageId: string): Promise<void> {
  try {
    let labelId: string | null = null;

    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const existingLabel = labelsResponse.data.labels?.find(
      l => l.name === 'SoulPrint-Processed'
    );

    if (existingLabel?.id) {
      labelId = existingLabel.id;
    } else {
      const createResponse = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: 'SoulPrint-Processed',
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        },
      });
      labelId = createResponse.data.id || null;
    }

    if (labelId) {
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: [labelId],
        },
      });
    }
  } catch (error) {
    console.error('📧 [Gmail] Error marking email as processed:', error);
  }
}

/**
 * Check if email has already been processed
 */
export async function isEmailProcessed(messageId: string): Promise<boolean> {
  try {
    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'minimal',
    });

    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const processedLabel = labelsResponse.data.labels?.find(
      l => l.name === 'SoulPrint-Processed'
    );

    if (!processedLabel?.id) return false;

    return message.data.labelIds?.includes(processedLabel.id) || false;
  } catch {
    return false;
  }
}

// Legacy export for backwards compatibility
export const findEmailsWithZipAttachments = findEmailsWithExportLinks;
