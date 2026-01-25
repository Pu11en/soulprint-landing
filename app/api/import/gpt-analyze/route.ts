import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import {
  parseGPTExport,
  importGPTConversations,
  GPTConversation,
  parseConversation,
} from '@/lib/soulprint/import/gpt-parser';
import { analyzeChatsForSoulPrint } from '@/lib/soulprint/import/chat-analyzer';
import { generateUniqueName, detectNicknameFromChat } from '@/lib/soulprint/name-generator';
import { constructDynamicSystemPrompt } from '@/lib/soulprint/generator';

// Allow long running imports (up to 5 minutes - Vercel hobby limit)
export const maxDuration = 300;
export const runtime = 'nodejs';

// Supabase admin client for service role operations
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/import/gpt-analyze
 *
 * Combined endpoint that:
 * 1. Imports GPT conversations to database
 * 2. Analyzes chat patterns to create SoulPrint
 * 3. Generates unique companion name
 * 4. Saves everything
 *
 * This is the PRIMARY path for new user onboarding.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('🚀 [GPT Analyze] Starting import + analysis...');

  try {
    const supabase = await createClient();

    // 1. Authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✅ [GPT Analyze] User authenticated:', user.id);

    // 2. Parse request body
    const body = await request.json();
    const { conversations: conversationsJson } = body;

    if (!conversationsJson) {
      return NextResponse.json(
        { error: 'conversations JSON content is required' },
        { status: 400 }
      );
    }

    // 3. Parse the GPT export
    let parsed: { conversations: GPTConversation[]; totalMessages: number };
    try {
      parsed = parseGPTExport(conversationsJson);
    } catch {
      return NextResponse.json(
        { error: 'Invalid conversations.json format' },
        { status: 400 }
      );
    }

    const { conversations, totalMessages } = parsed;
    console.log(`📊 [GPT Analyze] Parsed ${conversations.length} conversations, ${totalMessages} messages`);

    if (conversations.length === 0) {
      return NextResponse.json(
        { error: 'No conversations found in export' },
        { status: 400 }
      );
    }

    // 4. Extract all messages for analysis
    console.log('📝 [GPT Analyze] Extracting messages for analysis...');
    const allMessages = conversations.flatMap(conv => parseConversation(conv));
    const userMessages = allMessages
      .filter(m => m.role === 'user')
      .map(m => m.content);

    console.log(`📝 [GPT Analyze] ${userMessages.length} user messages for analysis`);

    // 5. Run chat analysis to create SoulPrint
    console.log('🧠 [GPT Analyze] Analyzing chat patterns...');
    const analysisResult = await analyzeChatsForSoulPrint({
      messages: allMessages,
      userId: user.id
    });

    console.log(`🧠 [GPT Analyze] Analysis complete. Archetype: ${analysisResult.soulprint.archetype}`);
    console.log(`🧠 [GPT Analyze] Confidence: ${(analysisResult.confidence * 100).toFixed(1)}%`);

    // 6. Construct system prompts
    const soulprint = analysisResult.soulprint;
    const promptFull = constructDynamicSystemPrompt(soulprint);
    soulprint.prompt_full = promptFull;
    soulprint.full_system_prompt = promptFull;

    // 7. Save SoulPrint to database
    console.log('💾 [GPT Analyze] Saving SoulPrint...');
    const { data: savedSoulprint, error: saveError } = await supabaseAdmin
      .from('soulprints')
      .insert({
        user_id: user.id,
        soulprint_data: soulprint,
        generation_source: 'chatgpt_import',
        confidence_score: analysisResult.confidence,
        source_message_count: analysisResult.userMessageCount
      })
      .select()
      .single();

    if (saveError) {
      console.error('❌ [GPT Analyze] Error saving SoulPrint:', saveError);
      return NextResponse.json(
        { error: 'Failed to save SoulPrint: ' + saveError.message },
        { status: 500 }
      );
    }

    console.log('✅ [GPT Analyze] SoulPrint saved:', savedSoulprint.id);

    // 8. Generate unique companion name
    console.log('🏷️ [GPT Analyze] Generating unique name...');
    const nameResult = await generateUniqueName(
      supabaseAdmin,
      soulprint,
      user.id,
      savedSoulprint.id,
      userMessages
    );

    console.log(`🏷️ [GPT Analyze] Name: ${nameResult.name} (source: ${nameResult.source})`);

    // 9. Update SoulPrint with name
    const updatedSoulprintData = { ...soulprint, name: nameResult.name };
    await supabaseAdmin
      .from('soulprints')
      .update({ soulprint_data: updatedSoulprintData })
      .eq('id', savedSoulprint.id);

    // 10. Import conversations to memory database (background-ish)
    console.log('📥 [GPT Analyze] Importing conversations to memory...');
    const importProgress = await importGPTConversations(
      user.id,
      conversations,
      (progress) => {
        // Could emit progress via SSE in future
        console.log(`📥 [GPT Analyze] Import progress: ${progress.processedMessages}/${progress.totalMessages}`);
      }
    );

    const duration = (Date.now() - startTime) / 1000;
    console.log(`✅ [GPT Analyze] Complete in ${duration.toFixed(1)}s`);

    // 11. Return complete result
    return NextResponse.json({
      success: true,
      soulprint: {
        id: savedSoulprint.id,
        archetype: soulprint.archetype,
        identity_signature: soulprint.identity_signature,
        voice_vectors: soulprint.voice_vectors
      },
      name: {
        suggested: nameResult.name,
        alternates: nameResult.alternates,
        source: nameResult.source,
        detectedNickname: nameResult.detectedNickname
      },
      analysis: {
        confidence: analysisResult.confidence,
        messageCount: analysisResult.messageCount,
        userMessageCount: analysisResult.userMessageCount,
        warnings: analysisResult.warnings
      },
      import: {
        conversationsImported: importProgress.processedConversations,
        messagesImported: importProgress.processedMessages,
        errors: importProgress.errors.length
      },
      durationSeconds: duration
    });

  } catch (error: unknown) {
    const duration = (Date.now() - startTime) / 1000;
    console.error(`❌ [GPT Analyze] Error after ${duration.toFixed(1)}s:`, error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/import/gpt-analyze
 * Check if user has a SoulPrint already
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for existing SoulPrint
    const { data: soulprints } = await supabaseAdmin
      .from('soulprints')
      .select('id, soulprint_data, generation_source, confidence_score, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      hasSoulprint: (soulprints?.length || 0) > 0,
      soulprints: soulprints?.map(sp => ({
        id: sp.id,
        name: sp.soulprint_data?.name,
        archetype: sp.soulprint_data?.archetype,
        source: sp.generation_source,
        confidence: sp.confidence_score,
        createdAt: sp.created_at
      })) || []
    });

  } catch (error: unknown) {
    console.error('❌ [GPT Analyze] GET error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
