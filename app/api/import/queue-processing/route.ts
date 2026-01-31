/**
 * Queue processing after upload - calls process-server synchronously
 * The client can navigate away; the request will complete in the background
 * 
 * Key insight: We MUST await process-server because Vercel kills fire-and-forget
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min max - must be enough for process-server

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: Request) {
  const adminSupabase = getSupabaseAdmin();
  let userId: string | null = null;
  
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    userId = user.id;

    const { storagePath, filename, fileSize } = await request.json();
    
    if (!storagePath) {
      return NextResponse.json({ error: 'storagePath required' }, { status: 400 });
    }

    // Update user profile to show processing started
    await adminSupabase.from('user_profiles').upsert({
      user_id: user.id,
      import_status: 'processing',
      import_error: null, // Clear any previous error
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    
    console.log(`[QueueProcessing] Starting for user ${user.id}, path: ${storagePath}, size: ${fileSize}`);
    
    // IMPORTANT: We MUST await this. Fire-and-forget does NOT work on Vercel.
    // Vercel terminates the function after response is sent, killing any pending promises.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.soulprintengine.ai';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 290000); // 290s timeout (slightly less than maxDuration)
    
    try {
      const response = await fetch(`${baseUrl}/api/import/process-server`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Internal-User-Id': user.id,
        },
        body: JSON.stringify({ storagePath, userId: user.id, filename }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[QueueProcessing] Process server failed:', errorData);
        
        // Mark as failed in DB
        await adminSupabase.from('user_profiles').update({
          import_status: 'failed',
          import_error: errorData.error || `HTTP ${response.status}`,
          updated_at: new Date().toISOString(),
        }).eq('user_id', user.id);
        
        return NextResponse.json({ 
          success: false, 
          error: errorData.error || 'Processing failed' 
        }, { status: 500 });
      }
      
      const result = await response.json();
      console.log(`[QueueProcessing] Process server completed for user ${user.id}:`, {
        chunksInserted: result.chunksInserted,
        totalConversations: result.totalConversations,
      });
      
      return NextResponse.json({
        success: true,
        message: 'Import complete!',
        status: 'ready',
        ...result,
      });
      
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error('[QueueProcessing] Process server timed out');
        await adminSupabase.from('user_profiles').update({
          import_status: 'failed',
          import_error: 'Processing timed out. Please try with a smaller file or try again later.',
          updated_at: new Date().toISOString(),
        }).eq('user_id', user.id);
        
        return NextResponse.json({ 
          success: false, 
          error: 'Processing timed out' 
        }, { status: 504 });
      }
      
      throw fetchError;
    }
    
  } catch (error) {
    console.error('[QueueProcessing] Error:', error);
    
    // Try to mark as failed if we have userId
    if (userId) {
      await adminSupabase.from('user_profiles').update({
        import_status: 'failed',
        import_error: error instanceof Error ? error.message : 'Processing failed',
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId).catch(() => {});
    }
    
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to process' 
    }, { status: 500 });
  }
}
