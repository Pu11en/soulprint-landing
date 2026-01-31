/**
 * Server-side import processing for large files (mobile-friendly)
 * Downloads from storage, parses, creates soulprint via RLM
 * 
 * Memory limit: ~500MB practical for Vercel (1GB RAM, need headroom)
 * Files >500MB will fail gracefully with a clear error message
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

const MAX_FILE_SIZE_MB = 500; // Vercel memory constraint

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
  const adminSupabase = getSupabaseAdmin();
  let userId: string | null = null;
  
  try {
    // Auth check - support both normal auth and internal server-to-server calls
    const internalUserId = request.headers.get('X-Internal-User-Id');
    if (internalUserId) {
      userId = internalUserId;
    } else {
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
    
    // Update status to processing
    await adminSupabase.from('user_profiles').upsert({
      user_id: userId,
      import_status: 'processing',
      import_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    
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
      throw new Error('Failed to download file from storage');
    }
    
    const arrayBuffer = await fileData.arrayBuffer();
    const sizeMB = arrayBuffer.byteLength / 1024 / 1024;
    console.log(`[ProcessServer] Downloaded ${sizeMB.toFixed(1)}MB`);
    
    // Check file size limit
    if (sizeMB > MAX_FILE_SIZE_MB) {
      // Clean up storage
      adminSupabase.storage.from(bucket).remove([filePath]).catch(() => {});
      throw new Error(`File too large (${sizeMB.toFixed(0)}MB). Maximum is ${MAX_FILE_SIZE_MB}MB. Please export fewer conversations or contact support.`);
    }
    
    let rawConversations: any[];
    
    // Check if it's JSON directly or a ZIP
    if (filePath.endsWith('.json')) {
      console.log('[ProcessServer] Parsing JSON directly...');
      const text = new TextDecoder().decode(arrayBuffer);
      rawConversations = JSON.parse(text);
    } else {
      console.log('[ProcessServer] Extracting from ZIP...');
      const zip = await JSZip.loadAsync(arrayBuffer);
      const conversationsFile = zip.file('conversations.json');
      
      if (!conversationsFile) {
        adminSupabase.storage.from(bucket).remove([filePath]).catch(() => {});
        throw new Error('conversations.json not found in ZIP. Make sure you exported from ChatGPT correctly.');
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
        // ChatGPT format - traverse the mapping properly
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
    
    if (conversations.length === 0) {
      throw new Error('No valid conversations found in export. The file may be empty or in an unsupported format.');
    }
    
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for RLM
        
        const rlmResponse = await fetch(`${rlmUrl}/create-soulprint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            conversations: rlmConversations,
            stats,
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (rlmResponse.ok) {
          const rlmData = await rlmResponse.json();
          soulprint = rlmData.soulprint;
          archetype = rlmData.archetype || 'Unique Individual';
          console.log(`[ProcessServer] RLM soulprint created: ${archetype}`);
        } else {
          console.warn(`[ProcessServer] RLM returned ${rlmResponse.status}`);
        }
      } catch (rlmError: any) {
        if (rlmError.name === 'AbortError') {
          console.warn('[ProcessServer] RLM timed out');
        } else {
          console.warn('[ProcessServer] RLM failed:', rlmError.message);
        }
      }
    }
    
    // Generate fallback soulprint if RLM failed
    if (!soulprint) {
      soulprint = {
        archetype: 'The Explorer',
        soulprint_text: `You've had ${totalMessages.toLocaleString()} messages across ${conversations.length.toLocaleString()} conversations. Your SoulPrint will evolve as you continue chatting.`,
        stats,
      };
      archetype = 'The Explorer';
    }
    
    // Save soulprint to user profile
    await adminSupabase.from('user_profiles').upsert({
      user_id: userId,
      soulprint: soulprint,
      soulprint_text: soulprint.soulprint_text || '',
      archetype,
      import_status: 'quick_ready',
      import_error: null,
      total_conversations: conversations.length,
      total_messages: totalMessages,
      soulprint_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    
    // Create chunks (limit to 500 for now, can expand later)
    const chunks = conversations.slice(0, 500).map((c, idx) => ({
      user_id: userId,
      conversation_id: c.id,
      title: c.title,
      content: c.messages.slice(0, 15).map(m => `${m.role}: ${m.content}`).join('\n').slice(0, 3000),
      message_count: c.messages.length,
      created_at: c.createdAt,
      is_recent: idx < 100,
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
        console.error(`[ProcessServer] Chunk insert error (batch ${i}):`, insertError.message);
      } else {
        insertedCount += batch.length;
      }
    }
    
    console.log(`[ProcessServer] Inserted ${insertedCount}/${chunks.length} chunks`);
    
    // Update profile to ready status
    await adminSupabase.from('user_profiles').update({
      import_status: 'complete',
      total_chunks: insertedCount,
      embedding_status: 'pending',
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);
    
    // Start background embedding - but don't await it
    // This will run in a separate request
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.soulprintengine.ai';
    fetch(`${baseUrl}/api/import/embed-background`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Internal-User-Id': userId,
      },
    }).catch(err => console.error('[ProcessServer] Embed trigger error:', err.message));
    
    console.log(`[ProcessServer] Complete! ${insertedCount} chunks saved for user ${userId}`);
    
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
    const errorMessage = error instanceof Error ? error.message : 'Processing failed';
    console.error('[ProcessServer] Error:', errorMessage);
    
    // Update status to failed with error message
    if (userId) {
      await adminSupabase.from('user_profiles').update({
        import_status: 'failed',
        import_error: errorMessage,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId).catch(e => console.error('[ProcessServer] Failed to update status:', e));
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
