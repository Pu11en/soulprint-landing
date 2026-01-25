import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import {
  parseGPTExport,
  importGPTConversations,
  importGPTConversationsFast,
  estimateTokenCount,
  GPTConversation,
} from '@/lib/soulprint/import/gpt-parser';

// Allow long running imports (up to 5 minutes - Vercel hobby limit)
export const maxDuration = 300;
export const runtime = 'nodejs';

// Supabase admin client for service role operations
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/import/gpt
 * Import ChatGPT conversation history
 *
 * Body: { conversations: string } - JSON string of conversations.json content
 *
 * Returns streaming progress updates via SSE
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('📥 [GPT Import] Starting import...');

  try {
    console.log('📥 [GPT Import] Creating supabase client...');
    const supabase = await createClient();

    // Authenticate user
    console.log('📥 [GPT Import] Authenticating user...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.log('📥 [GPT Import] Auth failed:', userError?.message);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    console.log('📥 [GPT Import] User authenticated:', user.id);

    // Parse request body
    console.log('📥 [GPT Import] Parsing request body...');
    const body = await request.json();
    const { conversations: conversationsJson, fastMode = true } = body; // Default to fast mode
    console.log('📥 [GPT Import] Body parsed, length:', conversationsJson?.length || 0);
    console.log('📥 [GPT Import] Fast mode:', fastMode);

    if (!conversationsJson) {
      return NextResponse.json(
        { error: 'conversations JSON content is required' },
        { status: 400 }
      );
    }

    // Parse the GPT export
    let parsed: { conversations: GPTConversation[]; totalMessages: number };
    try {
      parsed = parseGPTExport(conversationsJson);
    } catch {
      return NextResponse.json(
        { error: 'Invalid conversations.json format' },
        { status: 400 }
      );
    }

    const { conversations, totalMessages } = parsed;

    if (conversations.length === 0) {
      return NextResponse.json(
        { error: 'No conversations found in export' },
        { status: 400 }
      );
    }

    // Estimate tokens
    const estimatedTokens = estimateTokenCount(conversations);

    // Create import job record
    const { data: job, error: jobError } = await supabaseAdmin
      .from('import_jobs')
      .insert({
        user_id: user.id,
        source: 'chatgpt',
        status: 'processing',
        total_messages: totalMessages,
        processed_messages: 0,
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating import job:', jobError);
      // Continue anyway, just won't have job tracking
    }

    // Run the import - use fast mode by default (no embeddings)
    const importFn = fastMode ? importGPTConversationsFast : importGPTConversations;
    const progress = await importFn(
      user.id,
      conversations,
      async (p) => {
        // Update job progress
        if (job?.id) {
          await supabaseAdmin
            .from('import_jobs')
            .update({
              processed_messages: p.processedMessages,
              status: p.processedConversations === p.totalConversations
                ? 'completed'
                : 'processing',
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
          status: progress.errors.length > 0 ? 'completed' : 'completed',
          completed_at: new Date().toISOString(),
          error_message: progress.errors.length > 0
            ? progress.errors.slice(0, 5).join('; ')
            : null,
        })
        .eq('id', job.id);
    }

    const duration = (Date.now() - startTime) / 1000;

    return NextResponse.json({
      success: true,
      fastMode,
      embeddingsNeeded: fastMode, // If fast mode, embeddings still need to be generated
      stats: {
        conversationsImported: progress.processedConversations,
        messagesImported: progress.processedMessages,
        estimatedTokens,
        errors: progress.errors.length,
        durationSeconds: duration,
      },
      errors: progress.errors.slice(0, 10), // Return first 10 errors
      nextStep: fastMode
        ? 'Call POST /api/import/generate-embeddings to generate embeddings in background'
        : null,
    });

  } catch (error: unknown) {
    const duration = (Date.now() - startTime) / 1000;
    console.error(`❌ [GPT Import] Error after ${duration.toFixed(2)}s:`, error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/import/gpt
 * Get import status and stats for the current user
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's import stats (RPC returns array, take first row)
    const { data: statsData } = await supabaseAdmin.rpc('get_user_message_stats', {
      p_user_id: user.id,
    });
    const stats = Array.isArray(statsData) ? statsData[0] : statsData;

    // Get recent import jobs
    const { data: jobs } = await supabaseAdmin
      .from('import_jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(5);

    // Get count by source
    const { data: sourceCounts } = await supabaseAdmin
      .from('imported_chats')
      .select('source')
      .eq('user_id', user.id);

    const bySource: Record<string, number> = {};
    if (sourceCounts) {
      for (const row of sourceCounts) {
        bySource[row.source] = (bySource[row.source] || 0) + 1;
      }
    }

    return NextResponse.json({
      stats: stats || { native_count: 0, imported_count: 0, total_count: 0 },
      bySource,
      recentJobs: jobs || [],
    });

  } catch (error: unknown) {
    console.error('❌ [GPT Import] Error getting stats:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
