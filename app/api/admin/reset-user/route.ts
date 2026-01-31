/**
 * Admin endpoint to reset a user's import data
 * DELETE /api/admin/reset-user?userId=xxx
 */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const adminSupabase = getSupabaseAdmin();
    
    // Delete in order (foreign key constraints)
    const results: Record<string, any> = {};
    
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

// Also support GET to list users
export async function GET() {
  try {
    const adminSupabase = getSupabaseAdmin();
    
    const { data, error } = await adminSupabase
      .from('user_profiles')
      .select('user_id, import_status, updated_at')
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
