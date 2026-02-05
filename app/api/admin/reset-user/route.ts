/**
 * Admin endpoint to reset a user's import data
 * DELETE /api/admin/reset-user?userId=xxx
 */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const ADMIN_EMAILS = [
  'drew@archeforge.com',
  'drewspatterson@gmail.com',
];

async function checkAdminAuth(): Promise<{ authorized: boolean; error?: NextResponse }> {
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  if (!ADMIN_EMAILS.includes(user.email || '')) {
    return { authorized: false, error: NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 }) };
  }

  return { authorized: true };
}

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function DELETE(request: Request) {
  try {
    // Auth check
    const authResult = await checkAdminAuth();
    if (!authResult.authorized) return authResult.error!;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const adminSupabase = getSupabaseAdmin();
    
    // Delete in order (foreign key constraints)
    const results: Record<string, string> = {};
    
    // 1. Delete chat messages
    const { error: chatError, count: chatCount } = await adminSupabase
      .from('chat_messages')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    results.chat_messages = chatError ? chatError.message : `${chatCount ?? 0} deleted`;
    
    // 2. Delete conversation chunks
    const { error: chunksError, count: chunksCount } = await adminSupabase
      .from('conversation_chunks')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    results.conversation_chunks = chunksError ? chunksError.message : `${chunksCount ?? 0} deleted`;
    
    // 3. Delete raw conversations
    const { error: rawError, count: rawCount } = await adminSupabase
      .from('raw_conversations')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    results.raw_conversations = rawError ? rawError.message : `${rawCount ?? 0} deleted`;
    
    // 5. Delete user profile
    const { error: profileError, count: profileCount } = await adminSupabase
      .from('user_profiles')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    results.user_profiles = profileError ? profileError.message : `${profileCount ?? 0} deleted`;
    
    // 6. Delete storage files
    const { data: files } = await adminSupabase.storage
      .from('imports')
      .list(userId);
    
    if (files && files.length > 0) {
      const filePaths = files.map(f => `${userId}/${f.name}`);
      await adminSupabase.storage.from('imports').remove(filePaths);
      results.storage = `${files.length} files deleted`;
    } else {
      results.storage = 'no files';
    }

    console.log(`[AdminReset] Reset user ${userId}:`, results);

    return NextResponse.json({
      success: true,
      userId,
      results,
    });

  } catch (error) {
    console.error('[AdminReset] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Reset failed' 
    }, { status: 500 });
  }
}

// POST for easier API testing (accepts body)
export async function POST(request: Request) {
  try {
    // Auth check
    const authResult = await checkAdminAuth();
    if (!authResult.authorized) return authResult.error!;

    const body = await request.json().catch(() => ({}));
    const userId = body.userId || body.user_id;

    if (!userId) {
      return NextResponse.json({ error: 'userId required in body' }, { status: 400 });
    }

    // Reuse DELETE logic by creating a fake request with query param
    const url = new URL(request.url);
    url.searchParams.set('userId', userId);

    return DELETE(new Request(url.toString(), { method: 'DELETE' }));
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Reset failed'
    }, { status: 500 });
  }
}

// GET to list users or get specific user status
export async function GET(request: Request) {
  try {
    // Auth check
    const authResult = await checkAdminAuth();
    if (!authResult.authorized) return authResult.error!;

    const adminSupabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (userId) {
      // Get detailed status for specific user
      const { data: profile, error: profileError } = await adminSupabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      const { count: chunkCount } = await adminSupabase
        .from('conversation_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      
      const { count: embeddedCount } = await adminSupabase
        .from('conversation_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('embedding', 'is', null);
      
      const { count: messageCount } = await adminSupabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      
      const { data: files } = await adminSupabase.storage
        .from('imports')
        .list(userId);
      
      return NextResponse.json({
        userId,
        profile: profileError ? { error: profileError.message } : profile,
        counts: {
          chunks: chunkCount || 0,
          embedded: embeddedCount || 0,
          messages: messageCount || 0,
          storageFiles: files?.length || 0,
        },
      });
    }
    
    // List all users (import_error column may not exist in older schemas)
    const { data, error } = await adminSupabase
      .from('user_profiles')
      .select('user_id, import_status, embedding_status, total_chunks, updated_at')
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: data });

  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to list users' 
    }, { status: 500 });
  }
}
