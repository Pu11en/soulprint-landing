/**
 * Quick Import - Phase 1
 * Generates instant soulprint (~30 seconds) so user can start chatting immediately
 * Triggers background embedding job for full memory
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import type { ParsedConversation, ParsedMessage, ChatGPTConversation, ChatGPTMessage } from '@/lib/import/parser';
import { generateQuickSoulprint, soulprintToContext } from '@/lib/import/soulprint';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds should be plenty for quick soulprint

interface QuickImportRequest {
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
  console.log('[Quick] Downloading from Supabase Storage...');
  
  const supabase = getSupabaseAdmin();
  
  // storagePath is like "imports/user-id/timestamp-filename.zip"
  // We need to extract bucket and path
  const pathParts = storagePath.split('/');
  const bucket = pathParts[0]; // "imports"
  const filePath = pathParts.slice(1).join('/'); // "user-id/timestamp-filename.zip"
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(filePath);
  
  if (error) {
    console.error('[Quick] Download error:', error);
    throw new Error(`Download failed: ${error.message}`);
  }
  
  if (!data) {
    throw new Error('No data received from storage');
  }
  
  const arrayBuffer = await data.arrayBuffer();
  console.log(`[Quick] Downloaded ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`);
  
  console.log('[Quick] Loading ZIP...');
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  const conversationsFile = zip.file('conversations.json');
  if (!conversationsFile) {
    throw new Error('conversations.json not found in ZIP');
  }
  
  const conversationsJson = await conversationsFile.async('string');
  console.log(`[Quick] Parsing ${(conversationsJson.length / 1024 / 1024).toFixed(1)}MB JSON...`);
  
  const raw: ChatGPTConversation[] = JSON.parse(conversationsJson);
  return raw.map(parseConversation).filter(c => c.messages.length > 0);
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
  
  try {
    const body: QuickImportRequest = await request.json();
    importJobId = body.importJobId;
    const { userId, storagePath } = body;
    
    if (!importJobId || !userId || !storagePath) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    console.log(`[Quick ${importJobId}] Starting quick soulprint generation...`);
    
    // Update job status
    await supabase
      .from('import_jobs')
      .update({ status: 'processing' })
      .eq('id', importJobId);
    
    // Download and parse
    const conversations = await downloadAndParseConversations(storagePath);
    console.log(`[Quick ${importJobId}] Found ${conversations.length} conversations`);
    
    if (conversations.length === 0) {
      return NextResponse.json({ 
        error: 'No conversations found in export' 
      }, { status: 400 });
    }
    
    // Generate quick soulprint
    console.log(`[Quick ${importJobId}] Generating soulprint...`);
    const soulprint = await generateQuickSoulprint(conversations);
    const soulprintText = soulprintToContext(soulprint);
    
    console.log(`[Quick ${importJobId}] Soulprint generated:`, {
      conversations: soulprint.totalConversations,
      messages: soulprint.totalMessages,
      interests: soulprint.interests,
      facts: soulprint.facts.length,
    });
    
    // Upsert user profile with soulprint
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        soulprint: soulprint,
        soulprint_text: soulprintText,
        import_status: 'quick_ready',
        total_conversations: soulprint.totalConversations,
        total_messages: soulprint.totalMessages,
        soulprint_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });
    
    if (profileError) {
      console.error(`[Quick ${importJobId}] Profile upsert error:`, profileError);
      // Don't fail - soulprint is nice to have
    }
    
    console.log(`[Quick ${importJobId}] Quick soulprint complete! Triggering background embeddings...`);
    
    // Trigger background embedding job (fire and forget)
    const processUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/import/process`;
    
    fetch(processUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        importJobId,
        userId,
        storagePath,
      }),
    }).then(() => {
      console.log(`[Quick ${importJobId}] Background embedding job triggered`);
    }).catch(err => {
      console.error(`[Quick ${importJobId}] Failed to trigger background job:`, err);
    });
    
    return NextResponse.json({ 
      success: true,
      soulprint: {
        conversations: soulprint.totalConversations,
        messages: soulprint.totalMessages,
        interests: soulprint.interests,
        traits: soulprint.personality.traits,
        factsExtracted: soulprint.facts.length,
      },
      message: 'Quick soulprint ready! You can start chatting while we process the rest.',
    });
    
  } catch (error) {
    console.error('[Quick] Error:', error);
    
    if (importJobId) {
      await supabase.from('import_jobs').update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }).eq('id', importJobId);
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Quick import failed' },
      { status: 500 }
    );
  }
}
