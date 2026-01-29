/**
 * Import Process Endpoint
 * Downloads from R2 and processes - handles any file size
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import { chunkConversations } from '@/lib/import/chunker';
import { embedChunks, storeChunks } from '@/lib/import/embedder';
import type { ParsedConversation, ParsedMessage, ChatGPTConversation, ChatGPTMessage } from '@/lib/import/parser';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface ProcessRequest {
  importJobId: string;
  userId: string;
  storagePath: string;
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function downloadAndParseConversations(storagePath: string): Promise<ParsedConversation[]> {
  console.log('[Process] Downloading from Supabase Storage...');
  
  const supabase = getSupabaseAdmin();
  
  // storagePath is like "imports/user-id/timestamp-filename.zip"
  const pathParts = storagePath.split('/');
  const bucket = pathParts[0]; // "imports"
  const filePath = pathParts.slice(1).join('/'); // "user-id/timestamp-filename.zip"
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(filePath);
  
  if (error) {
    console.error('[Process] Download error:', error);
    throw new Error(`Download failed: ${error.message}`);
  }
  
  if (!data) {
    throw new Error('No data received from storage');
  }
  
  const arrayBuffer = await data.arrayBuffer();
  console.log(`[Process] Downloaded ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`);
  
  // Load ZIP
  console.log('[Process] Loading ZIP...');
  const zip = await JSZip.loadAsync(arrayBuffer);
  console.log('[Process] ZIP loaded, extracting conversations.json...');
  
  // Extract only conversations.json
  const conversationsFile = zip.file('conversations.json');
  if (!conversationsFile) {
    throw new Error('conversations.json not found in ZIP');
  }
  
  const conversationsJson = await conversationsFile.async('string');
  console.log(`[Process] conversations.json: ${(conversationsJson.length / 1024 / 1024).toFixed(1)}MB`);
  console.log('[Process] Parsing JSON...');
  
  const raw: ChatGPTConversation[] = JSON.parse(conversationsJson);
  return raw.map(parseConversation).filter(c => c.messages.length > 0);
}

async function deleteFromStorage(storagePath: string) {
  try {
    const supabase = getSupabaseAdmin();
    const pathParts = storagePath.split('/');
    const bucket = pathParts[0];
    const filePath = pathParts.slice(1).join('/');
    
    await supabase.storage.from(bucket).remove([filePath]);
  } catch (e) {
    console.error('Storage cleanup error:', e);
  }
}

function parseConversation(raw: ChatGPTConversation): ParsedConversation {
  const messages: ParsedMessage[] = [];
  const orderedMessages = getOrderedMessages(raw.mapping, raw.current_node);
  
  for (const node of orderedMessages) {
    if (!node.message) continue;
    const msg = node.message;
    const content = extractContent(msg.content);
    
    if (!content?.trim()) continue;
    if (msg.author.role === 'system' || msg.author.role === 'tool') continue;
    
    messages.push({
      id: msg.id,
      role: msg.author.role as 'user' | 'assistant',
      content: content.trim(),
      timestamp: msg.create_time ? new Date(msg.create_time * 1000) : undefined,
    });
  }
  
  return {
    id: raw.id,
    title: raw.title || 'Untitled',
    createdAt: new Date(raw.create_time * 1000),
    updatedAt: new Date(raw.update_time * 1000),
    messages,
  };
}

function getOrderedMessages(
  mapping: ChatGPTConversation['mapping'],
  currentNode?: string
): Array<{ id: string; message?: ChatGPTMessage }> {
  const ordered: Array<{ id: string; message?: ChatGPTMessage }> = [];
  
  let rootId: string | undefined;
  for (const [id, node] of Object.entries(mapping)) {
    if (!node.parent || !mapping[node.parent]) {
      rootId = id;
      break;
    }
  }
  if (!rootId) return ordered;
  
  const targetPath = new Set<string>();
  if (currentNode) {
    let nodeId: string | undefined = currentNode;
    while (nodeId && mapping[nodeId]) {
      targetPath.add(nodeId);
      nodeId = mapping[nodeId].parent;
    }
  }
  
  function traverse(nodeId: string) {
    const node = mapping[nodeId];
    if (!node) return;
    if (node.message) ordered.push({ id: nodeId, message: node.message });
    if (node.children.length > 0) {
      const next = node.children.find(c => targetPath.has(c)) || node.children[0];
      traverse(next);
    }
  }
  
  traverse(rootId);
  return ordered;
}

function extractContent(content: ChatGPTMessage['content']): string {
  if (!content) return '';
  if (content.text) return content.text;
  if (content.parts?.length) {
    return content.parts.filter((p): p is string => typeof p === 'string').join('\n');
  }
  return '';
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const supabase = getSupabaseAdmin();
  let importJobId: string | undefined;
  let storagePath: string | undefined;
  
  try {
    const body: ProcessRequest = await request.json();
    importJobId = body.importJobId;
    storagePath = body.storagePath;
    const { userId } = body;
    
    if (!importJobId || !userId || !storagePath) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    await supabase
      .from('import_jobs')
      .update({ status: 'processing' })
      .eq('id', importJobId);
    
    // Download and parse from R2
    console.log(`[Import ${importJobId}] Downloading from R2...`);
    const conversations = await downloadAndParseConversations(storagePath);
    console.log(`[Import ${importJobId}] Found ${conversations.length} conversations`);
    
    // Clean up R2
    deleteFromStorage(storagePath);
    
    if (conversations.length === 0) {
      await supabase.from('import_jobs').update({
        status: 'completed',
        total_chunks: 0,
        processed_chunks: 0,
        completed_at: new Date().toISOString(),
      }).eq('id', importJobId);
      
      return NextResponse.json({ success: true, conversations: 0, chunks: 0 });
    }
    
    // Chunk
    console.log(`[Import ${importJobId}] Chunking...`);
    const chunks = chunkConversations(conversations);
    console.log(`[Import ${importJobId}] Created ${chunks.length} chunks`);
    
    await supabase.from('import_jobs').update({ total_chunks: chunks.length }).eq('id', importJobId);
    
    // Embed
    console.log(`[Import ${importJobId}] Embedding...`);
    const embeddedChunks = await embedChunks(chunks, (p, t) => {
      if (p % 100 === 0) console.log(`[Import ${importJobId}] Embedded ${p}/${t}`);
    });
    
    // Store
    console.log(`[Import ${importJobId}] Storing...`);
    await storeChunks(userId, importJobId, embeddedChunks, async (s, t) => {
      if (s % 100 === 0 || s === t) {
        console.log(`[Import ${importJobId}] Stored ${s}/${t}`);
        await supabase.from('import_jobs').update({ processed_chunks: s }).eq('id', importJobId);
      }
    });
    
    await supabase.from('import_jobs').update({
      status: 'completed',
      processed_chunks: chunks.length,
      completed_at: new Date().toISOString(),
    }).eq('id', importJobId);
    
    // Update user profile to mark embeddings complete
    await supabase.from('user_profiles').update({
      import_status: 'complete',
      processed_chunks: chunks.length,
      total_chunks: chunks.length,
      embeddings_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);
    
    console.log(`[Import ${importJobId}] Complete!`);
    return NextResponse.json({ success: true, conversations: conversations.length, chunks: chunks.length });
    
  } catch (error) {
    console.error('Import error:', error);
    
    if (importJobId) {
      await supabase.from('import_jobs').update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }).eq('id', importJobId);
    }
    
    if (storagePath) {
      deleteFromStorage(storagePath);
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
  
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('import_jobs').select('*').eq('id', jobId).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  
  return NextResponse.json(data);
}
