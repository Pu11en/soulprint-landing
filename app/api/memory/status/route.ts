import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { handleAPIError } from '@/lib/api/error-handler';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ 
        status: 'none',
        hasSoulprint: false,
        stats: null,
      });
    }

    // Check user_profiles for soulprint
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('import_status, import_error, processing_started_at, total_conversations, total_messages, soulprint_generated_at, soulprint_locked, locked_at, embedding_status, embedding_progress, total_chunks, processed_chunks, memory_status')
      .eq('user_id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Error checking profile:', profileError);
    }

    const isLocked = profile?.soulprint_locked === true || profile?.import_status === 'locked';
    const hasSoulprint = isLocked || profile?.import_status === 'complete' || profile?.import_status === 'quick_ready';
    const isFailed = profile?.import_status === 'failed';
    
    const status = isFailed ? 'failed' :
                   isLocked ? 'ready' :
                   hasSoulprint ? 'ready' : 
                   profile?.import_status === 'processing' ? 'processing' : 'none';

    return NextResponse.json({
      status,
      hasSoulprint,
      locked: isLocked,
      failed: isFailed,
      import_error: profile?.import_error || null,
      processing_started_at: profile?.processing_started_at || null,
      embeddingStatus: profile?.embedding_status || null,
      embeddingProgress: profile?.embedding_progress || 0,
      totalChunks: profile?.total_chunks || 0,
      processedChunks: profile?.processed_chunks || 0,
      // Progressive availability: memory_status shows if memory is still building
      // "building" = SoulPrint ready, embeddings in progress (chat works, memory improving)
      // "ready" = Full memory available (embeddings complete)
      memoryStatus: profile?.memory_status || (profile?.embedding_status === 'complete' ? 'ready' : 'building'),
      stats: profile ? {
        totalConversations: profile.total_conversations,
        totalMessages: profile.total_messages,
        generatedAt: profile.soulprint_generated_at,
        lockedAt: profile.locked_at,
      } : null,
    });
  } catch (error) {
    return handleAPIError(error, 'API:MemoryStatus');
  }
}
