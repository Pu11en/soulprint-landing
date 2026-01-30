/**
 * Queue processing after upload - fires background job and returns immediately
 * User can close browser after this returns
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

    const { storagePath, filename, fileSize } = await request.json();
    
    if (!storagePath) {
      return NextResponse.json({ error: 'storagePath required' }, { status: 400 });
    }

    const adminSupabase = getSupabaseAdmin();
    
    // Update user profile to show processing started
    await adminSupabase.from('user_profiles').upsert({
      user_id: user.id,
      import_status: 'processing',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    
    console.log(`[QueueProcessing] Queued for user ${user.id}, path: ${storagePath}`);
    
    // Fire background processing - continues even if user disconnects
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.soulprintengine.ai';
    
    fetch(`${baseUrl}/api/import/process-server`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Internal-User-Id': user.id,
      },
      body: JSON.stringify({ storagePath, userId: user.id, filename }),
    }).catch(err => {
      console.error('[QueueProcessing] Fire-and-forget error:', err);
    });
    
    // Return immediately - user can close browser
    return NextResponse.json({
      success: true,
      message: 'Processing started! You can close this page.',
      status: 'processing',
    });
    
  } catch (error) {
    console.error('[QueueProcessing] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to queue' 
    }, { status: 500 });
  }
}
