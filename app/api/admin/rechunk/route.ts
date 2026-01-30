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

// Multi-layer chunking settings defined in chunkConversation function
// Layer 1 (Large): 6000 chars, 1200 overlap - context preservation
// Layer 2 (Small): 500 chars, 100 overlap - pinpoint precision

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
 * Multi-layer chunking for pinpoint memory recall
 * Creates BOTH large (context) and small (precision) chunks
 */
function chunkConversation(
  messages: Array<{ role: string; content: string }>,
  title: string
): Array<{ content: string; messageCount: number }> {
  // LAYER 1: Large chunks for context
  const largeChunks = generateChunks(messages, title, 6000, 1200, 2000);
  // LAYER 2: Small chunks for precision
  const smallChunks = generateChunks(messages, title, 500, 100, 300);
  
  return [...largeChunks, ...smallChunks];
}

function generateChunks(
  messages: Array<{ role: string; content: string }>,
  title: string,
  maxSize: number,
  overlap: number,
  substantial: number
): Array<{ content: string; messageCount: number }> {
  const formattedMessages = messages.map(m => ({
    text: `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`,
    length: `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`.length,
  }));

  const chunks: Array<{ content: string; messageCount: number }> = [];
  let overlapText = '';
  let i = 0;

  while (i < formattedMessages.length) {
    const msg = formattedMessages[i];

    if (msg.length >= substantial) {
      if (msg.length > maxSize) {
        const words = msg.text.split(' ');
        let subChunk = overlapText ? overlapText + '\n\n' : '';
        let wordIdx = 0;

        while (wordIdx < words.length) {
          const word = words[wordIdx];
          if (subChunk.length + word.length + 1 > maxSize && subChunk.length > 0) {
            const header = `[Conversation: ${title}] [Part ${chunks.length + 1}]`;
            chunks.push({ content: `${header}\n${subChunk.trim()}`, messageCount: 1 });
            subChunk = subChunk.split(' ').slice(-15).join(' ') + ' ';
          }
          subChunk += word + ' ';
          wordIdx++;
        }

        if (subChunk.trim()) {
          const header = `[Conversation: ${title}] [Part ${chunks.length + 1}]`;
          chunks.push({ content: `${header}\n${subChunk.trim()}`, messageCount: 1 });
          overlapText = subChunk.trim().slice(-overlap);
        }
      } else {
        const content = overlapText ? overlapText + '\n\n' + msg.text : msg.text;
        const header = `[Conversation: ${title}] [Part ${chunks.length + 1}]`;
        chunks.push({ content: `${header}\n${content}`, messageCount: 1 });
        overlapText = msg.text.slice(-overlap);
      }
      i++;
      continue;
    }

    let accumulated: string[] = overlapText ? [overlapText] : [];
    let accumulatedLength = overlapText.length;
    let msgCount = 0;

    while (i < formattedMessages.length) {
      const nextMsg = formattedMessages[i];
      if (nextMsg.length >= substantial) break;
      if (accumulatedLength + nextMsg.length + 2 > maxSize && msgCount > 0) break;
      accumulated.push(nextMsg.text);
      accumulatedLength += nextMsg.length + 2;
      msgCount++;
      i++;
    }

    if (msgCount > 0) {
      const fullText = accumulated.join('\n\n');
      const header = `[Conversation: ${title}] [Part ${chunks.length + 1}]`;
      chunks.push({ content: `${header}\n${fullText}`, messageCount: msgCount });
      overlapText = fullText.slice(-overlap);
    }
  }

  if (chunks.length === 0 && formattedMessages.length > 0) {
    const content = `[Conversation: ${title}]\n${formattedMessages.map(m => m.text).join('\n\n')}`;
    return [{ content, messageCount: messages.length }];
  }

  return chunks;
}
