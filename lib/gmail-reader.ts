/**
 * Gmail Reader for ChatGPT Export Import
 * Reads forwarded emails with ZIP attachments and extracts conversations.json
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

export interface EmailWithAttachment {
  messageId: string;
  from: string;
  subject: string;
  date: Date;
  attachmentId: string;
  attachmentFilename: string;
}

export interface ExtractedConversations {
  email: EmailWithAttachment;
  conversationsJson: string;
  senderEmail: string;
}

/**
 * Find recent emails with ZIP attachments (likely ChatGPT exports)
 */
export async function findEmailsWithZipAttachments(
  maxResults: number = 10,
  afterDate?: Date
): Promise<EmailWithAttachment[]> {
  const emails: EmailWithAttachment[] = [];

  // Build search query - look for emails with attachments
  let query = 'has:attachment filename:zip';
  if (afterDate) {
    const dateStr = afterDate.toISOString().split('T')[0].replace(/-/g, '/');
    query += ` after:${dateStr}`;
  }

  try {
    // List messages matching query
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
    });

    const messages = listResponse.data.messages || [];

    for (const msg of messages) {
      if (!msg.id) continue;

      // Get full message details
      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      });

      const headers = fullMessage.data.payload?.headers || [];
      const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';
      const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || '';
      const dateHeader = headers.find(h => h.name?.toLowerCase() === 'date')?.value;

      // Find ZIP attachments
      const parts = fullMessage.data.payload?.parts || [];
      for (const part of parts) {
        if (part.filename?.endsWith('.zip') && part.body?.attachmentId) {
          emails.push({
            messageId: msg.id,
            from,
            subject,
            date: dateHeader ? new Date(dateHeader) : new Date(),
            attachmentId: part.body.attachmentId,
            attachmentFilename: part.filename,
          });
        }
      }

      // Also check nested parts (for multipart messages)
      for (const part of parts) {
        if (part.parts) {
          for (const nestedPart of part.parts) {
            if (nestedPart.filename?.endsWith('.zip') && nestedPart.body?.attachmentId) {
              emails.push({
                messageId: msg.id,
                from,
                subject,
                date: dateHeader ? new Date(dateHeader) : new Date(),
                attachmentId: nestedPart.body.attachmentId,
                attachmentFilename: nestedPart.filename,
              });
            }
          }
        }
      }
    }

    return emails;
  } catch (error) {
    console.error('Error fetching emails:', error);
    throw error;
  }
}

/**
 * Extract sender's email address from "From" header
 */
function extractEmailAddress(from: string): string {
  // Handle formats like "Name <email@example.com>" or just "email@example.com"
  const match = from.match(/<([^>]+)>/) || from.match(/([^\s<>]+@[^\s<>]+)/);
  return match ? match[1].toLowerCase() : from.toLowerCase();
}

/**
 * Download attachment and extract conversations.json from ZIP
 */
export async function extractConversationsFromEmail(
  email: EmailWithAttachment
): Promise<ExtractedConversations | null> {
  try {
    // Download the attachment
    const attachment = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: email.messageId,
      id: email.attachmentId,
    });

    if (!attachment.data.data) {
      console.error('No attachment data found');
      return null;
    }

    // Decode base64 attachment (Gmail uses URL-safe base64)
    const zipBuffer = Buffer.from(attachment.data.data, 'base64');

    // Extract conversations.json from ZIP
    const zip = new JSZip();
    const contents = await zip.loadAsync(zipBuffer);
    
    const conversationsFile = contents.file('conversations.json');
    if (!conversationsFile) {
      console.error('conversations.json not found in ZIP');
      return null;
    }

    const conversationsJson = await conversationsFile.async('text');
    const senderEmail = extractEmailAddress(email.from);

    return {
      email,
      conversationsJson,
      senderEmail,
    };
  } catch (error) {
    console.error('Error extracting conversations from email:', error);
    throw error;
  }
}

/**
 * Mark email as processed by adding a label
 */
export async function markEmailAsProcessed(messageId: string): Promise<void> {
  try {
    // First, try to get or create a "SoulPrint-Processed" label
    let labelId: string | null = null;

    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const existingLabel = labelsResponse.data.labels?.find(
      l => l.name === 'SoulPrint-Processed'
    );

    if (existingLabel?.id) {
      labelId = existingLabel.id;
    } else {
      // Create the label
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
    console.error('Error marking email as processed:', error);
    // Non-fatal - don't throw
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
