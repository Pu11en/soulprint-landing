/**
 * Re-chunk all conversations for a user from raw_conversations
 * Admin endpoint - can be triggered to re-process all users with new chunk settings
 */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min for large re-chunks

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Chunking settings - match client-soulprint.ts
// Optimized for Cohere Embed v4 (128K context, 1536 dims)
const MAX_CHUNK_SIZE = 6000;      // ~1500 tokens - optimal for semantic search
const OVERLAP_CHARS = 1200;       // ~300 tokens - prevents cross-chunk info loss
const SUBSTANTIAL_MSG = 2000;     // ~500 tokens - large msgs get own chunk

interface RawConversation {
  id: string;
  user_id: string;
  conversation_id: string;
  title: string;
  messages: Array<{ role: string; content: string }>;
  message_count: number;
  created_at: string;
}

export async function POST(request: Request) {
  try {
    const adminSupabase = getSupabaseAdmin();
    const body = await request.json();
    const { userId, all } = body;

    // Get users to process
    let userIds: string[] = [];
    
    if (all) {
      // Get all users with raw conversations
      const { data: users } = await adminSupabase
        .from('raw_conversations')
        .select('user_id')
        .limit(1000);
      
      userIds = [...new Set((users || []).map(u => u.user_id))];
    } else if (userId) {
      userIds = [userId];
    } else {
      return NextResponse.json({ error: 'userId or all=true required' }, { status: 400 });
    }

    console.log(`[Rechunk] Processing ${userIds.length} users`);

    const results: Array<{ userId: string; chunks: number; error?: string }> = [];

    for (const uid of userIds) {
      try {
        // Fetch all raw conversations for user
        const { data: rawConvos, error: fetchError } = await adminSupabase
          .from('raw_conversations')
          .select('*')
          .eq('user_id', uid);

        if (fetchError) throw fetchError;
        if (!rawConvos || rawConvos.length === 0) {
          results.push({ userId: uid, chunks: 0, error: 'No raw conversations' });
          continue;
        }

        // Delete existing chunks for user
        await adminSupabase
          .from('conversation_chunks')
          .delete()
          .eq('user_id', uid);

        // Re-chunk all conversations
        const newChunks: Array<{
          user_id: string;
          conversation_id: string;
          title: string;
          content: string;
          message_count: number;
          created_at: string;
          is_recent: boolean;
        }> = [];

        for (const convo of rawConvos as RawConversation[]) {
          const chunks = chunkConversation(convo.messages, convo.title);
          
          for (let i = 0; i < chunks.length; i++) {
            newChunks.push({
              user_id: uid,
              conversation_id: chunks.length > 1 ? `${convo.conversation_id}-chunk-${i}` : convo.conversation_id,
              title: convo.title,
              content: chunks[i].content,
              message_count: chunks[i].messageCount,
              created_at: convo.created_at,
              is_recent: false,
            });
          }
        }

        // Insert new chunks in batches
        const BATCH_SIZE = 100;
        for (let i = 0; i < newChunks.length; i += BATCH_SIZE) {
          const batch = newChunks.slice(i, i + BATCH_SIZE);
          await adminSupabase.from('conversation_chunks').insert(batch);
        }

        // Clear embeddings (need to regenerate)
        await adminSupabase
          .from('conversation_chunks')
          .update({ embedding: null })
          .eq('user_id', uid);

        // Mark user for re-embedding
        await adminSupabase
          .from('user_profiles')
          .update({ embedding_status: 'pending', total_chunks: newChunks.length })
          .eq('user_id', uid);

        results.push({ userId: uid, chunks: newChunks.length });
        console.log(`[Rechunk] User ${uid}: ${newChunks.length} chunks`);

      } catch (err) {
        results.push({ userId: uid, chunks: 0, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    return NextResponse.json({ 
      success: true,
      processed: userIds.length,
      results,
    });

  } catch (error) {
    console.error('[Rechunk] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

/**
 * Chunk conversation with current settings (300 char max)
 */
function chunkConversation(
  messages: Array<{ role: string; content: string }>,
  title: string
): Array<{ content: string; messageCount: number }> {
  const formattedMessages = messages.map(m => ({
    text: `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`,
    length: `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`.length,
  }));

  const chunks: Array<{ content: string; messageCount: number }> = [];

  const makeChunk = (texts: string[], msgCount: number) => {
    const partNum = chunks.length + 1;
    const header = `[Conversation: ${title}] [Part ${partNum}]`;
    chunks.push({
      content: `${header}\n${texts.join('\n\n')}`,
      messageCount: msgCount,
    });
  };

  let overlapText = '';
  let i = 0;

  while (i < formattedMessages.length) {
    const msg = formattedMessages[i];

    if (msg.length >= SUBSTANTIAL_MSG) {
      if (msg.length > MAX_CHUNK_SIZE) {
        const words = msg.text.split(' ');
        let subChunk = overlapText ? overlapText + '\n\n' : '';
        let wordIdx = 0;

        while (wordIdx < words.length) {
          const word = words[wordIdx];
          if (subChunk.length + word.length + 1 > MAX_CHUNK_SIZE && subChunk.length > 0) {
            const partNum = chunks.length + 1;
            const header = `[Conversation: ${title}] [Part ${partNum}]`;
            chunks.push({ content: `${header}\n${subChunk.trim()}`, messageCount: 1 });
            const overlapWords = subChunk.split(' ').slice(-10).join(' ');
            subChunk = overlapWords + ' ';
          }
          subChunk += word + ' ';
          wordIdx++;
        }

        if (subChunk.trim()) {
          const partNum = chunks.length + 1;
          const header = `[Conversation: ${title}] [Part ${partNum}]`;
          chunks.push({ content: `${header}\n${subChunk.trim()}`, messageCount: 1 });
          overlapText = subChunk.trim().slice(-OVERLAP_CHARS);
        }
      } else {
        const content = overlapText ? overlapText + '\n\n' + msg.text : msg.text;
        makeChunk([content], 1);
        overlapText = msg.text.slice(-OVERLAP_CHARS);
      }
      i++;
      continue;
    }

    let accumulated: string[] = overlapText ? [overlapText] : [];
    let accumulatedLength = overlapText.length;
    let msgCount = 0;

    while (i < formattedMessages.length) {
      const nextMsg = formattedMessages[i];
      if (nextMsg.length >= SUBSTANTIAL_MSG) break;
      if (accumulatedLength + nextMsg.length + 2 > MAX_CHUNK_SIZE && msgCount > 0) break;

      accumulated.push(nextMsg.text);
      accumulatedLength += nextMsg.length + 2;
      msgCount++;
      i++;
    }

    if (msgCount > 0) {
      const fullText = accumulated.join('\n\n');
      const partNum = chunks.length + 1;
      const header = `[Conversation: ${title}] [Part ${partNum}]`;
      chunks.push({ content: `${header}\n${fullText}`, messageCount: msgCount });
      overlapText = fullText.slice(-OVERLAP_CHARS);
    }
  }

  if (chunks.length === 0 && formattedMessages.length > 0) {
    const content = `[Conversation: ${title}]\n${formattedMessages.map(m => m.text).join('\n\n')}`;
    return [{ content, messageCount: messages.length }];
  }

  return chunks;
}
