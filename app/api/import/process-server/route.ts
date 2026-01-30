/**
 * Server-side import processing for large files (mobile-friendly)
 * Downloads from storage, parses, creates soulprint via RLM
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

interface ConversationMessage {
  role: string;
  content: string;
}

interface ParsedConversation {
  id: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: string;
}

export async function POST(request: Request) {
  try {
    // Auth check - support both normal auth and internal server-to-server calls
    let userId: string;
    
    const internalUserId = request.headers.get('X-Internal-User-Id');
    if (internalUserId) {
      // Internal call from queue-processing
      userId = internalUserId;
    } else {
      // Normal authenticated request
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      userId = user.id;
    }

    const body = await request.json();
    const storagePath = body.storagePath;
    
    if (!storagePath) {
      return NextResponse.json({ error: 'storagePath required' }, { status: 400 });
    }

    console.log(`[ProcessServer] Starting for user ${userId}, path: ${storagePath}`);
    
    const adminSupabase = getSupabaseAdmin();
    
    // Download from storage
    const pathParts = storagePath.split('/');
    const bucket = pathParts[0];
    const filePath = pathParts.slice(1).join('/');
    
    console.log(`[ProcessServer] Downloading from ${bucket}/${filePath}...`);
    
    const { data: fileData, error: downloadError } = await adminSupabase.storage
      .from(bucket)
      .download(filePath);
    
    if (downloadError || !fileData) {
      console.error('[ProcessServer] Download error:', downloadError);
      return NextResponse.json({ error: 'Failed to download file' }, { status: 500 });
    }
    
    const arrayBuffer = await fileData.arrayBuffer();
    const sizeMB = (arrayBuffer.byteLength / 1024 / 1024).toFixed(1);
    console.log(`[ProcessServer] Downloaded ${sizeMB}MB`);
    
    let rawConversations: any[];
    
    // Check if it's JSON directly or a ZIP
    if (filePath.endsWith('.json')) {
      // Direct JSON file (extracted on client)
      console.log('[ProcessServer] Parsing JSON directly...');
      const text = new TextDecoder().decode(arrayBuffer);
      rawConversations = JSON.parse(text);
    } else {
      // ZIP file - extract conversations.json
      console.log('[ProcessServer] Extracting from ZIP...');
      const zip = await JSZip.loadAsync(arrayBuffer);
      const conversationsFile = zip.file('conversations.json');
      
      if (!conversationsFile) {
        adminSupabase.storage.from(bucket).remove([filePath]);
        return NextResponse.json({ error: 'conversations.json not found in ZIP' }, { status: 400 });
      }
      
      const conversationsJson = await conversationsFile.async('string');
      rawConversations = JSON.parse(conversationsJson);
    }
    
    console.log(`[ProcessServer] Parsed ${rawConversations.length} conversations`);
    
    // Clean up storage (don't need the ZIP anymore)
    adminSupabase.storage.from(bucket).remove([filePath]).catch(() => {});
    
    // Parse conversations into our format
    const conversations: ParsedConversation[] = rawConversations.map((conv: any) => {
      const messages: ConversationMessage[] = [];
      
      if (conv.mapping) {
        // ChatGPT format
        const nodes = Object.values(conv.mapping) as any[];
        for (const node of nodes) {
          if (node?.message?.content?.parts?.[0]) {
            const role = node.message.author?.role || 'user';
            const content = node.message.content.parts[0];
            if (typeof content === 'string' && content.trim()) {
              messages.push({ role, content });
            }
          }
        }
      }
      
      return {
        id: conv.id || conv.conversation_id || Math.random().toString(36),
        title: conv.title || 'Untitled',
        messages,
        createdAt: conv.create_time ? new Date(conv.create_time * 1000).toISOString() : new Date().toISOString(),
      };
    }).filter((c: ParsedConversation) => c.messages.length > 0);
    
    console.log(`[ProcessServer] Extracted ${conversations.length} conversations with messages`);
    
    // Calculate stats
    const totalMessages = conversations.reduce((sum, c) => sum + c.messages.length, 0);
    const stats = {
      totalConversations: conversations.length,
      totalMessages,
      activeDays: Math.ceil((Date.now() - new Date(conversations[conversations.length - 1]?.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24)),
    };
    
    // Call RLM for soulprint (send up to 500 conversations)
    const rlmUrl = process.env.RLM_SERVICE_URL;
    let soulprint: any = null;
    let archetype = 'Unique Individual';
    
    if (rlmUrl) {
      console.log(`[ProcessServer] Calling RLM for soulprint...`);
      
      // Prepare conversations for RLM (truncate messages)
      const rlmConversations = conversations.slice(0, 500).map(c => ({
        title: c.title,
        messages: c.messages.slice(0, 25).map(m => ({
          role: m.role,
          content: m.content.slice(0, 400),
        })),
        message_count: c.messages.length,
        createdAt: c.createdAt,
      }));
      
      try {
        const rlmResponse = await fetch(`${rlmUrl}/create-soulprint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            conversations: rlmConversations,
            stats,
          }),
        });
        
        if (rlmResponse.ok) {
          const rlmData = await rlmResponse.json();
          soulprint = rlmData.soulprint;
          archetype = rlmData.archetype || 'Unique Individual';
          console.log(`[ProcessServer] RLM soulprint created: ${archetype}`);
        }
      } catch (rlmError) {
        console.warn('[ProcessServer] RLM failed:', rlmError);
      }
    }
    
    // Generate fallback soulprint if RLM failed
    if (!soulprint) {
      soulprint = {
        archetype: 'The Explorer',
        soulprint_text: `You've had ${totalMessages} messages across ${conversations.length} conversations. Your SoulPrint will evolve as you continue chatting.`,
        stats,
      };
    }
    
    // Save soulprint to user profile
    await adminSupabase.from('user_profiles').upsert({
      user_id: userId,
      soulprint: soulprint,
      soulprint_text: soulprint.soulprint_text || '',
      archetype,
      import_status: 'quick_ready',
      total_conversations: conversations.length,
      total_messages: totalMessages,
      soulprint_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    
    // Create and SAVE chunks directly to DB (since BackgroundSync won't run for server-side flow)
    const chunks = conversations.slice(0, 500).map(c => ({
      user_id: userId,
      conversation_id: c.id,
      title: c.title,
      content: c.messages.slice(0, 15).map(m => `${m.role}: ${m.content}`).join('\n').slice(0, 3000),
      message_count: c.messages.length,
      created_at: c.createdAt,
      is_recent: conversations.indexOf(c) < 100,
    }));
    
    console.log(`[ProcessServer] Saving ${chunks.length} chunks to DB...`);
    
    // Insert chunks in batches of 100
    const CHUNK_BATCH = 100;
    let insertedCount = 0;
    for (let i = 0; i < chunks.length; i += CHUNK_BATCH) {
      const batch = chunks.slice(i, i + CHUNK_BATCH);
      const { error: insertError } = await adminSupabase
        .from('conversation_chunks')
        .insert(batch);
      
      if (insertError) {
        console.error(`[ProcessServer] Chunk insert error (batch ${i}):`, insertError);
      } else {
        insertedCount += batch.length;
      }
    }
    
    console.log(`[ProcessServer] Inserted ${insertedCount}/${chunks.length} chunks`);
    
    // Update profile with chunk count and mark ready for embedding
    await adminSupabase.from('user_profiles').update({
      total_chunks: insertedCount,
      embedding_status: 'pending',
    }).eq('user_id', userId);
    
    // Trigger background embedding (fire and forget)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.soulprintengine.ai';
    fetch(`${baseUrl}/api/import/embed-background`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Internal-User-Id': userId,
      },
    }).catch(err => console.error('[ProcessServer] Embed trigger error:', err));
    
    console.log(`[ProcessServer] Complete! ${insertedCount} chunks saved`);
    
    return NextResponse.json({
      success: true,
      soulprint: {
        ...soulprint,
        stats,
      },
      archetype,
      chunksInserted: insertedCount,
      totalConversations: conversations.length,
      totalMessages,
    });
    
  } catch (error) {
    console.error('[ProcessServer] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Processing failed' 
    }, { status: 500 });
  }
}
