/**
 * User self-reset endpoint
 * DELETE /api/user/reset - Any logged-in user can reset their own data
 */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { handleAPIError } from '@/lib/api/error-handler';
import { checkRateLimit } from '@/lib/rate-limit';

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
    // Get current user
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    }

    // Rate limit check
    const rateLimited = await checkRateLimit(user.id, 'standard');
    if (rateLimited) return rateLimited;

    // Check if user wants to keep chat history
    const url = new URL(request.url);
    const keepChatHistory = url.searchParams.get('keepChatHistory') === 'true';

    const userId = user.id;
    const adminSupabase = getSupabaseAdmin();
    const results: Record<string, string> = {};

    // Delete in order (foreign key constraints)

    if (!keepChatHistory) {
      // 1. Delete chat messages
      const { error: chatError, count: chatCount } = await adminSupabase
        .from('chat_messages')
        .delete({ count: 'exact' })
        .eq('user_id', userId);
      results.chat_messages = chatError ? chatError.message : `${chatCount ?? 0} deleted`;

      // 2. Delete conversations
      const { error: convsError, count: convsCount } = await adminSupabase
        .from('conversations')
        .delete({ count: 'exact' })
        .eq('user_id', userId);
      results.conversations = convsError ? convsError.message : `${convsCount ?? 0} deleted`;
    } else {
      results.chat_messages = 'kept';
      results.conversations = 'kept';
    }

    // 3. Delete learned facts
    const { error: factsError, count: factsCount } = await adminSupabase
      .from('learned_facts')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    results.learned_facts = factsError ? factsError.message : `${factsCount ?? 0} deleted`;

    // 4. Delete conversation chunks
    const { error: chunksError, count: chunksCount } = await adminSupabase
      .from('conversation_chunks')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    results.conversation_chunks = chunksError ? chunksError.message : `${chunksCount ?? 0} deleted`;

    // 5. Delete raw conversations
    const { error: rawError, count: rawCount } = await adminSupabase
      .from('raw_conversations')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    results.raw_conversations = rawError ? rawError.message : `${rawCount ?? 0} deleted`;

    // 6. Reset user profile (don't delete, just reset import status + stats)
    // Core fields first (always exist) — this MUST succeed
    const { error: profileError } = await adminSupabase
      .from('user_profiles')
      .update({
        import_status: 'none',
        embedding_status: null,
        total_chunks: 0,
        total_conversations: 0,
        total_messages: 0,
        soulprint_text: null,
        import_error: null,
        processing_started_at: null,
        ai_name: null,
      })
      .eq('user_id', userId);
    results.user_profiles = profileError ? profileError.message : 'reset';

    // v1.2 section columns (may not exist if migration not run yet)
    const { error: sectionsError } = await adminSupabase
      .from('user_profiles')
      .update({
        soul_md: null,
        identity_md: null,
        user_md: null,
        agents_md: null,
        tools_md: null,
      })
      .eq('user_id', userId);
    if (sectionsError) {
      console.log(`[UserReset] v1.2 sections reset skipped (columns may not exist): ${sectionsError.message}`);
    }

    // 7. Reset gamification stats
    const { error: statsError } = await adminSupabase
      .from('user_stats')
      .update({
        total_xp: 0,
        level: 1,
        messages_sent: 0,
        memories_created: 0,
        current_streak: 0,
        longest_streak: 0,
        total_chats: 0,
        total_facts_learned: 0,
        last_active_date: null,
        last_chat_at: null,
      })
      .eq('user_id', userId);
    results.user_stats = statsError ? statsError.message : 'reset';

    // 8. Delete storage files
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

    console.log(`[UserReset] User ${userId} reset their data:`, results);

    return NextResponse.json({
      success: true,
      message: 'Your data has been reset. You can now re-import.',
      results,
    });

  } catch (error) {
    return handleAPIError(error, 'API:UserReset');
  }
}
