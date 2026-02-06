/**
 * Queue processing after upload - calls process-server or Motia backend
 * The client can navigate away; the request will complete in the background
 * 
 * Key insight: We MUST await process-server because Vercel kills fire-and-forget
 * With Motia: Fire-and-forget IS allowed - Motia handles the pipeline
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { startMotiaImport } from '@/lib/motia-client';
import { checkRateLimit } from '@/lib/rate-limit';

// Feature flag for Motia backend
const USE_MOTIA = process.env.USE_MOTIA_BACKEND === 'true';

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

    // Rate limit check
    const rateLimited = await checkRateLimit(user.id, 'expensive');
    if (rateLimited) return rateLimited;

    const { storagePath, filename, fileSize, isExtracted } = await request.json();

    if (!storagePath) {
      return NextResponse.json({ error: 'storagePath required' }, { status: 400 });
    }

    console.log(`[QueueProcessing] isExtracted: ${isExtracted}, filename: ${filename}, useMotia: ${USE_MOTIA}`);

    // --- Duplicate import guard ---
    // Check if this user already has a processing import to prevent concurrent imports
    const { data: existingProfile } = await adminSupabase
      .from('user_profiles')
      .select('import_status, processing_started_at')
      .eq('user_id', user.id)
      .single();

    if (existingProfile?.import_status === 'processing') {
      const startedAt = existingProfile.processing_started_at
        ? new Date(existingProfile.processing_started_at).getTime()
        : Date.now();
      const elapsedMs = Date.now() - startedAt;
      const elapsedMinutes = Math.round(elapsedMs / 1000 / 60);
      const STUCK_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

      if (elapsedMs < STUCK_THRESHOLD_MS) {
        // Import is still fresh -- reject the duplicate
        console.log(`[QueueProcessing] Duplicate import rejected for user ${user.id} (${elapsedMinutes}min elapsed)`);
        return NextResponse.json(
          {
            error: 'Import already in progress. Please wait for it to complete.',
            status: 'processing',
            elapsedMinutes,
          },
          { status: 409 }
        );
      }

      // Import appears stuck (>= 15 min) -- allow retry
      console.warn(
        `[QueueProcessing] Stuck import detected (${elapsedMinutes}min), allowing retry for user ${user.id}`
      );
    }

    // Update user profile to show processing started
    await adminSupabase.from('user_profiles').upsert({
      user_id: user.id,
      import_status: 'processing',
      import_error: null, // Clear any previous error
      processing_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    
    // === MOTIA BACKEND PATH ===
    // Event-driven pipeline with built-in observability
    if (USE_MOTIA) {
      console.log(`[QueueProcessing] Using Motia backend for user ${user.id}`);
      
      // Get public URL for the uploaded file
      const { data: urlData } = adminSupabase.storage
        .from('imports')
        .getPublicUrl(storagePath.replace('imports/', ''));
      
      const fileUrl = urlData?.publicUrl;
      if (!fileUrl) {
        return NextResponse.json({ error: 'Could not get file URL' }, { status: 500 });
      }
      
      // Fire-and-forget to Motia - it handles the pipeline
      const motiaResult = await startMotiaImport(user.id, fileUrl, filename);
      
      if (!motiaResult.success) {
        await adminSupabase.from('user_profiles').update({
          import_status: 'failed',
          import_error: motiaResult.error,
          updated_at: new Date().toISOString(),
        }).eq('user_id', user.id);
        
        return NextResponse.json({ 
          success: false, 
          error: motiaResult.error 
        }, { status: 500 });
      }
      
      // Motia accepted the job - return immediately
      return NextResponse.json({ 
        success: true, 
        message: 'Import started (Motia)',
        backend: 'motia'
      });
    }
    
    // === LEGACY PATH (process-server) ===
    console.log(`[QueueProcessing] Starting for user ${user.id}, path: ${storagePath}, size: ${fileSize}`);
    
    // IMPORTANT: We MUST await this. Fire-and-forget does NOT work on Vercel.
    // Vercel terminates the function after response is sent, killing any pending promises.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.soulprintengine.ai';

    try {
      const response = await fetch(`${baseUrl}/api/import/process-server`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-User-Id': user.id,
        },
        body: JSON.stringify({ storagePath, userId: user.id, filename, isExtracted }),
        signal: AbortSignal.timeout(290000), // 290s timeout (slightly less than maxDuration)
      });
      
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
      if (fetchError instanceof Error && fetchError.name === 'TimeoutError') {
        console.error('[QueueProcessing] Process server timed out after 290s');
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
      try {
        await adminSupabase.from('user_profiles').update({
          import_status: 'failed',
          import_error: error instanceof Error ? error.message : 'Processing failed',
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId);
      } catch (e) {
        console.error('[QueueProcessing] Failed to mark as failed:', e);
      }
    }
    
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to process' 
    }, { status: 500 });
  }
}
