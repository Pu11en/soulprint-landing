/**
 * Import Process Endpoint
 * Orchestrates: parse → chunk → embed → store
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseExportZip } from '@/lib/import/parser';
import { chunkConversations } from '@/lib/import/chunker';
import { embedChunks, storeChunks } from '@/lib/import/embedder';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for large imports

interface ProcessRequest {
  importJobId: string;
  userId: string;
  zipBase64: string;
}

/**
 * Get Supabase admin client
 */
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function POST(request: Request) {
  // Verify authorization (service role key or similar)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const supabase = getSupabaseAdmin();
  let importJobId: string | undefined;
  
  try {
    const body: ProcessRequest = await request.json();
    importJobId = body.importJobId;
    const { userId, zipBase64 } = body;
    
    if (!importJobId || !userId || !zipBase64) {
      return NextResponse.json(
        { error: 'Missing required fields: importJobId, userId, zipBase64' },
        { status: 400 }
      );
    }
    
    // Update job status to processing
    await supabase
      .from('import_jobs')
      .update({ status: 'processing' })
      .eq('id', importJobId);
    
    // 1. Parse the ZIP file
    console.log(`[Import ${importJobId}] Parsing ZIP...`);
    const zipBuffer = Buffer.from(zipBase64, 'base64');
    const conversations = await parseExportZip(zipBuffer);
    
    console.log(`[Import ${importJobId}] Found ${conversations.length} conversations`);
    
    if (conversations.length === 0) {
      await supabase
        .from('import_jobs')
        .update({
          status: 'completed',
          total_chunks: 0,
          processed_chunks: 0,
          completed_at: new Date().toISOString(),
        })
        .eq('id', importJobId);
      
      return NextResponse.json({
        success: true,
        conversations: 0,
        chunks: 0,
      });
    }
    
    // 2. Chunk conversations
    console.log(`[Import ${importJobId}] Chunking conversations...`);
    const chunks = chunkConversations(conversations);
    
    console.log(`[Import ${importJobId}] Created ${chunks.length} chunks`);
    
    // Update job with total chunks
    await supabase
      .from('import_jobs')
      .update({ total_chunks: chunks.length })
      .eq('id', importJobId);
    
    // 3. Embed chunks
    console.log(`[Import ${importJobId}] Embedding chunks...`);
    const embeddedChunks = await embedChunks(chunks, (processed, total) => {
      console.log(`[Import ${importJobId}] Embedded ${processed}/${total} chunks`);
    });
    
    // 4. Store in Supabase
    console.log(`[Import ${importJobId}] Storing chunks...`);
    await storeChunks(userId, importJobId, embeddedChunks, async (stored, total) => {
      console.log(`[Import ${importJobId}] Stored ${stored}/${total} chunks`);
      
      // Update progress periodically
      if (stored % 50 === 0 || stored === total) {
        await supabase
          .from('import_jobs')
          .update({ processed_chunks: stored })
          .eq('id', importJobId);
      }
    });
    
    // 5. Mark job as complete
    await supabase
      .from('import_jobs')
      .update({
        status: 'completed',
        processed_chunks: chunks.length,
        completed_at: new Date().toISOString(),
      })
      .eq('id', importJobId);
    
    console.log(`[Import ${importJobId}] Complete!`);
    
    return NextResponse.json({
      success: true,
      conversations: conversations.length,
      chunks: chunks.length,
    });
    
  } catch (error) {
    console.error('Import processing error:', error);
    
    // Update job status to failed
    if (importJobId) {
      await supabase
        .from('import_jobs')
        .update({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', importJobId);
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    );
  }
}

// Also support GET for status checking
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId parameter' }, { status: 400 });
  }
  
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('import_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  
  return NextResponse.json(data);
}
