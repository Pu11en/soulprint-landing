/**
 * Mark user as having pending background sync
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { totalChunks, totalRaw } = await request.json();

    const adminSupabase = getSupabaseAdmin();
    
    await adminSupabase
      .from('user_profiles')
      .update({ 
        embedding_status: 'pending_sync',
        embedding_progress: 0,
        total_chunks: totalChunks || 0,
        pending_raw: totalRaw || 0,
      })
      .eq('user_id', user.id);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[MarkPending] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
