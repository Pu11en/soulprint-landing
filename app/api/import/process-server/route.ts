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
import { checkRateLimit } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { chatGPTExportSchema, ChatGPTRawConversation } from '@/lib/api/schemas';
import { generateQuickPass, sectionsToSoulprintText } from '@/lib/soulprint/quick-pass';
import type { ParsedConversation, ConversationMessage } from '@/lib/soulprint/types';
import { calculateQualityBreakdown } from '@/lib/evaluation/quality-scoring';

const log = createLogger('API:ImportProcessServer');

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

export async function POST(request: Request) {
  const adminSupabase = getSupabaseAdmin();
  let userId: string | null = null;
  const correlationId = request.headers.get('x-correlation-id') || undefined;
  const startTime = Date.now();

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

      // Rate limit check (only for normal auth - internal calls are trusted)
      const rateLimited = await checkRateLimit(userId, 'expensive');
      if (rateLimited) return rateLimited;
    }

    const reqLog = log.child({ correlationId, userId, method: 'POST', endpoint: '/api/import/process-server' });

    const body = await request.json();
    const storagePath = body.storagePath;

    if (!storagePath) {
      return NextResponse.json({ error: 'storagePath required' }, { status: 400 });
    }

    reqLog.info({ storagePath }, 'Import processing started');
    
    // Update status to processing with timestamp (for stuck detection)
    const processingStartedAt = new Date().toISOString();
    const { error: statusError } = await adminSupabase.from('user_profiles').upsert({
      user_id: userId,
      import_status: 'processing',
      import_error: null,
      processing_started_at: processingStartedAt,
      updated_at: processingStartedAt,
    }, { onConflict: 'user_id' });

    if (statusError) {
      reqLog.error({ error: statusError.message }, 'Failed to set processing status');
    }

    // Download from storage
    const pathParts = storagePath.split('/');
    const bucket = pathParts[0];
    const filePath = pathParts.slice(1).join('/');

    reqLog.debug({ bucket, filePath }, 'Downloading from storage');

    const { data: fileData, error: downloadError } = await adminSupabase.storage
      .from(bucket)
      .download(filePath);

    if (downloadError || !fileData) {
      reqLog.error({ error: downloadError?.message }, 'Download error');
      throw new Error('Failed to download file from storage');
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const sizeMB = arrayBuffer.byteLength / 1024 / 1024;
    reqLog.info({ sizeMB: sizeMB.toFixed(1) }, 'File downloaded');
    
    // Check file size limit
    if (sizeMB > MAX_FILE_SIZE_MB) {
      // Clean up storage
      adminSupabase.storage.from(bucket).remove([filePath]).catch(e => console.warn('[ProcessServer] Cleanup failed:', e));
      throw new Error(`File too large (${sizeMB.toFixed(0)}MB). Maximum is ${MAX_FILE_SIZE_MB}MB. Please export fewer conversations or contact support.`);
    }
    
    let rawConversations: ChatGPTRawConversation[];
    let rawJsonString: string = '';

    // Check if it's JSON directly or a ZIP
    if (filePath.endsWith('.json')) {
      reqLog.debug('Parsing JSON directly');
      const text = new TextDecoder().decode(arrayBuffer);
      rawJsonString = text;

      // Parse as unknown first, then validate
      const parsed: unknown = JSON.parse(text);
      const validationResult = chatGPTExportSchema.safeParse(parsed);

      if (!validationResult.success) {
        reqLog.error({ zodErrors: validationResult.error.issues.slice(0, 5) }, 'ChatGPT export validation failed (JSON)');
        adminSupabase.storage.from(bucket).remove([filePath]).catch(e => console.warn('[ProcessServer] Cleanup failed:', e));
        throw new Error('Invalid ChatGPT export format. Please upload a valid ChatGPT export file.');
      }

      rawConversations = validationResult.data;
    } else {
      reqLog.debug('Extracting from ZIP');
      const zip = await JSZip.loadAsync(arrayBuffer);
      const conversationsFile = zip.file('conversations.json');

      if (!conversationsFile) {
        adminSupabase.storage.from(bucket).remove([filePath]).catch(e => reqLog.warn({ error: String(e) }, 'Cleanup failed'));
        throw new Error('conversations.json not found in ZIP. Make sure you exported from ChatGPT correctly.');
      }

      rawJsonString = await conversationsFile.async('string');

      // Parse as unknown first, then validate
      const parsed: unknown = JSON.parse(rawJsonString);
      const validationResult = chatGPTExportSchema.safeParse(parsed);

      if (!validationResult.success) {
        reqLog.error({ zodErrors: validationResult.error.issues.slice(0, 5) }, 'ChatGPT export validation failed (ZIP)');
        adminSupabase.storage.from(bucket).remove([filePath]).catch(e => reqLog.warn({ error: String(e) }, 'Cleanup failed'));
        throw new Error('Invalid ChatGPT export format. Please upload a valid ChatGPT export file.');
      }

      rawConversations = validationResult.data;
    }

    reqLog.info({ conversationCount: rawConversations.length }, 'Conversations parsed');

    // ============================================================
    // VALIDATION: Ensure this is a valid ChatGPT export
    // ============================================================

    // Check 1: Must be an array
    if (!Array.isArray(rawConversations)) {
      adminSupabase.storage.from(bucket).remove([filePath]).catch(e => console.warn('[ProcessServer] Cleanup failed:', e));
      throw new Error('Invalid file format. Expected a ChatGPT export (array of conversations).');
    }

    // Check 2: Must have at least one conversation
    if (rawConversations.length === 0) {
      adminSupabase.storage.from(bucket).remove([filePath]).catch(e => console.warn('[ProcessServer] Cleanup failed:', e));
      throw new Error('No conversations found in file. Please export your ChatGPT data and try again.');
    }

    // Check 3: At least one conversation should have ChatGPT's 'mapping' structure
    const hasValidChatGPTFormat = rawConversations.some((conv) =>
      conv && typeof conv === 'object' && conv.mapping && typeof conv.mapping === 'object'
    );

    if (!hasValidChatGPTFormat) {
      adminSupabase.storage.from(bucket).remove([filePath]).catch(e => console.warn('[ProcessServer] Cleanup failed:', e));
      throw new Error(
        "This doesn't look like a ChatGPT export. " +
        "Please go to ChatGPT → Settings → Data Controls → Export Data, " +
        "then upload the ZIP file you receive via email."
      );
    }

    reqLog.debug('Valid ChatGPT format detected');

    // Store raw JSON (compressed) to user-exports before deleting from imports
    let rawExportPath: string | null = null;
    if (rawJsonString && userId) {
      try {
        reqLog.debug({ chars: rawJsonString.length }, 'Compressing raw JSON');
        const compressed = gzipSync(Buffer.from(rawJsonString, 'utf-8'));
        const compressionRatio = ((1 - compressed.length / rawJsonString.length) * 100).toFixed(1);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        rawExportPath = `${userId}/conversations-${timestamp}.json.gz`;

        const { error: uploadError } = await adminSupabase.storage
          .from('user-exports')
          .upload(rawExportPath, compressed, {
            contentType: 'application/gzip',
            upsert: false,
          });

        if (uploadError) {
          reqLog.warn({ error: uploadError.message }, 'Raw export storage failed');
          rawExportPath = null;
        } else {
          reqLog.info({ path: rawExportPath, compressionRatio }, 'Raw JSON stored');
        }
      } catch (e) {
        reqLog.warn({ error: String(e) }, 'Raw export compression failed');
      }
    }
    
    // Clean up original upload from imports bucket
    adminSupabase.storage.from(bucket).remove([filePath]).catch(e => console.warn('[ProcessServer] Cleanup failed:', e));
    
    // Parse conversations into our format
    const conversations: ParsedConversation[] = rawConversations.map((conv) => {
      const messages: ConversationMessage[] = [];

      if (conv.mapping) {
        // ChatGPT format - traverse the mapping properly
        // mapping is Record<string, unknown>, so we use type guards
        const nodes = Object.values(conv.mapping);
        for (const node of nodes) {
          // Type guard: check if node has the expected structure
          if (
            node &&
            typeof node === 'object' &&
            'message' in node &&
            node.message &&
            typeof node.message === 'object' &&
            'content' in node.message &&
            node.message.content &&
            typeof node.message.content === 'object' &&
            'parts' in node.message.content &&
            Array.isArray(node.message.content.parts) &&
            node.message.content.parts[0]
          ) {
            const message = node.message as {
              author?: { role?: string };
              content: { parts: unknown[] };
            };
            const role = message.author?.role || 'user';
            const content = message.content.parts[0];
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
    }).filter((c) => c.messages.length > 0);

    reqLog.info({ conversationsWithMessages: conversations.length }, 'Conversations extracted');
    
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
    
    // === QUICK PASS: Generate structured context sections via Haiku 4.5 ===
    reqLog.info({ conversationCount: conversations.length }, 'Starting quick pass generation');
    const quickPassStart = Date.now();

    const quickPassResult = await generateQuickPass(conversations);

    const quickPassDuration = Date.now() - quickPassStart;
    reqLog.info({ quickPassDuration, success: !!quickPassResult }, 'Quick pass complete');

    // Build soulprint data
    let soulprintText: string;
    let aiName: string;
    let archetype: string;
    let soulMd: string | null = null;
    let identityMd: string | null = null;
    let userMd: string | null = null;
    let agentsMd: string | null = null;
    let toolsMd: string | null = null;

    if (quickPassResult) {
      // Quick pass succeeded -- use structured sections
      soulprintText = sectionsToSoulprintText(quickPassResult);

      // AI name with intelligent fallback
      const BLOCKED_NAMES = ['soul', 'soulprint', 'assistant', 'helper', 'ai', 'bot', 'buddy', 'chatbot'];
      const rawAiName = quickPassResult.identity.ai_name?.trim() || '';
      if (rawAiName && !BLOCKED_NAMES.includes(rawAiName.toLowerCase())) {
        aiName = rawAiName;
      } else {
        if (rawAiName) {
          reqLog.warn({ rawAiName }, 'Haiku returned blocked AI name, generating from archetype');
        }
        // Generate name from archetype if available
        const arch = quickPassResult.identity.archetype || '';
        let derivedName: string | null = null;

        if (arch && arch !== 'not enough data') {
          // Extract key word from archetype and create a name
          const words = arch.toLowerCase().split(/[\s-]+/).filter(w => w.length > 3);
          const nameMap: Record<string, string> = {
            'strategic': 'Atlas',
            'creative': 'Nova',
            'analytical': 'Sage',
            'thoughtful': 'Echo',
            'practical': 'Dash',
            'witty': 'Spark',
            'technical': 'Pixel',
            'philosophical': 'Lumen',
            'organized': 'Prism',
            'curious': 'Quest',
            'pragmatic': 'Arc',
            'builder': 'Forge',
            'explorer': 'Orbit',
            'guide': 'Beacon',
          };

          for (const word of words) {
            if (nameMap[word]) {
              derivedName = nameMap[word];
              reqLog.warn({ archetype: arch, derivedName }, 'Generated AI name from archetype (ai_name was empty)');
              break;
            }
          }

          if (!derivedName) {
            // Still no match - use first word capitalized
            const firstWord = words[0];
            if (firstWord) {
              derivedName = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
              reqLog.warn({ archetype: arch, derivedName }, 'Generated AI name from first archetype word');
            }
          }
        }

        // Final fallback — pick a random creative name (never "Soul")
        if (!derivedName) {
          const fallbackNames = ['Nova', 'Atlas', 'Sage', 'Echo', 'Spark', 'Pixel', 'Lumen', 'Prism', 'Quest', 'Orbit'];
          derivedName = fallbackNames[Math.floor(Math.random() * fallbackNames.length)]!;
          reqLog.warn({ derivedName }, 'Using random fallback name - both ai_name and archetype missing');
        }
        aiName = derivedName as string;
      }

      archetype = quickPassResult.identity.archetype || 'Your AI';

      // Store each section as JSON string in its *_md column
      soulMd = JSON.stringify(quickPassResult.soul);
      identityMd = JSON.stringify(quickPassResult.identity);
      userMd = JSON.stringify(quickPassResult.user);
      agentsMd = JSON.stringify(quickPassResult.agents);
      toolsMd = JSON.stringify(quickPassResult.tools);
    } else {
      // Quick pass failed -- use placeholder (user can still chat)
      soulprintText = `Analyzing ${totalMessages.toLocaleString()} messages across ${conversations.length.toLocaleString()} conversations. Your personalized SoulPrint is being created...`;
      const fallbackNames = ['Nova', 'Atlas', 'Sage', 'Echo', 'Spark', 'Pixel', 'Lumen', 'Prism', 'Quest', 'Orbit'];
      aiName = fallbackNames[Math.floor(Math.random() * fallbackNames.length)]!;
      archetype = 'Analyzing...';
      reqLog.warn('Quick pass failed, using placeholder soulprint');
    }

    const soulprint = {
      archetype,
      soulprint_text: soulprintText,
      stats,
      pending: !quickPassResult, // true if still needs generation
    };

    // Save soulprint to user profile with structured sections
    await adminSupabase.from('user_profiles').upsert({
      user_id: userId,
      soulprint: soulprint,
      soulprint_text: soulprintText,
      archetype,
      ai_name: aiName,
      soul_md: soulMd,
      identity_md: identityMd,
      user_md: userMd,
      agents_md: agentsMd,
      tools_md: toolsMd,
      import_status: 'quick_ready',
      import_error: null,
      total_conversations: conversations.length,
      total_messages: totalMessages,
      soulprint_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      raw_export_path: rawExportPath,
    }, { onConflict: 'user_id' });

    // Fire-and-forget quality scoring (non-blocking)
    // Scores the quick pass result immediately after generation
    if (quickPassResult) {
      void (async () => {
        try {
          const breakdown = await calculateQualityBreakdown({
            soul_md: soulMd,
            identity_md: identityMd,
            user_md: userMd,
            agents_md: agentsMd,
            tools_md: toolsMd,
          });

          await adminSupabase
            .from('user_profiles')
            .update({
              quality_breakdown: breakdown,
              quality_scored_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

          reqLog.info({ userId }, 'Quality scoring complete');
        } catch (err) {
          reqLog.error({ userId, error: String(err) }, 'Quality scoring failed (non-fatal)');
        }
      })();
    }

    // Update profile status - RLM will do chunking + embedding + soulprint
    await adminSupabase.from('user_profiles').update({
      import_status: 'processing',
      embedding_status: 'pending',
      total_conversations: conversations.length,
      total_messages: totalMessages,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);

    reqLog.info({ rawConversationCount: rawConversations.length }, 'Sending to RLM for full processing');

    // Store RAW ChatGPT JSON to Supabase Storage (bypasses Vercel 4.5MB body limit)
    // RLM gets full data including timestamps, metadata - not the simplified version
    const parsedJsonPath = `${userId}/raw-${Date.now()}.json`;
    const rawJsonData = JSON.stringify(rawConversations);
    const rawSizeMB = (rawJsonData.length / 1024 / 1024).toFixed(2);
    reqLog.debug({ sizeMB: rawSizeMB }, 'Storing raw JSON to storage');

    const { error: rawUploadError } = await adminSupabase.storage
      .from('user-imports')
      .upload(parsedJsonPath, rawJsonData, {
        contentType: 'application/json',
        upsert: true,
      });

    if (rawUploadError) {
      reqLog.error({ error: rawUploadError.message }, 'Failed to store raw JSON');
      throw new Error('Failed to store raw conversations for processing.');
    }

    reqLog.info({ path: `user-imports/${parsedJsonPath}` }, 'Raw JSON stored');

    // Call RLM with storage path (not full conversations - handles 10,000+ conversations)
    // IMPORTANT: Fire-and-forget! Don't await - RLM processes async and updates DB when done
    const rlmUrl = process.env.RLM_API_URL || 'https://soulprint-landing.onrender.com';

    // V2_ROLLOUT_PERCENT: Percentage-based traffic routing for gradual cutover
    const v2RolloutPct = Math.max(0, Math.min(100,
      parseInt(process.env.V2_ROLLOUT_PERCENT || '0', 10) || 0
    ));

    const useV2Pipeline = Math.random() * 100 < v2RolloutPct;
    const rlmEndpoint = useV2Pipeline ? '/process-full-v2' : '/process-full';

    reqLog.info({
      endpoint: rlmEndpoint,
      v2RolloutPercent: v2RolloutPct,
      userId,
      conversationCount: conversations.length
    }, 'Routing import request to RLM pipeline');

    try {
      // Use a short timeout just to confirm RLM accepted the job
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s to accept job

      const rlmResponse = await fetch(`${rlmUrl}${rlmEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          storage_path: `user-imports/${parsedJsonPath}`, // RLM downloads from storage
          conversation_count: conversations.length,
          message_count: totalMessages,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // We only check if RLM accepted the job - actual processing is async
      if (!rlmResponse.ok) {
        const errorText = await rlmResponse.text().catch(() => 'Unknown error');
        reqLog.error({ endpoint: rlmEndpoint, status: rlmResponse.status, error: errorText }, 'RLM returned error');
        reqLog.warn('RLM may be slow - user can start chatting while processing continues');
      } else {
        reqLog.info({ endpoint: rlmEndpoint }, 'RLM accepted job');
      }
    } catch (e: unknown) {
      // Even if RLM call fails/times out, don't block the user
      // They can chat with basic soulprint while embeddings process later
      if (e instanceof Error && e.name === 'AbortError') {
        reqLog.warn('RLM job submission timed out - will retry in background');
      } else {
        reqLog.error({ error: String(e) }, 'Failed to call RLM');
      }
      // Don't throw - continue to success response
    }

    const duration = Date.now() - startTime;
    reqLog.info({
      duration,
      status: 200,
      conversationCount: conversations.length,
      messageCount: totalMessages
    }, 'Import processing completed');

    return NextResponse.json({
      success: true,
      status: 'processing',
      message: 'Processing started on RLM. Chunking, embedding, and soulprint generation in progress.',
      soulprint: {
        ...soulprint,
        stats,
      },
      archetype,
      aiName,
      totalConversations: conversations.length,
      totalMessages,
      quickPassDuration,
      quickPassSuccess: !!quickPassResult,
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Processing failed';
    const duration = Date.now() - startTime;

    log.error({
      correlationId,
      userId,
      duration,
      error: error instanceof Error ? { message: error.message, name: error.name } : String(error)
    }, 'Import processing failed');

    // Update status to failed with error message
    if (userId) {
      const { error: updateError } = await adminSupabase.from('user_profiles').update({
        import_status: 'failed',
        import_error: errorMessage,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);

      if (updateError) {
        log.error({ error: updateError.message }, 'Failed to update status to failed');
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
