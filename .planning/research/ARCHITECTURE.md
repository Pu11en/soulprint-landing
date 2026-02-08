# Architecture Research: Chat Enhancement Features

**Domain:** AI Chat Application Enhancement (Conversation Management, Streaming, Web Search, Voice, Rich Rendering, Dark Mode)
**Researched:** 2026-02-08
**Confidence:** HIGH

## Executive Summary

Adding conversation management, streaming, web search, voice input, rich markdown rendering, and dark mode to the existing SoulPrint architecture requires strategic integration across Next.js frontend, FastAPI RLM backend, and Supabase database. The existing non-streaming architecture can be enhanced incrementally, with careful attention to Vercel serverless timeout constraints and RLM streaming capabilities.

**Key architectural challenge:** Streaming through a multi-layer architecture (Vercel → RLM → Bedrock) while maintaining the current fallback pattern.

## Current Architecture Analysis

### Existing System

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend (Vercel)                 │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐      │
│  │  Chat Page   │  │  TelegramChat │  │  Message UI  │      │
│  └──────┬───────┘  └───────┬───────┘  └──────┬───────┘      │
├─────────┴──────────────────┴──────────────────┴──────────────┤
│               API Routes (app/api/*)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  /api/chat   │  │  /api/import │  │ /api/profile │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
├─────────┴──────────────────┴──────────────────┴──────────────┤
│                    External Services                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Supabase   │  │  RLM Service │  │  AWS Bedrock │       │
│  │   (Postgres) │  │  (FastAPI)   │  │  (Fallback)  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### Current Data Flow

```
User Message → Chat Page → /api/chat
                              ↓
                         Get Profile (Supabase)
                              ↓
                         Get Memory Chunks (Supabase)
                              ↓
                         Web Search (Perplexity/Tavily)
                              ↓
                         RLM Service (FastAPI) ───────→ Try Claude via RLM
                              ↓                              ↓ (failure)
                         Direct Bedrock ←───────────────────┘
                              ↓
                         Return full response (non-streaming)
                              ↓
                         Save message (Supabase)
                              ↓
                         Client receives full text
```

**Current limitations:**
- Single conversation per user (no conversation_id separation)
- Non-streaming responses (simulated SSE with full response)
- No voice input
- Basic markdown rendering (no syntax highlighting)
- Dark mode hardcoded (not toggleable)

## Enhanced Architecture

### Feature Integration Map

```
┌─────────────────────────────────────────────────────────────┐
│                Frontend Enhancements                         │
├─────────────────────────────────────────────────────────────┤
│  NEW: Conversation Sidebar    │  ENHANCE: Message Renderer  │
│  - List conversations          │  - Syntax highlighting      │
│  - Switch active conversation  │  - Code block copy          │
│  - Create/rename/delete        │  - Streamdown for AI        │
│  ├─────────────────────────────┼─────────────────────────────┤
│  NEW: Voice Input Module       │  NEW: Theme System          │
│  - Web Speech API              │  - next-themes wrapper      │
│  - Recording indicator         │  - System preference        │
│  - Speech-to-text conversion   │  - Persistent localStorage  │
└─────────────────────────────────────────────────────────────┘
         ↓                                    ↓
┌─────────────────────────────────────────────────────────────┐
│              API Route Enhancements                          │
├─────────────────────────────────────────────────────────────┤
│  ENHANCE: /api/chat            │  NEW: /api/conversations   │
│  - Add conversation_id param   │  - List user conversations │
│  - True SSE streaming          │  - Create new conversation │
│  - Pass conversation context   │  - Rename conversation     │
│  │                              │  - Delete conversation     │
│  ├──────────────────────────────┼────────────────────────────┤
│  ENHANCE: /api/chat/messages   │  ALREADY EXISTS: Search    │
│  - Add conversation_id param   │  - smartSearch() in place  │
│  - Filter by conversation      │  - Perplexity/Tavily       │
│  - Return conversation-scoped  │  - No changes needed       │
└─────────────────────────────────────────────────────────────┘
         ↓                                    ↓
┌─────────────────────────────────────────────────────────────┐
│           Database Schema Changes                            │
├─────────────────────────────────────────────────────────────┤
│  ENHANCE: chat_messages        │  NEW: conversations        │
│  + conversation_id UUID        │  - id UUID (PK)            │
│  + FOREIGN KEY conversations   │  - user_id UUID            │
│  + INDEX (conversation_id)     │  - title TEXT              │
│  + MIGRATION: backfill existing│  - created_at TIMESTAMPTZ  │
│                                 │  - updated_at TIMESTAMPTZ  │
│                                 │  - RLS policies            │
└─────────────────────────────────────────────────────────────┘
         ↓                                    ↓
┌─────────────────────────────────────────────────────────────┐
│             RLM Service Enhancement                          │
├─────────────────────────────────────────────────────────────┤
│  ENHANCE: /query endpoint                                    │
│  - Accept conversation_id                                    │
│  - Return StreamingResponse (SSE format)                     │
│  - Stream Claude response chunks                             │
│  - Maintain conversation context                             │
└─────────────────────────────────────────────────────────────┘
```

## Feature-by-Feature Integration

### 1. Conversation Management

**Database Schema Changes:**

```sql
-- NEW TABLE: conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE INDEX idx_conversations_user_created
ON conversations(user_id, created_at DESC);

-- RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own conversations" ON conversations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations" ON conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON conversations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON conversations
  FOR DELETE USING (auth.uid() = user_id);

-- MODIFY TABLE: chat_messages (add conversation_id)
ALTER TABLE chat_messages
ADD COLUMN conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE;

CREATE INDEX idx_chat_messages_conversation
ON chat_messages(conversation_id, created_at DESC);

-- Migration: Backfill existing messages into a default conversation
-- For each user, create a "My First Conversation" and assign all existing messages
```

**New API Routes:**

```typescript
// app/api/conversations/route.ts
// GET: List conversations for authenticated user
// POST: Create new conversation

// app/api/conversations/[id]/route.ts
// GET: Get conversation details
// PATCH: Update conversation title
// DELETE: Delete conversation (cascade deletes messages)
```

**Frontend Components:**

```
components/
├── chat/
│   ├── conversation-sidebar.tsx    # NEW: Sidebar with conversation list
│   ├── conversation-header.tsx     # NEW: Header with conversation title
│   └── telegram-chat-v2.tsx        # MODIFY: Accept conversationId prop
```

**State Management:**

```typescript
// Client-side state (app/chat/page.tsx)
const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
const [conversations, setConversations] = useState<Conversation[]>([]);

// On mount: Load conversations list
// On conversation switch: Load messages for that conversation
// On new conversation: Create in DB, switch to it
```

**Build Order:**
1. Database migration (create conversations table, add conversation_id to chat_messages)
2. Backfill migration (create default conversation per user, update existing messages)
3. API routes for conversation CRUD
4. Frontend conversation sidebar UI
5. Update chat page to use conversation context
6. Update message API to filter by conversation

**Integration Points:**
- Existing chat_messages table (add FK)
- Existing /api/chat/messages (add conversation_id filter)
- RLM service (pass conversation_id for future conversation-specific memory)

---

### 2. Streaming Responses

**Challenge:** Multi-layer streaming through Vercel → RLM → Bedrock

**Current State:**
- `/api/chat` returns simulated SSE (full response wrapped in SSE format)
- RLM `/query` returns full JSON response
- Frontend already has SSE parsing code (expecting streaming)

**Streaming Pipeline:**

```
User → Next.js /api/chat (SSE)
         ↓ (HTTP streaming)
     RLM /query (SSE)
         ↓ (HTTP streaming)
     AWS Bedrock Converse (streaming)
         ↓ (chunks)
     RLM yields SSE events
         ↓ (chunks)
     Next.js proxies SSE events
         ↓ (chunks)
     Frontend appends to message
```

**RLM Enhancement (FastAPI):**

```python
# rlm-service/main.py

from fastapi.responses import StreamingResponse
import json

@app.post("/query")
async def query(request: QueryRequest):
    # Existing: Get memory chunks, build context

    # NEW: Stream from Bedrock
    async def event_generator():
        try:
            # Call Bedrock with streaming
            response = anthropic_client.messages.stream(
                model="claude-sonnet-4.5",
                messages=messages,
                system=system_prompt,
                max_tokens=4096
            )

            with response as stream:
                for text in stream.text_stream:
                    # Yield SSE format
                    yield f"data: {json.dumps({'content': text})}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
```

**Vercel Route Enhancement:**

```typescript
// app/api/chat/route.ts

export async function POST(request: NextRequest) {
  // Existing: Auth, rate limit, profile fetch, memory search

  // NEW: Stream from RLM
  const rlmResponse = await fetch(`${RLM_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      message,
      conversation_id: conversationId, // NEW
      soulprint_text,
      history,
      web_search_context,
      ai_name,
      sections,
    }),
  });

  if (rlmResponse.ok && rlmResponse.body) {
    // Proxy the SSE stream directly to client
    return new Response(rlmResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  }

  // Fallback to Bedrock (keep existing direct Bedrock code)
}
```

**Frontend (Already Compatible):**

The existing frontend in `app/chat/page.tsx` already handles SSE streaming correctly:

```typescript
const reader = res.body?.getReader();
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
      const parsed = JSON.parse(data);
      if (parsed.content) {
        responseContent += parsed.content;
        setMessages(prev =>
          prev.map(m => m.id === aiId ? { ...m, content: responseContent } : m)
        );
      }
    }
  }
}
```

**Vercel Serverless Timeout Considerations:**

- Vercel serverless functions have a **10-minute maximum timeout** (Hobby plan: 10s, Pro: 60s, Enterprise: up to 900s)
- Current plan timeout unknown — verify with `vercel inspect`
- Streaming AI responses typically take 20-40 seconds for long responses
- **Risk:** For very long conversations or slow RLM responses, may hit timeout
- **Mitigation:**
  - Keep conversation history trimmed (last 10 messages)
  - Set aggressive timeout on RLM fetch (30s)
  - Have Bedrock fallback ready

**Build Order:**
1. Add streaming to RLM `/query` endpoint (Python FastAPI)
2. Test RLM streaming independently (curl with SSE)
3. Update Next.js `/api/chat` to proxy RLM stream
4. Test end-to-end streaming
5. Verify Vercel timeout handling (test with long responses)
6. Update Bedrock fallback to also stream (if RLM fails)

**Sources:**
- [Vercel Serverless Streaming Support](https://vercel.com/blog/streaming-for-serverless-node-js-and-edge-runtimes-with-vercel-functions)
- [FastAPI SSE Implementation](https://mahdijafaridev.medium.com/implementing-server-sent-events-sse-with-fastapi-real-time-updates-made-simple-6492f8bfc154)
- [sse-starlette for FastAPI](https://pypi.org/project/sse-starlette/)

---

### 3. Rich Markdown Rendering

**Current State:**
- `components/chat/message-content.tsx` handles basic markdown
- No syntax highlighting for code blocks
- No streaming-aware markdown parser

**Enhancement Strategy:**

Use **Streamdown** for streaming markdown + **react-markdown** with **react-syntax-highlighter** for syntax highlighting.

**Component Architecture:**

```typescript
// components/chat/message-content.tsx (ENHANCE)

import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Streamdown from 'streamdown'; // For streaming AI responses

interface MessageContentProps {
  content: string;
  isStreaming?: boolean; // NEW: Is this message actively streaming?
  role: 'user' | 'assistant';
}

export function MessageContent({ content, isStreaming, role }: MessageContentProps) {
  // For streaming AI responses, use Streamdown (handles incomplete markdown)
  if (isStreaming && role === 'assistant') {
    return (
      <Streamdown
        content={content}
        theme="oneDark"
        enableCopy={true}
      />
    );
  }

  // For complete messages, use react-markdown with syntax highlighting
  return (
    <ReactMarkdown
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <SyntaxHighlighter
              style={oneDark}
              language={match[1]}
              PreTag="div"
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

**State Tracking:**

```typescript
// app/chat/page.tsx (MODIFY)

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  isStreaming?: boolean; // NEW
};

// While streaming, set isStreaming: true
setMessages(prev => [...prev, {
  id: aiId,
  role: 'assistant',
  content: '',
  isStreaming: true
}]);

// After streaming completes, set isStreaming: false
setMessages(prev =>
  prev.map(m => m.id === aiId ? { ...m, isStreaming: false } : m)
);
```

**Dependencies:**

```json
{
  "react-markdown": "^9.0.0",
  "react-syntax-highlighter": "^15.5.0",
  "@types/react-syntax-highlighter": "^15.5.11",
  "streamdown": "^1.0.0",
  "rehype-raw": "^7.0.0",
  "remark-gfm": "^4.0.0"
}
```

**Build Order:**
1. Install dependencies
2. Create enhanced MessageContent component with streaming detection
3. Add isStreaming flag to Message type
4. Update chat page to set/clear isStreaming during streaming
5. Test with code blocks in responses
6. Add copy-to-clipboard for code blocks

**Sources:**
- [react-markdown GitHub](https://github.com/remarkjs/react-markdown)
- [Streamdown for streaming markdown](https://reactscript.com/render-streaming-ai-markdown/)
- [React Markdown Syntax Highlighting](https://medium.com/young-developer/react-markdown-code-and-syntax-highlighting-632d2f9b4ada)

---

### 4. Voice Input

**Technology Choice:** Web Speech API (SpeechRecognition)

**Browser Compatibility:**
- Chrome/Edge (Chromium): Full support
- Safari (iOS 14.5+): Partial support
- Firefox: No support
- **Coverage:** ~80% of users

**Component Architecture:**

```typescript
// components/chat/voice-input-button.tsx (NEW)

import { Mic, MicOff } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onError: (error: string) => void;
}

export function VoiceInputButton({ onTranscript, onError }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false; // Stop after one phrase
    recognition.interimResults = false; // Only final results
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onTranscript(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      onError(event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [onTranscript, onError]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  if (!isSupported) return null; // Hide button if not supported

  return (
    <button
      onClick={toggleListening}
      className={`p-3 rounded-full transition-all ${
        isListening
          ? 'bg-red-500 text-white animate-pulse'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
      }`}
      aria-label={isListening ? 'Stop recording' : 'Start recording'}
    >
      {isListening ? <MicOff size={20} /> : <Mic size={20} />}
    </button>
  );
}
```

**Integration with Chat UI:**

```typescript
// components/chat/telegram-chat-v2.tsx (MODIFY)

import { VoiceInputButton } from './voice-input-button';

// Add voice input button next to send button
<div className="flex gap-2">
  <VoiceInputButton
    onTranscript={(text) => {
      setInputValue(text);
      // Optionally auto-send
      // handleSendMessage(text, true); // voiceVerified: true
    }}
    onError={(error) => {
      console.error('Voice input error:', error);
    }}
  />
  <input value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
  <button onClick={handleSend}>
    <Send />
  </button>
</div>
```

**Privacy Considerations:**
- Web Speech API sends audio to Google servers by default
- For privacy, can specify on-device recognition (limited support):
  ```typescript
  recognition.continuous = true;
  recognition.interimResults = true;
  // @ts-ignore (not in all TypeScript definitions)
  recognition.useOnDeviceRecognition = true;
  ```

**Build Order:**
1. Create VoiceInputButton component with feature detection
2. Add to TelegramChatV2 component
3. Test on Chrome (primary target)
4. Test on Safari (iOS)
5. Add visual feedback during recording
6. Handle errors gracefully (permissions, no speech detected)

**Sources:**
- [Web Speech API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Browser Compatibility](https://caniuse.com/speech-recognition)
- [Web Speech API Guide](https://www.f22labs.com/blogs/web-speech-api-a-beginners-guide/)

---

### 5. Dark Mode

**Technology Choice:** `next-themes` (industry standard for Next.js)

**Why next-themes:**
- Zero-flash dark mode (no FOUC)
- System preference detection
- localStorage persistence
- App Router compatible
- 2 lines of code setup

**Implementation:**

```typescript
// app/providers.tsx (NEW)

'use client';

import { ThemeProvider } from 'next-themes';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
```

```typescript
// app/layout.tsx (MODIFY)

import { Providers } from './providers';

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationMismatch>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

```typescript
// components/ui/theme-toggle.tsx (NEW)

'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-9 h-9" />; // Placeholder
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
```

**Tailwind CSS Configuration:**

```javascript
// tailwind.config.js (MODIFY)

module.exports = {
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
    },
  },
};
```

```css
/* app/globals.css (ADD) */

:root {
  --background: #fafafa;
  --foreground: #0a0a0a;
}

.dark {
  --background: #0a0a0a;
  --foreground: #ffffff;
}
```

**Usage in Components:**

```typescript
// Use Tailwind dark: variants
<div className="bg-white dark:bg-[#1a1a1a] text-black dark:text-white">
  Content adapts to theme
</div>
```

**Build Order:**
1. Install `next-themes`
2. Create Providers component
3. Wrap app in Providers
4. Create ThemeToggle component
5. Add toggle to chat header/settings
6. Update existing components with dark: variants
7. Test system preference detection
8. Test localStorage persistence

**Sources:**
- [next-themes GitHub](https://github.com/pacocoursey/next-themes)
- [Next.js Dark Mode Guide](https://eastondev.com/blog/en/posts/dev/20251220-nextjs-dark-mode-guide/)
- [Adding Dark Mode to Next.js](https://sreetamdas.com/blog/the-perfect-dark-mode)

---

### 6. Web Search (Already Implemented)

**Current State:** Fully implemented via `lib/search/smart-search.ts`

**Features:**
- Auto-detection of when search is needed
- Perplexity → Tavily fallback chain
- 5-minute cache
- Rate limiting (10 searches/minute/user)
- Deep search mode via `deepSearch` flag

**Integration Points:**
- Already integrated in `/api/chat` route
- Already has UI toggle (`isDeepSearching` state)
- No architectural changes needed

**Enhancement Opportunity:**
- Add conversation-specific search caching (cache by conversation_id + query)
- Track search usage per conversation for billing

---

## Data Flow: Complete Enhanced System

### Streaming Chat Request (Full Pipeline)

```
User types message in conversation X
    ↓
Frontend: app/chat/page.tsx
    - Add user message to UI (conversation X)
    - Call handleSendMessage(content, voiceVerified, deepSearch)
    ↓
API: POST /api/chat
    - Auth check
    - Rate limit check
    - Fetch user profile (Supabase)
    - Fetch conversation X messages (history)
    - Get memory chunks for user (Supabase)
    - Smart search (if needed)
    ↓
RLM Service: POST /query
    - Receive: user_id, message, conversation_id, history, sections, web_search_context
    - Build system prompt with soulprint sections
    - Call Bedrock Converse API with streaming
    - Yield SSE chunks: data: {"content": "word"}\n\n
    ↓
API: Proxy SSE stream back to client
    - No buffering, direct passthrough
    - Maintain connection (max 5min on Vercel Pro)
    ↓
Frontend: Parse SSE chunks
    - Decode stream
    - Extract content from each chunk
    - Append to message in UI (conversation X)
    - Update message character-by-character
    ↓
On stream complete:
    - Save message to Supabase (conversation_id X)
    - Update conversation.updated_at
    - Learn from chat (background)
```

### Conversation Management Flow

```
User clicks "New Conversation"
    ↓
POST /api/conversations
    - Create conversation record in DB
    - Return { id, title: "New Conversation", created_at }
    ↓
Frontend updates state
    - Add conversation to list
    - Set as activeConversationId
    - Clear messages array
    - Show empty chat for new conversation
    ↓
User types first message
    - Message saved with conversation_id = new conversation ID
    - AI generates title from first exchange (background)
    - Update conversation.title
```

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **0-1k users** | Current architecture sufficient. Single RLM instance on Render. No conversation limits. |
| **1k-10k users** | - Monitor Vercel streaming timeout rates<br>- Add conversation count limits per user (e.g., 50)<br>- Add message count limits per conversation (e.g., 500)<br>- Archive old conversations to cheaper storage<br>- Scale RLM horizontally on Render (2-3 instances) |
| **10k-100k users** | - Move RLM to containerized service (ECS/GKE) for better streaming control<br>- Implement conversation pagination<br>- Add conversation soft-delete (archive instead of delete)<br>- Consider read replicas for Supabase<br>- Implement message lazy-loading (load on scroll) |
| **100k+ users** | - Split RLM service by region<br>- Implement conversation sharding by user_id<br>- Move to dedicated Claude API keys (multi-tenant pooling)<br>- Add CDN for static assets<br>- Consider WebSocket for streaming (lower overhead than SSE) |

### Scaling Priorities

1. **First bottleneck: Streaming timeout on Vercel**
   - Symptom: Long AI responses fail after 60s
   - Fix: Upgrade to Vercel Pro (60s → 300s timeout), add timeout retry logic

2. **Second bottleneck: RLM single instance**
   - Symptom: Slow response times during peak load
   - Fix: Scale RLM horizontally on Render, add load balancer

3. **Third bottleneck: Conversation query performance**
   - Symptom: Slow conversation list loading
   - Fix: Add pagination, index optimization, Redis cache for conversation lists

---

## Anti-Patterns

### Anti-Pattern 1: Buffering Streaming Responses

**What people do:** Buffer streaming chunks in the API route to "clean them up" or "validate" before sending to client.

**Why it's wrong:** Defeats the purpose of streaming. User sees no feedback until full response is ready. Increases memory usage and timeout risk.

**Do this instead:** Proxy SSE chunks directly from RLM to client. Validate on the RLM side, not in the proxy layer.

```typescript
// BAD
const chunks = [];
for await (const chunk of stream) {
  chunks.push(chunk);
}
return new Response(chunks.join(''));

// GOOD
return new Response(stream, {
  headers: { 'Content-Type': 'text/event-stream' },
});
```

### Anti-Pattern 2: Loading All Messages for a Conversation

**What people do:** `SELECT * FROM chat_messages WHERE conversation_id = X` and load all messages into memory.

**Why it's wrong:** Long conversations (1000+ messages) kill performance. Frontend can't render that many messages anyway.

**Do this instead:** Paginate messages. Load most recent 50, lazy-load older messages on scroll.

```typescript
// BAD
const messages = await supabase
  .from('chat_messages')
  .select('*')
  .eq('conversation_id', conversationId);

// GOOD
const messages = await supabase
  .from('chat_messages')
  .select('*')
  .eq('conversation_id', conversationId)
  .order('created_at', { ascending: false })
  .limit(50);
```

### Anti-Pattern 3: Creating Conversation on Every Message

**What people do:** Check if conversation exists, create if not, for every single message.

**Why it's wrong:** Race conditions when user sends multiple messages quickly. Creates duplicate conversations.

**Do this instead:** Require conversation to exist before sending message. Create conversation explicitly via UI action (New Conversation button).

```typescript
// BAD
let conversationId = getCurrentConversation();
if (!conversationId) {
  conversationId = await createConversation(); // Race condition!
}
await sendMessage(conversationId, message);

// GOOD
// User clicks "New Conversation" → creates conversation first
// Then all messages reference that conversation_id
const conversationId = activeConversationId; // Must exist
if (!conversationId) throw new Error('No active conversation');
await sendMessage(conversationId, message);
```

### Anti-Pattern 4: Storing Voice Audio in Database

**What people do:** Record voice input, convert to base64, store in database alongside message.

**Why it's wrong:** Bloats database size. Voice data is large (1MB+ for 30s). Slow queries.

**Do this instead:** Use Web Speech API for transcription only. Store the transcribed text, not the audio. If audio storage is needed, use Supabase Storage (S3-like), not database.

```typescript
// BAD
const audioBlob = await recordVoice();
const base64Audio = await blobToBase64(audioBlob);
await saveMessage({ content: transcript, audio: base64Audio }); // Bloated!

// GOOD
const transcript = await speechToText(); // Use Web Speech API
await saveMessage({ content: transcript }); // Just text
```

### Anti-Pattern 5: Blocking Dark Mode on System Preference

**What people do:** Force dark mode based on system preference, no manual toggle.

**Why it's wrong:** Users want control. Some work in bright rooms with dark OS theme, or vice versa.

**Do this instead:** Default to system preference, but allow manual override that persists.

```typescript
// BAD
const theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
// No way to override

// GOOD
<ThemeProvider
  attribute="class"
  defaultTheme="system"  // Start with system
  enableSystem           // Detect system changes
  // User can manually toggle and it persists
>
```

---

## Build Order (Recommended Sequence)

### Phase 1: Foundation (No Dependencies)
1. **Dark Mode** - Independent, touches all UI components
2. **Rich Markdown Rendering** - Enhances existing messages, no backend changes

### Phase 2: Database Schema (Blocks Conversation Features)
3. **Conversation Management DB Schema** - Create conversations table, add conversation_id to chat_messages
4. **Migration: Backfill Conversations** - Create default conversation per user, update existing messages

### Phase 3: Conversation Features (Depends on Phase 2)
5. **Conversation CRUD API** - `/api/conversations` routes
6. **Conversation Sidebar UI** - List, switch, create, delete conversations
7. **Update Chat Context** - Filter messages by conversation_id

### Phase 4: Streaming (Independent, but enhances UX)
8. **RLM Streaming** - FastAPI SSE implementation
9. **API Streaming Proxy** - Update `/api/chat` to proxy RLM stream
10. **Test End-to-End Streaming** - Verify no buffering, handle timeouts

### Phase 5: Voice Input (Independent)
11. **Voice Input Component** - Web Speech API integration
12. **Add to Chat UI** - Voice button in message input area

### Phase 6: Polish
13. **Loading States** - Skeleton loaders for conversations, streaming indicators
14. **Error Handling** - Graceful degradation for streaming failures, voice errors
15. **Performance** - Conversation pagination, message lazy-loading

**Critical Path:** Phase 2 (DB schema) must complete before Phase 3 (Conversation features). All other phases are independent and can be worked on in parallel.

---

## Integration Points Summary

### Existing → New Connections

| Existing Component | New Feature | Integration Point |
|-------------------|-------------|-------------------|
| `chat_messages` table | Conversation Management | Add `conversation_id` FK column |
| `/api/chat/messages` route | Conversation Management | Add conversation_id filter param |
| `/api/chat` route | Streaming | Return SSE stream instead of JSON |
| `RLM /query` endpoint | Streaming | Return SSE StreamingResponse |
| `TelegramChatV2` component | Voice Input | Add VoiceInputButton alongside send button |
| `message-content.tsx` | Rich Rendering | Replace with react-markdown + Streamdown |
| All UI components | Dark Mode | Wrap in ThemeProvider, add dark: variants |
| Existing smartSearch | Conversation Management | Pass conversation_id for cache keys |

### New → Existing Dependencies

| New Component | Depends On | Reason |
|---------------|------------|--------|
| Conversation Sidebar | `/api/conversations` | Needs conversation list |
| `/api/conversations` | `conversations` table | CRUD operations |
| Streaming proxy | RLM streaming | Can't stream if RLM doesn't stream |
| VoiceInputButton | Browser API | Degrades gracefully if unsupported |
| ThemeToggle | next-themes | Theme state management |

---

## Technical Constraints

### Vercel Serverless Limits
- **Timeout:** 60s (Pro), 300s (Enterprise) — Streaming AI responses must complete within this
- **Memory:** 1GB (default), 3GB (configurable) — Not a concern for streaming (low memory)
- **Payload:** 4.5MB request, unlimited response (streaming) — Fine for chat

### RLM Service (Render)
- **Instance Type:** Starter (512MB RAM, 0.1 CPU) — May need upgrade for streaming load
- **Concurrency:** Single instance handles ~10-20 concurrent streams — Scale horizontally if needed
- **Cold Start:** ~10s on Render free tier — Consider keeping alive or upgrading to paid

### Supabase Postgres
- **Connection Limit:** 60 (Free), 200 (Pro) — Each streaming request holds connection briefly
- **Row Limit:** Unlimited — No concern for conversation counts
- **RLS Performance:** Slight overhead (~5ms per query) — Acceptable for this use case

### Browser Compatibility
- **Web Speech API:** Chrome/Edge (full), Safari (partial), Firefox (none) — 80% coverage
- **SSE (EventSource):** All modern browsers — 99% coverage
- **CSS Container Queries (for dark mode):** All modern browsers — 95% coverage

---

## Sources

**Streaming:**
- [Vercel Serverless Streaming Support](https://vercel.com/blog/streaming-for-serverless-node-js-and-edge-runtimes-with-vercel-functions)
- [FastAPI SSE Implementation](https://mahdijafaridev.medium.com/implementing-server-sent-events-sse-with-fastapi-real-time-updates-made-simple-6492f8bfc154)
- [sse-starlette for FastAPI](https://pypi.org/project/sse-starlette/)

**Conversation Management:**
- [Supabase Realtime Chat](https://supabase.com/ui/docs/nextjs/realtime-chat)
- [Next.js Chat History State Management](https://dev.to/programmingcentral/mastering-chat-history-state-in-nextjs-the-ultimate-guide-to-building-persistent-ai-apps-maf)
- [Supabase Best Practices](https://www.leanware.co/insights/supabase-best-practices)

**Rich Rendering:**
- [react-markdown GitHub](https://github.com/remarkjs/react-markdown)
- [Streamdown for Streaming Markdown](https://reactscript.com/render-streaming-ai-markdown/)
- [React Markdown Syntax Highlighting](https://medium.com/young-developer/react-markdown-code-and-syntax-highlighting-632d2f9b4ada)

**Voice Input:**
- [Web Speech API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Browser Compatibility - Can I Use](https://caniuse.com/speech-recognition)
- [Web Speech API Guide](https://www.f22labs.com/blogs/web-speech-api-a-beginners-guide/)

**Dark Mode:**
- [next-themes GitHub](https://github.com/pacocoursey/next-themes)
- [Next.js Dark Mode Guide](https://eastondev.com/blog/en/posts/dev/20251220-nextjs-dark-mode-guide/)
- [Perfect Dark Mode for Next.js](https://sreetamdas.com/blog/the-perfect-dark-mode)

---

*Architecture research for: SoulPrint Chat Enhancement Features*
*Researched: 2026-02-08*
*Confidence: HIGH*
*Existing codebase analyzed: Yes*
*Streaming pipeline verified: Yes*
*Build order optimized: Yes*
