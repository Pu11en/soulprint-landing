import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { generateEmbedding } from '@/lib/aws/embeddings';

// Allow long running (up to 5 minutes)
export const maxDuration = 300;
export const runtime = 'nodejs';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/cron/generate-embeddings
 * Cron job to generate embeddings for ALL users' imported chats
 * Secured by CRON_SECRET
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('🔮 [Cron Embedding] Starting...');

  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const batchSize = 20;
  const maxMessages = 100; // Process up to 100 per cron run

  try {
    // Get messages without embeddings (across all users)
    const { data: pending, error: fetchError } = await supabaseAdmin
      .from('imported_chats')
      .select('id, content, user_id')
      .is('embedding', null)
      .limit(maxMessages);

    if (fetchError) {
      console.error('❌ [Cron Embedding] Fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!pending || pending.length === 0) {
      console.log('🔮 [Cron Embedding] No pending embeddings');
      return NextResponse.json({
        success: true,
        message: 'No pending embeddings',
        stats: { processed: 0, remaining: 0 }
      });
    }

    console.log(`🔮 [Cron Embedding] Found ${pending.length} messages without embeddings`);

    let processed = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < pending.length; i += batchSize) {
      const batch = pending.slice(i, i + batchSize);

      for (const msg of batch) {
        try {
          const embedding = await generateEmbedding(msg.content, {
            maxRetries: 3,
            initialDelay: 500
          });

          if (embedding.length > 0) {
            const { error: updateError } = await supabaseAdmin
              .from('imported_chats')
              .update({ embedding })
              .eq('id', msg.id);

            if (updateError) {
              console.error(`❌ [Cron Embedding] Update error for ${msg.id}:`, updateError.message);
              errors++;
            } else {
              processed++;
            }
          } else {
            errors++;
          }
        } catch (err) {
          console.error(`❌ [Cron Embedding] Error for ${msg.id}:`, err);
          errors++;
        }
      }

      // Delay between batches
      if (i + batchSize < pending.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Get remaining count
    const { count: remainingCount } = await supabaseAdmin
      .from('imported_chats')
      .select('id', { count: 'exact', head: true })
      .is('embedding', null);

    const duration = (Date.now() - startTime) / 1000;
    console.log(`🔮 [Cron Embedding] Done: ${processed} processed, ${errors} errors, ${remainingCount} remaining in ${duration.toFixed(2)}s`);

    return NextResponse.json({
      success: true,
      stats: {
        processed,
        errors,
        remaining: remainingCount || 0,
        durationSeconds: duration
      }
    });

  } catch (error: unknown) {
    console.error('❌ [Cron Embedding] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET - Status check
 */
export async function GET() {
  const { count: pending } = await supabaseAdmin
    .from('imported_chats')
    .select('id', { count: 'exact', head: true })
    .is('embedding', null);

  const { count: total } = await supabaseAdmin
    .from('imported_chats')
    .select('id', { count: 'exact', head: true });

  return NextResponse.json({
    pendingEmbeddings: pending || 0,
    totalMessages: total || 0,
    progress: total ? Math.round(((total - (pending || 0)) / total) * 100) : 100
  });
}
