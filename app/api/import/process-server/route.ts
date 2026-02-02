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
import { gzipSync } from 'zlib';

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
    let rawJsonString: string = '';
    
    // Check if it's JSON directly or a ZIP
    if (filePath.endsWith('.json')) {
      console.log('[ProcessServer] Parsing JSON directly...');
      const text = new TextDecoder().decode(arrayBuffer);
      rawJsonString = text;
      rawConversations = JSON.parse(text);
    } else {
      console.log('[ProcessServer] Extracting from ZIP...');
      const zip = await JSZip.loadAsync(arrayBuffer);
      const conversationsFile = zip.file('conversations.json');
      
      if (!conversationsFile) {
        adminSupabase.storage.from(bucket).remove([filePath]).catch(() => {});
        throw new Error('conversations.json not found in ZIP. Make sure you exported from ChatGPT correctly.');
      }
      
      rawJsonString = await conversationsFile.async('string');
      rawConversations = JSON.parse(rawJsonString);
    }
    
    console.log(`[ProcessServer] Parsed ${rawConversations.length} conversations`);
    
    // Store raw JSON (compressed) to user-exports before deleting from imports
    let rawExportPath: string | null = null;
    if (rawJsonString && userId) {
      try {
        console.log(`[ProcessServer] Compressing raw JSON (${rawJsonString.length} chars)...`);
        const compressed = gzipSync(Buffer.from(rawJsonString, 'utf-8'));
        const compressionRatio = ((1 - compressed.length / rawJsonString.length) * 100).toFixed(1);
        console.log(`[ProcessServer] Compressed to ${compressed.length} bytes (${compressionRatio}% reduction)`);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        rawExportPath = `${userId}/conversations-${timestamp}.json.gz`;

        const { error: uploadError } = await adminSupabase.storage
          .from('user-exports')
          .upload(rawExportPath, compressed, {
            contentType: 'application/gzip',
            upsert: false,
          });

        if (uploadError) {
          console.warn('[ProcessServer] Raw export storage failed:', uploadError);
          rawExportPath = null;
        } else {
          console.log(`[ProcessServer] Raw JSON stored at: ${rawExportPath}`);
        }
      } catch (e) {
        console.warn('[ProcessServer] Raw export compression failed:', e);
      }
    }
    
    // Clean up original upload from imports bucket
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
    
    // ASYNC SOULPRINT: Skip RLM here, generate after embeddings complete
    // Placeholder soulprint - will be replaced by /api/soulprint/generate
    const soulprint = {
      archetype: 'Analyzing...',
      soulprint_text: `Analyzing ${totalMessages.toLocaleString()} messages across ${conversations.length.toLocaleString()} conversations. Your personalized SoulPrint is being created...`,
      stats,
      pending: true, // Flag for async generation
    };
    const archetype = 'Analyzing...';
    
    console.log(`[ProcessServer] Placeholder soulprint set - async generation will follow after embeddings`);
    
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
      raw_export_path: rawExportPath, // Store path to compressed original JSON
    }, { onConflict: 'user_id' });
    
    // Update profile status - RLM will do chunking + embedding + soulprint
    await adminSupabase.from('user_profiles').update({
      import_status: 'processing',
      embedding_status: 'pending',
      total_conversations: conversations.length,
      total_messages: totalMessages,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);

    console.log(`[ProcessServer] Sending ${rawConversations.length} raw conversations to RLM for full processing...`);

    // Store RAW ChatGPT JSON to Supabase Storage (bypasses Vercel 4.5MB body limit)
    // RLM gets full data including timestamps, metadata - not the simplified version
    const parsedJsonPath = `${userId}/raw-${Date.now()}.json`;
    const rawJsonData = JSON.stringify(rawConversations);
    console.log(`[ProcessServer] Storing raw JSON (${(rawJsonData.length / 1024 / 1024).toFixed(2)}MB) to storage...`);

    const { error: rawUploadError } = await adminSupabase.storage
      .from('user-imports')
      .upload(parsedJsonPath, rawJsonData, {
        contentType: 'application/json',
        upsert: true,
      });

    if (rawUploadError) {
      console.error('[ProcessServer] Failed to store raw JSON:', rawUploadError);
      throw new Error('Failed to store raw conversations for processing.');
    }

    console.log(`[ProcessServer] Raw JSON stored at: user-imports/${parsedJsonPath}`);

    // Call RLM with storage path (not full conversations - handles 10,000+ conversations)
    const rlmUrl = process.env.RLM_API_URL || 'https://soulprint-landing.onrender.com';
    try {
      const rlmResponse = await fetch(`${rlmUrl}/process-full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          storage_path: `user-imports/${parsedJsonPath}`, // RLM downloads from storage
          conversation_count: conversations.length,
          message_count: totalMessages,
        }),
      });

      if (!rlmResponse.ok) {
        console.error(`[ProcessServer] RLM returned ${rlmResponse.status}`);
        throw new Error(`RLM processing failed with status ${rlmResponse.status}`);
      }
      console.log(`[ProcessServer] RLM full processing started for user ${userId}`);
    } catch (e) {
      console.error(`[ProcessServer] Failed to call RLM:`, e);
      throw new Error('Failed to start background processing. Please try again.');
    }
    
    return NextResponse.json({
      success: true,
      status: 'processing',
      message: 'Processing started on RLM. Chunking, embedding, and soulprint generation in progress.',
      soulprint: {
        ...soulprint,
        stats,
      },
      archetype,
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
      }).eq('user_id', userId); // catch(e => console.error('[ProcessServer] Failed to update status:', e));
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
