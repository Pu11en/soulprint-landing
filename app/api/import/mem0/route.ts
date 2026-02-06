/**
 * Mem0 Import API
 * Imports ChatGPT conversations to Mem0 memory system
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  parseChatGPTExport,
  getStats,
  Mem0Client,
  importToMem0,
  ParsedMessage,
  ChatGPTConversation,
} from '@/lib/mem0';
import { checkRateLimit } from '@/lib/rate-limit';

export const maxDuration = 300; // 5 minutes for large imports
export const dynamic = 'force-dynamic';

interface ImportRequest {
  conversations: unknown[]; // Raw ChatGPT conversations
  userId?: string;         // Override user ID
}

/**
 * POST /api/import/mem0
 * Import ChatGPT conversations to Mem0
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limit check
    const rateLimited = await checkRateLimit(user.id, 'expensive');
    if (rateLimited) return rateLimited;

    // Parse request
    const body: ImportRequest = await request.json();
    const { conversations } = body;

    if (!conversations || !Array.isArray(conversations)) {
      return NextResponse.json(
        { error: 'conversations array required' },
        { status: 400 }
      );
    }

    // Check for Mem0 API key
    const mem0ApiKey = process.env.MEM0_API_KEY;
    if (!mem0ApiKey) {
      return NextResponse.json(
        { error: 'Mem0 not configured (MEM0_API_KEY missing)' },
        { status: 500 }
      );
    }

    // Parse conversations - parseChatGPTExport expects string | ChatGPTConversation[]
    // Cast to ChatGPTConversation[] - parseChatGPTExport will validate the structure
    const messages: ParsedMessage[] = [];
    for await (const msg of parseChatGPTExport(conversations as ChatGPTConversation[])) {
      messages.push(msg);
    }

    // Get stats
    const stats = getStats(messages);
    
    console.log(`[Mem0 Import] User ${user.id}: ${stats.totalMessages} messages, ${stats.totalConversations} conversations`);

    // Import to Mem0
    const client = new Mem0Client({
      mode: 'cloud',
      apiKey: mem0ApiKey,
    });

    const result = await importToMem0(
      client,
      messages,
      user.id,
      {
        batchSize: 25,
        recentFirst: true, // Process recent conversations first
        onProgress: (processed, total) => {
          console.log(`[Mem0 Import] Progress: ${processed}/${total} conversations`);
        },
      }
    );

    console.log(`[Mem0 Import] Complete: ${result.success} success, ${result.failed} failed, ${result.memories} memories created`);

    // Update user profile with import status
    await supabase
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        memory_source: 'mem0',
        conversations_imported: stats.totalConversations,
        messages_imported: stats.totalMessages,
        memories_created: result.memories,
        import_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        imported: result.success,
        failed: result.failed,
        memoriesCreated: result.memories,
      },
    });

  } catch (error) {
    console.error('[Mem0 Import] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/import/mem0
 * Get import status / memory stats
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const mem0ApiKey = process.env.MEM0_API_KEY;
    if (!mem0ApiKey) {
      return NextResponse.json({
        configured: false,
        error: 'Mem0 not configured',
      });
    }

    // Get memory count from Mem0
    const client = new Mem0Client({
      mode: 'cloud',
      apiKey: mem0ApiKey,
    });

    try {
      const memories = await client.getAll({ userId: user.id });
      
      return NextResponse.json({
        configured: true,
        memoryCount: memories.results?.length || 0,
        userId: user.id,
      });
    } catch (mem0Error) {
      return NextResponse.json({
        configured: true,
        memoryCount: 0,
        error: 'Failed to fetch memories',
      });
    }

  } catch (error) {
    console.error('[Mem0 Status] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Status check failed' },
      { status: 500 }
    );
  }
}
