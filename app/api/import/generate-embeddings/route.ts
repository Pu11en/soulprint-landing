import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { generateEmbedding } from '@/lib/aws/embeddings';

// Allow long running (up to 5 minutes - Vercel hobby limit)
export const maxDuration = 300;
export const runtime = 'nodejs';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/import/generate-embeddings
 * Generate embeddings for imported chats that don't have them yet
 * Processes in small batches to avoid AWS throttling
 *
 * Body: { batchSize?: number, maxMessages?: number }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('🔮 [Embedding Gen] Starting background embedding generation...');

  try {
    const supabase = await createClient();

    // Authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const batchSize = Math.min(body.batchSize || 10, 50); // Max 50 per request
    const maxMessages = body.maxMessages || 500; // Process up to 500 per call

    // Get messages without embeddings
    const { data: pending, error: fetchError } = await supabaseAdmin
      .from('imported_chats')
      .select('id, content')
      .eq('user_id', user.id)
      .is('embedding', null)
      .limit(maxMessages);

    if (fetchError) {
      console.error('❌ [Embedding Gen] Fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!pending || pending.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending embeddings',
        stats: { processed: 0, remaining: 0 }
      });
    }

    console.log(`🔮 [Embedding Gen] Found ${pending.length} messages without embeddings`);

    let processed = 0;
    let errors = 0;

    // Process in small batches with delays
    for (let i = 0; i < pending.length; i += batchSize) {
      const batch = pending.slice(i, i + batchSize);

      for (const msg of batch) {
        try {
          // Generate embedding with retry logic built-in
          const embedding = await generateEmbedding(msg.content, {
            maxRetries: 3,
            initialDelay: 500
          });

          if (embedding.length > 0) {
            // Update the record
            const { error: updateError } = await supabaseAdmin
              .from('imported_chats')
              .update({ embedding })
              .eq('id', msg.id);

            if (updateError) {
              console.error(`❌ [Embedding Gen] Update error for ${msg.id}:`, updateError.message);
              errors++;
            } else {
              processed++;
            }
          } else {
            errors++;
          }
        } catch (err) {
          console.error(`❌ [Embedding Gen] Error for ${msg.id}:`, err);
          errors++;
        }
      }

      // Delay between batches to avoid throttling
      if (i + batchSize < pending.length) {
        await new Promise(r => setTimeout(r, 500));
      }

      console.log(`🔮 [Embedding Gen] Progress: ${processed}/${pending.length}`);
    }

    // Get remaining count
    const { count: remainingCount } = await supabaseAdmin
      .from('imported_chats')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('embedding', null);

    const duration = (Date.now() - startTime) / 1000;

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
    console.error('❌ [Embedding Gen] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/import/generate-embeddings
 * Check embedding generation status for current user
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Count messages with and without embeddings
    const { count: withEmbeddings } = await supabaseAdmin
      .from('imported_chats')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('embedding', 'is', null);

    const { count: withoutEmbeddings } = await supabaseAdmin
      .from('imported_chats')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('embedding', null);

    const total = (withEmbeddings || 0) + (withoutEmbeddings || 0);
    const progress = total > 0 ? Math.round((withEmbeddings || 0) / total * 100) : 100;

    return NextResponse.json({
      total,
      withEmbeddings: withEmbeddings || 0,
      withoutEmbeddings: withoutEmbeddings || 0,
      progress,
      isComplete: (withoutEmbeddings || 0) === 0
    });

  } catch (error: unknown) {
    console.error('❌ [Embedding Gen] Status error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
