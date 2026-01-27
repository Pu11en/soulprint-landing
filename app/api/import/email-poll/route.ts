import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  findEmailsWithExportLinks,
  extractConversationsFromEmail,
  markEmailAsProcessed,
  isEmailProcessed,
} from '@/lib/gmail-reader';
import {
  parseGPTExport,
  importGPTConversationsFast,
} from '@/lib/soulprint/import/gpt-parser';

// Allow long running (up to 5 minutes)
export const maxDuration = 300;
export const runtime = 'nodejs';

// Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/import/email-poll
 * Poll Gmail for forwarded ChatGPT exports and process them
 * 
 * Can be triggered by cron or manually
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('📧 [Email Import] Starting email poll...');

  // Optional: verify cron secret for scheduled runs
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // Allow both cron secret auth and no auth (for manual testing)
  if (cronSecret && authHeader && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: {
    processed: string[];
    skipped: string[];
    errors: string[];
  } = {
    processed: [],
    skipped: [],
    errors: [],
  };

  try {
    // Find emails with ZIP attachments from the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    console.log('📧 [Email Import] Searching for emails with export links...');
    const emails = await findEmailsWithExportLinks(20, sevenDaysAgo);
    console.log(`📧 [Email Import] Found ${emails.length} emails with export links`);

    for (const email of emails) {
      try {
        // Check if already processed
        const processed = await isEmailProcessed(email.messageId);
        if (processed) {
          console.log(`📧 [Email Import] Skipping already processed: ${email.subject}`);
          results.skipped.push(email.messageId);
          continue;
        }

        console.log(`📧 [Email Import] Processing: ${email.subject} from ${email.from}`);

        // Extract conversations.json from ZIP
        const extracted = await extractConversationsFromEmail(email);
        if (!extracted) {
          console.log(`📧 [Email Import] No conversations.json found in: ${email.subject}`);
          results.skipped.push(email.messageId);
          continue;
        }

        // Find user by email address
        const { data: user, error: userError } = await supabaseAdmin
          .from('profiles')
          .select('id, email')
          .eq('email', extracted.senderEmail)
          .single();

        if (userError || !user) {
          // Try auth.users table as fallback
          const { data: authUser } = await supabaseAdmin.auth.admin.listUsers();
          const matchedUser = authUser?.users?.find(
            u => u.email?.toLowerCase() === extracted.senderEmail
          );

          if (!matchedUser) {
            console.log(`📧 [Email Import] No user found for email: ${extracted.senderEmail}`);
            results.errors.push(`No user found for: ${extracted.senderEmail}`);
            continue;
          }

          // Process for this user
          await processImport(matchedUser.id, extracted.conversationsJson, email.messageId);
          results.processed.push(email.messageId);
        } else {
          // Process for found user
          await processImport(user.id, extracted.conversationsJson, email.messageId);
          results.processed.push(email.messageId);
        }

        // Mark as processed
        await markEmailAsProcessed(email.messageId);

      } catch (emailError) {
        const errorMsg = emailError instanceof Error ? emailError.message : 'Unknown error';
        console.error(`📧 [Email Import] Error processing email ${email.messageId}:`, errorMsg);
        results.errors.push(`${email.subject}: ${errorMsg}`);
      }
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`📧 [Email Import] Complete in ${duration.toFixed(2)}s`);
    console.log(`📧 [Email Import] Results:`, results);

    return NextResponse.json({
      success: true,
      duration: `${duration.toFixed(2)}s`,
      results,
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('📧 [Email Import] Fatal error:', errorMsg);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}

/**
 * Process the import for a user
 */
async function processImport(
  userId: string,
  conversationsJson: string,
  emailId: string
): Promise<void> {
  console.log(`📧 [Email Import] Importing for user ${userId}...`);

  // Parse the export
  const { conversations, totalMessages } = parseGPTExport(conversationsJson);
  console.log(`📧 [Email Import] Parsed ${conversations.length} conversations, ${totalMessages} messages`);

  if (conversations.length === 0) {
    throw new Error('No conversations found in export');
  }

  // Create import job record
  const { data: job } = await supabaseAdmin
    .from('import_jobs')
    .insert({
      user_id: userId,
      source: 'chatgpt-email',
      status: 'processing',
      total_messages: totalMessages,
      processed_messages: 0,
      metadata: { emailId },
    })
    .select()
    .single();

  // Run fast import (no embeddings)
  const progress = await importGPTConversationsFast(
    userId,
    conversations,
    async (p) => {
      if (job?.id) {
        await supabaseAdmin
          .from('import_jobs')
          .update({
            processed_messages: p.processedMessages,
            status: p.processedConversations === p.totalConversations ? 'completed' : 'processing',
          })
          .eq('id', job.id);
      }
    }
  );

  // Mark job complete
  if (job?.id) {
    await supabaseAdmin
      .from('import_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        error_message: progress.errors.length > 0 ? progress.errors.slice(0, 5).join('; ') : null,
      })
      .eq('id', job.id);
  }

  console.log(`📧 [Email Import] Import complete for user ${userId}: ${progress.processedMessages} messages`);
}

/**
 * GET /api/import/email-poll
 * Get status of email import processing
 */
export async function GET() {
  try {
    // Get recent import jobs from email
    const { data: jobs } = await supabaseAdmin
      .from('import_jobs')
      .select('*')
      .eq('source', 'chatgpt-email')
      .order('started_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      recentJobs: jobs || [],
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
