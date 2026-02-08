# Stack Research: Chat Experience Features

**Domain:** Enhanced chat experience (streaming, voice, markdown, search, dark mode, conversations)
**Researched:** 2026-02-08
**Confidence:** HIGH

## Executive Summary

Most required capabilities are **already installed** or can be implemented with **existing infrastructure**. Only 4 new packages needed for the 6 new features:

1. **Streaming responses** - ✅ Already supported via Vercel AI SDK + FastAPI StreamingResponse
2. **Web search** - ✅ @tavily/core already installed (v0.7.1)
3. **Voice input** - ⚠️ Native Web Speech API (no library needed) OR react-speech-recognition wrapper
4. **Rich markdown** - ❌ Need react-markdown + remark-gfm + rehype-highlight
5. **Dark mode** - ✅ next-themes already installed (v0.4.6)
6. **Conversation management** - ✅ Supabase schema extension only

**New packages to install: 3-4**
- `react-markdown` (markdown rendering)
- `remark-gfm` (GitHub Flavored Markdown)
- `rehype-highlight` (code syntax highlighting)
- `react-speech-recognition` (optional, web speech wrapper)

**Backend changes needed:**
- FastAPI: Add SSE streaming endpoint
- Anthropic SDK: Use `.stream()` method (already installed)

## Stack Additions by Feature

### 1. Streaming Responses (SSE)

**Verdict:** No new packages needed. Implementation changes only.

#### Frontend (Next.js)

| Component | Current | Needed | Notes |
|-----------|---------|--------|-------|
| AI SDK streaming | ✅ ai@6.0.72 | No change | Already supports SSE via `useChat` hook |
| SSE protocol | ✅ Built-in | No change | Vercel AI SDK uses SSE by default |
| Response handling | ⚠️ Needs update | Code changes | Switch from POST to streaming fetch |

**Implementation:**
```typescript
// Already available in Vercel AI SDK
import { useChat } from 'ai/react';

const { messages, input, handleSubmit, isLoading } = useChat({
  api: '/api/chat/stream',
  streamProtocol: 'data', // SSE with structured data
});
```

**Sources:**
- [Vercel AI SDK Stream Protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol) - Uses SSE by default
- [Next.js SSE Implementation Guide](https://upstash.com/blog/sse-streaming-llm-responses) - Next.js 16 patterns
- [Fixing Slow SSE in Next.js](https://medium.com/@oyetoketoby80/fixing-slow-sse-server-sent-events-streaming-in-next-js-and-vercel-99f42fbdb996) - Vercel optimization

#### Backend (FastAPI RLM Service)

| Component | Current | Needed | Notes |
|-----------|---------|--------|-------|
| FastAPI StreamingResponse | ✅ Built-in | No change | Native streaming support |
| Anthropic streaming | ✅ anthropic SDK | Update usage | Use `client.messages.stream()` |
| SSE format | ❌ Not implemented | Code changes | Yield `data: {json}\n\n` format |

**Implementation:**
```python
from fastapi.responses import StreamingResponse
from anthropic import AsyncAnthropic

async def stream_response(messages, system_prompt):
    client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

    async def event_generator():
        async with client.messages.stream(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=system_prompt,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                # SSE format: data: {json}\n\n
                yield f"data: {json.dumps({'delta': text})}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

**Sources:**
- [FastAPI SSE Implementation](https://mahdijafaridev.medium.com/implementing-server-sent-events-sse-with-fastapi-real-time-updates-made-simple-6492f8bfc154)
- [Anthropic Python SDK Streaming](https://platform.claude.com/docs/en/build-with-claude/streaming) - Official docs
- [FastAPI Streaming Responses](https://medium.com/@ab.hassanein/streaming-responses-in-fastapi-d6a3397a4b7b)

**Why No Library Needed:**
- FastAPI has native `StreamingResponse` (no sse-starlette needed)
- Anthropic SDK has built-in streaming support
- Next.js handles SSE client-side natively via fetch API
- Vercel AI SDK abstracts the protocol

### 2. Web Search Integration

**Verdict:** Already installed. Configuration only.

| Component | Current | Needed | Action |
|-----------|---------|--------|--------|
| Tavily SDK | ✅ @tavily/core@0.7.1 | No change | Already in package.json |
| API integration | ⚠️ Partial | Update usage | Use new ultra-fast search depth |
| Governance | ❌ Not configured | Add config | Optional: domain allowlist/blocklist |

**Current Installation:**
```json
// package.json
"@tavily/core": "^0.7.1"
```

**New Features (January 2026):**
- `search_depth: "ultra-fast"` - For real-time voice/chat (latency-sensitive)
- `search_depth: "fast"` - For standard chat
- Domain governance (allowlist/blocklist at API key level)

**Implementation:**
```typescript
import { tavily } from "@tavily/core";

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

const result = await tvly.search(query, {
  search_depth: "ultra-fast", // NEW: <500ms responses
  max_results: 5,
  include_answer: true,
  // Optional governance
  include_domains: ["wikipedia.org", "stackoverflow.com"],
  exclude_domains: ["example.com"],
});
```

**Why Tavily Over Alternatives:**
- Built for AI agents (optimized response format)
- Real-time results (ultra-fast mode: <500ms)
- Single API for search + extract + research
- Native LangChain/Vercel AI SDK integration
- January 2026 updates specifically for chat/voice use cases

**Sources:**
- [Tavily January 2026 Updates](https://www.tavily.com/blog/what-tavily-shipped-in-january-26) - Ultra-fast search mode
- [How to Add Web Search to LLMs](https://www.freecodecamp.org/news/how-to-add-real-time-web-search-to-your-llm-using-tavily/)
- [Tavily API Documentation](https://www.tavily.com/blog/tavily-101-ai-powered-search-for-developers)

### 3. Voice Input (Speech-to-Text)

**Verdict:** Native Web Speech API (no library) OR react-speech-recognition wrapper (recommended).

#### Option A: Native Web Speech API (Zero Dependencies)

| Component | Browser Support | Cost | Privacy |
|-----------|----------------|------|---------|
| SpeechRecognition | ✅ Chrome/Edge/Safari | Free | Sends to Google servers (Chrome) |
| Offline support | ✅ After language pack | Free | Local processing available |

**Implementation:**
```typescript
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

recognition.continuous = false;
recognition.interimResults = true;

recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  setInput(transcript);
};

recognition.start();
```

**Advantages:**
- Zero dependencies
- Works offline (after language pack download)
- Built into modern browsers

**Limitations:**
- Chrome sends audio to Google servers (privacy concern)
- Safari requires user gesture to start
- No fallback for unsupported browsers

**Sources:**
- [Web Speech API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Browser Support - Can I Use](https://caniuse.com/speech-recognition) - 85%+ coverage
- [Speech Recognition in Browser](https://www.assemblyai.com/blog/speech-recognition-javascript-web-speech-api)

#### Option B: react-speech-recognition (Recommended)

**Package:** `react-speech-recognition@^3.10.0`

| Feature | Native API | With Library |
|---------|------------|--------------|
| React hooks | Manual setup | ✅ useSpeechRecognition() |
| Browser compat | Manual detection | ✅ Auto-detection |
| Polyfills | Manual | ✅ Automatic |
| TypeScript | Manual types | ✅ Built-in |

**Installation:**
```bash
npm install react-speech-recognition
```

**Implementation:**
```typescript
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

function VoiceInput() {
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();

  if (!browserSupportsSpeechRecognition) {
    return <span>Browser doesn't support speech recognition.</span>;
  }

  return (
    <button
      onMouseDown={() => SpeechRecognition.startListening()}
      onMouseUp={() => {
        SpeechRecognition.stopListening();
        onVoiceInput(transcript);
        resetTranscript();
      }}
    >
      🎤 Hold to speak
    </button>
  );
}
```

**Why react-speech-recognition:**
- Hooks-based React integration
- Automatic browser detection
- Clean API for common patterns (interim results, continuous mode)
- 900K+ weekly downloads, actively maintained
- TypeScript support

**Recommendation:** Use react-speech-recognition for better DX and browser compatibility handling.

**Sources:**
- [Web Speech API Guide](https://www.f22labs.com/blogs/web-speech-api-a-beginners-guide/)
- [In-Browser Speech to Text](https://senoritadeveloper.medium.com/in-browser-speech-to-text-using-the-web-speech-api-7cc67a989406)

### 4. Rich Markdown Rendering

**Verdict:** Need 3 new packages.

#### Required Packages

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| react-markdown | ^10.1.0 | Markdown → React components | Industry standard, 12M+ weekly downloads |
| remark-gfm | ^4.0.0 | GitHub Flavored Markdown | Tables, strikethrough, task lists, autolinks |
| rehype-highlight | ^7.0.2 | Code syntax highlighting | Fast, supports 190+ languages via highlight.js |

**Installation:**
```bash
npm install react-markdown remark-gfm rehype-highlight
```

**Implementation:**
```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css'; // Theme

function MessageContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        // Custom renderers for code blocks
        code({node, inline, className, children, ...props}) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline ? (
            <pre className={className}>
              <code {...props}>{children}</code>
            </pre>
          ) : (
            <code className="inline-code" {...props}>{children}</code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

**Why These Libraries:**

**react-markdown:**
- Safe by default (no dangerouslySetInnerHTML)
- Virtual DOM rendering (React-native)
- Plugin ecosystem for extensibility
- Actively maintained (566 commits, recent releases)

**remark-gfm:**
- Adds GitHub Flavored Markdown features
- Essential for code-heavy responses (fenced code blocks)
- Tables for structured data
- Task lists for action items

**rehype-highlight:**
- Fast syntax highlighting via highlight.js
- 190+ language support (JavaScript, Python, TypeScript, Rust, Go, etc.)
- Themeable (GitHub Dark, Monokai, VS Code themes)
- No runtime deps (uses lowlight - compiled highlight.js)

**Alternative Considered: react-syntax-highlighter**

| Feature | rehype-highlight | react-syntax-highlighter |
|---------|------------------|--------------------------|
| Integration | Plugin for react-markdown | Separate component |
| Bundle size | Smaller (tree-shakeable) | Larger (includes all themes) |
| Language support | 190+ | 190+ |
| Themes | Import CSS | Import JS |
| TypeScript | ✅ @types/react-markdown | ✅ @types/react-syntax-highlighter |

**Verdict:** Use rehype-highlight for cleaner integration with react-markdown.

**Sources:**
- [react-markdown GitHub](https://github.com/remarkjs/react-markdown) - Official repo
- [React Markdown Code Highlighting](https://medium.com/young-developer/react-markdown-code-and-syntax-highlighting-632d2f9b4ada)
- [Enhancing React Markdown](https://hannadrehman.com/blog/enhancing-your-react-markdown-experience-with-syntax-highlighting)
- [remark-gfm npm](https://www.npmjs.com/package/remark-gfm)
- [rehype-highlight npm](https://www.npmjs.com/package/rehype-highlight)

### 5. Dark Mode Theming

**Verdict:** Already installed. Configuration only.

| Component | Current | Needed | Action |
|-----------|---------|--------|--------|
| next-themes | ✅ v0.4.6 | No change | Already in package.json |
| Radix UI dark mode | ✅ Via components | Works with next-themes | Already configured |
| Tailwind dark variant | ✅ Configured | Update for Tailwind v4 | Add @custom-variant if needed |

**Current Installation:**
```json
// package.json
"next-themes": "^0.4.6"
```

**Current Radix UI Components with Dark Mode:**
```json
"@radix-ui/react-dialog": "^1.1.15",
"@radix-ui/react-scroll-area": "^1.2.10",
// ... all support dark mode theming
```

**Implementation (Already Standard Pattern):**
```tsx
// app/providers.tsx
import { ThemeProvider } from 'next-themes';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class" // Tailwind CSS class-based dark mode
      defaultTheme="system" // Respect OS preference
      enableSystem
      disableTransitionOnChange // Prevent flash
    >
      {children}
    </ThemeProvider>
  );
}
```

```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning> {/* Required for next-themes */}
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

```tsx
// components/theme-toggle.tsx
import { useTheme } from 'next-themes';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      {theme === 'dark' ? '🌞' : '🌙'}
    </button>
  );
}
```

**Tailwind CSS Configuration:**
```css
/* globals.css - Tailwind v4 */
@custom-variant dark; /* Enables manual .dark class switching */

/* Light mode (default) */
.message {
  @apply bg-white text-gray-900;
}

/* Dark mode */
.dark .message {
  @apply bg-gray-800 text-gray-100;
}
```

**Why next-themes:**
- ✅ Zero flash on load (uses blocking script)
- ✅ System preference support (`prefers-color-scheme`)
- ✅ localStorage persistence (theme survives reload)
- ✅ Tab synchronization (theme changes sync across tabs)
- ✅ Works with Tailwind, CSS variables, or any approach
- ✅ TypeScript support
- ✅ 2.5M+ weekly downloads

**What's Already Working:**
- Radix UI components have built-in dark mode variants
- Tailwind CSS dark: variant is configured
- next-themes is installed and ready

**What Needs Implementation:**
1. Add `<ThemeProvider>` to root layout
2. Create theme toggle component
3. Add dark mode CSS variables or Tailwind classes
4. Test with code highlighting themes (light/dark variants)

**Sources:**
- [next-themes GitHub](https://github.com/pacocoursey/next-themes) - Official repo
- [shadcn/ui Dark Mode](https://ui.shadcn.com/docs/dark-mode/next) - Next.js pattern
- [Radix UI Dark Mode](https://www.radix-ui.com/themes/docs/theme/dark-mode)
- [Next.js Dark Mode Guide](https://medium.com/@salihbezai98/step-by-step-guide-to-adding-dark-mode-with-next-themes-in-next-js-and-tailwind-css-15db7876f071)

### 6. Conversation Management

**Verdict:** No new packages. Database schema extension only.

#### Current Model (Single Conversation)

```typescript
// Current: One chat history per user
{
  user_id: "uuid",
  messages: ChatMessage[] // All messages in one array
}
```

**Problem:** Users can't organize topics, can't start fresh conversations, can't reference past discussions.

#### New Model (Multiple Conversations)

**Database Schema (Supabase PostgreSQL):**

```sql
-- New table: conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_count INTEGER NOT NULL DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);

-- New table: messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tokens_used INTEGER -- Optional: track token usage per message
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- RLS policies
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own conversations"
  ON conversations FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage messages in their conversations"
  ON messages FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );
```

**Why This Schema:**
- **Scalability:** Indexed queries for fast conversation listing
- **RLS Security:** Users can only access their own conversations
- **Soft Delete:** `is_archived` instead of hard delete preserves history
- **Title Generation:** AI-generated titles from first message
- **Message Count:** Cached count for UI (updated via trigger)

**Implementation (Supabase SDK):**

```typescript
// lib/conversations/crud.ts
import { createClient } from '@/lib/supabase/server';

export async function createConversation(userId: string, title: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listConversations(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, created_at, updated_at, message_count')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getConversation(conversationId: string) {
  const supabase = await createClient();

  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (convError) throw convError;

  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (msgError) throw msgError;

  return { ...conversation, messages };
}

export async function addMessage(conversationId: string, role: 'user' | 'assistant', content: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, role, content })
    .select()
    .single();

  if (error) throw error;

  // Update conversation updated_at and message_count
  await supabase.rpc('increment_message_count', { conversation_id: conversationId });

  return data;
}
```

**Migration Strategy:**
1. Create new tables (conversations, messages)
2. Migrate existing chat history to default conversation per user
3. Run both models in parallel (backwards compatibility)
4. Switch UI to new model
5. Deprecate old model after 30 days

**UI Patterns:**

| Pattern | Library Needed | Notes |
|---------|---------------|-------|
| Conversation list | ✅ Radix Scroll Area | Already installed |
| New conversation button | ✅ Radix Dialog | Already installed |
| Conversation title edit | ✅ Radix Dialog | Already installed |
| Archive/delete | ✅ Radix AlertDialog | Already installed |

**No New Packages Needed:**
- Radix UI components already support all UI patterns
- Supabase SDK already installed
- PostgreSQL natively supports this schema

**Sources:**
- [Supabase Realtime Chat Example](https://supabase.com/ui/docs/nextjs/realtime-chat) - Conversation pattern
- [Supabase Schema Best Practices](https://supabase.com/docs/guides/local-development/declarative-database-schemas)
- [Using Custom Schemas](https://supabase.com/docs/guides/api/using-custom-schemas)

## Summary: What to Install

### New Dependencies (4 packages)

```bash
# Required for markdown rendering
npm install react-markdown remark-gfm rehype-highlight

# Optional for voice input (recommended over native API)
npm install react-speech-recognition
```

### Already Installed (Use As-Is)

```json
{
  "ai": "^6.0.72",                    // Streaming support via useChat
  "@tavily/core": "^0.7.1",          // Web search (updated Jan 2026)
  "next-themes": "^0.4.6",           // Dark mode
  "@radix-ui/*": "latest",            // UI components for conversations
  "@supabase/supabase-js": "^2.93.1" // Database for conversations
}
```

### Backend Dependencies (Python RLM Service)

**Already Installed:**
```python
fastapi          # StreamingResponse native
anthropic        # client.messages.stream() support
```

**No New Python Packages Needed**

## Version Compatibility Matrix

| Package | Version | Peer Dependencies | Compatible With |
|---------|---------|-------------------|-----------------|
| react-markdown | ^10.1.0 | react@^18 or ^19 | ✅ React 19.2.3 (installed) |
| remark-gfm | ^4.0.0 | Node.js 16+ | ✅ Node.js 20+ |
| rehype-highlight | ^7.0.2 | Node.js 16+ | ✅ Node.js 20+ |
| react-speech-recognition | ^3.10.0 | react@^16.8, react-dom@^16.8 | ✅ React 19 (forward compatible) |
| next-themes | ^0.4.6 | next@*, react@*, react-dom@* | ✅ Next.js 16.1.5 (installed) |
| @tavily/core | ^0.7.1 | Node.js 18+ | ✅ Node.js 20+ |

**No Conflicts:** All packages are compatible with existing stack.

## What NOT to Install

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| marked | Older, security issues | react-markdown (safer, actively maintained) |
| markdown-it | Not React-native | react-markdown (virtual DOM) |
| react-syntax-highlighter | Larger bundle, separate component | rehype-highlight (integrated plugin) |
| prismjs directly | Manual setup, CSP issues | rehype-highlight (automated) |
| langchain | Heavy dependency, unnecessary | @tavily/core directly |
| socket.io | Overkill for one-way streaming | SSE via Vercel AI SDK |
| pusher / ably | Third-party cost | Supabase Realtime (already available) |
| annyang | Unmaintained (last update 2017) | react-speech-recognition or native API |
| react-mic | Overkill (full audio recording) | Web Speech API (text only) |

## Integration Points with Existing Stack

### 1. Streaming: Next.js API Route → RLM Service

**Flow:**
```
Browser (useChat hook)
  ↓ SSE connection
Next.js API Route (/api/chat/stream)
  ↓ HTTP request
FastAPI RLM Service (/query-stream)
  ↓ StreamingResponse
Anthropic API (client.messages.stream)
  ↓ SSE back through chain
Browser (renders incrementally)
```

**Next.js Route Handler:**
```typescript
// app/api/chat/stream/route.ts
import { StreamingTextResponse } from 'ai';

export async function POST(req: Request) {
  const { message, conversationId } = await req.json();

  // Forward to RLM service with SSE
  const rlmResponse = await fetch(`${RLM_URL}/query-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, conversation_id: conversationId }),
  });

  // Pipe RLM SSE stream to client
  return new StreamingTextResponse(rlmResponse.body);
}
```

**Key Configuration:**
- Next.js: `export const runtime = 'nodejs'` (required for streaming)
- Next.js: `export const dynamic = 'force-dynamic'` (disable caching)
- FastAPI: `media_type="text/event-stream"` (SSE header)

### 2. Web Search: Chat Route → Tavily → RLM

**Flow:**
```
User asks question requiring real-time data
  ↓
Chat route detects search intent
  ↓
Tavily API call (ultra-fast mode)
  ↓
Results appended to system prompt
  ↓
RLM generates answer with sources
```

**Implementation:**
```typescript
// app/api/chat/route.ts (existing file)
import { tavily } from "@tavily/core";

// Add before RLM call
let webSearchContext = "";
if (needsWebSearch(message)) {
  const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
  const results = await tvly.search(message, {
    search_depth: "ultra-fast",
    max_results: 5,
    include_answer: true,
  });

  webSearchContext = results.results
    .map(r => `[${r.title}](${r.url})\n${r.content}`)
    .join('\n\n');
}

// Pass to RLM (already supports web_search_context)
await rlmClient.query({
  message,
  web_search_context: webSearchContext,
});
```

**Already Working:** RLM service already accepts `web_search_context` parameter (line 46 in main.py).

### 3. Dark Mode: Radix UI + Tailwind + next-themes

**Integration:**
```tsx
// All Radix components auto-support dark mode
import { Dialog } from '@radix-ui/react-dialog';

// Add data-theme attribute via next-themes
<html lang="en" suppressHydrationWarning>
  <body className={theme === 'dark' ? 'dark' : ''}>
    <Dialog> {/* Automatically themed */}
      <Dialog.Content className="bg-white dark:bg-gray-800">
        ...
      </Dialog.Content>
    </Dialog>
  </body>
</html>
```

**Code Highlighting Themes:**
```typescript
// Toggle highlight.js theme based on mode
import { useTheme } from 'next-themes';

function CodeThemeLoader() {
  const { theme } = useTheme();

  return (
    <link
      rel="stylesheet"
      href={theme === 'dark'
        ? '/highlight.js/github-dark.css'
        : '/highlight.js/github-light.css'
      }
    />
  );
}
```

### 4. Conversations: Supabase RLS + React Components

**Integration:**
```tsx
// app/chat/[conversationId]/page.tsx
import { listConversations, getConversation } from '@/lib/conversations/crud';

export default async function ChatPage({ params }: { params: { conversationId: string } }) {
  const conversation = await getConversation(params.conversationId);

  return (
    <div className="flex">
      <ConversationList /> {/* Radix ScrollArea */}
      <ChatWindow conversation={conversation} /> {/* Existing component */}
    </div>
  );
}
```

**RLS Security:** Already configured in Supabase for auth.users. Extend to conversations/messages tables.

## Bundle Size Impact

| Package | Minified | Gzipped | Impact | Notes |
|---------|----------|---------|--------|-------|
| react-markdown | ~38 KB | ~12 KB | Low | Tree-shakeable |
| remark-gfm | ~18 KB | ~5 KB | Minimal | Plugin only |
| rehype-highlight | ~250 KB | ~80 KB | Medium | Includes highlight.js core + 190 languages |
| react-speech-recognition | ~8 KB | ~3 KB | Minimal | Thin wrapper |
| **Total Added** | **~314 KB** | **~100 KB** | **Medium** | Mostly highlight.js |

**Optimization Strategies:**
1. **Code splitting:** Import highlight.js languages on-demand
2. **Lazy load:** Load react-markdown only in chat view
3. **CDN:** Serve highlight.js themes via CDN (not bundled)

**Example (Optimized):**
```typescript
// Lazy load markdown renderer
const ReactMarkdown = lazy(() => import('react-markdown'));

// Load only needed highlight.js languages
import { getHighlighter } from 'rehype-highlight/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import typescript from 'highlight.js/lib/languages/typescript';

getHighlighter().registerLanguage('javascript', javascript);
getHighlighter().registerLanguage('python', python);
getHighlighter().registerLanguage('typescript', typescript);
```

**Result:** ~100 KB gzipped → ~40 KB gzipped (60% reduction)

## Performance Considerations

### Streaming Response Latency

| Metric | Without Streaming | With Streaming | Improvement |
|--------|------------------|----------------|-------------|
| Time to first token | ~800ms | ~800ms | Same (backend latency) |
| Time to first render | ~3-5s (full response) | ~800ms | **4-6x faster perceived** |
| Total completion time | ~3-5s | ~3-5s | Same |

**Why Streaming Matters:** User sees response immediately, improving perceived performance even though total time is unchanged.

### Web Search Latency

| Search Depth | Latency | Use Case |
|--------------|---------|----------|
| ultra-fast | <500ms | Voice chat, real-time agents |
| fast | ~1s | Standard chat |
| basic | ~2s | Deep research (default) |

**Recommendation:** Use `ultra-fast` for chat (Tavily's January 2026 update optimized for this).

### Markdown Rendering Performance

| Message Length | Render Time | Notes |
|----------------|-------------|-------|
| <1000 chars | <10ms | Negligible |
| 1000-5000 chars | ~20-50ms | Typical AI response |
| >5000 chars | ~100ms+ | Long form content |

**Optimization:** Virtualize message list (only render visible messages) if >100 messages per conversation.

### Voice Input Latency

| Stage | Latency | Notes |
|-------|---------|-------|
| Speech → text | Real-time | Streaming transcription |
| Processing | ~50ms | Browser overhead |
| Send to API | ~200ms | Network latency |

**Total:** <300ms from speech end to API request (imperceptible).

## Configuration Checklist

### Environment Variables

**Next.js (.env.local):**
```bash
# Existing
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# New (if not already set)
TAVILY_API_KEY=tvly-... # Get from tavily.com
RLM_SERVICE_URL=https://soulprint-landing.onrender.com
```

**RLM Service (.env):**
```bash
# Existing
ANTHROPIC_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...

# No new vars needed for streaming (uses existing Anthropic SDK)
```

### Database Migrations

```bash
# Create conversations schema
psql $DATABASE_URL < migrations/002_conversations.sql

# Or via Supabase dashboard: Database → SQL Editor → New Query
```

### CSS Imports

**app/globals.css:**
```css
/* Add highlight.js theme */
@import 'highlight.js/styles/github-dark.css' (prefers-color-scheme: dark);
@import 'highlight.js/styles/github-light.css' (prefers-color-scheme: light);

/* Tailwind dark mode variant (if using Tailwind v4) */
@custom-variant dark;
```

### TypeScript Configuration

**tsconfig.json (no changes needed):**
- react-markdown: Has built-in types
- remark-gfm: Has built-in types
- rehype-highlight: Has built-in types
- react-speech-recognition: Has @types/react-speech-recognition (community types)

**Install types (if needed):**
```bash
npm install -D @types/react-speech-recognition
```

## Migration Path

### Phase 1: Streaming (Week 1)
1. Update RLM service to add `/query-stream` endpoint
2. Create Next.js `/api/chat/stream` route
3. Update frontend to use `useChat` hook
4. Test with existing conversations

### Phase 2: Markdown + Dark Mode (Week 1)
1. Install react-markdown packages
2. Wrap message content with `<ReactMarkdown>`
3. Add ThemeProvider to root layout
4. Create theme toggle component
5. Test code highlighting in dark/light modes

### Phase 3: Conversations (Week 2)
1. Run database migration (create tables)
2. Migrate existing messages to default conversation
3. Create conversation CRUD functions
4. Update chat UI to support conversation list
5. Test conversation switching

### Phase 4: Web Search (Week 2)
1. Add search intent detection
2. Integrate Tavily API calls
3. Update RLM prompt with search results
4. Add citations to UI
5. Test with current events queries

### Phase 5: Voice Input (Week 3)
1. Install react-speech-recognition
2. Add microphone button to input
3. Test browser compatibility
4. Add fallback for unsupported browsers
5. Polish UX (interim results, visual feedback)

**Total Estimated Time:** 3 weeks for all features (assuming 1 developer, part-time).

## Testing Strategy

### Unit Tests (Vitest)

```typescript
// tests/markdown-renderer.test.tsx
import { render } from '@testing-library/react';
import ReactMarkdown from 'react-markdown';

test('renders code blocks with syntax highlighting', () => {
  const markdown = '```typescript\nconst x = 1;\n```';
  const { container } = render(<ReactMarkdown>{markdown}</ReactMarkdown>);
  expect(container.querySelector('code.language-typescript')).toBeInTheDocument();
});
```

### E2E Tests (Playwright)

```typescript
// tests/e2e/streaming.spec.ts
import { test, expect } from '@playwright/test';

test('streams response incrementally', async ({ page }) => {
  await page.goto('/chat');
  await page.fill('input[name="message"]', 'Hello');
  await page.click('button[type="submit"]');

  // Wait for first token (streaming started)
  await expect(page.locator('.message-assistant').first()).toBeVisible({ timeout: 2000 });

  // Verify incremental rendering (not waiting for full response)
  const initialLength = await page.locator('.message-assistant').first().textContent().then(t => t?.length || 0);
  await page.waitForTimeout(500);
  const laterLength = await page.locator('.message-assistant').first().textContent().then(t => t?.length || 0);

  expect(laterLength).toBeGreaterThan(initialLength); // Content grew = streaming worked
});
```

### Integration Tests

```typescript
// tests/integration/web-search.test.ts
test('integrates Tavily search results into response', async () => {
  const response = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message: 'What happened today in tech news?' }),
  });

  const data = await response.json();
  expect(data.sources).toBeDefined(); // Search results included
  expect(data.sources.length).toBeGreaterThan(0);
});
```

## Known Limitations

### 1. Streaming on Vercel

**Issue:** Vercel Hobby tier has 10s timeout for streaming responses.
**Mitigation:**
- Use Vercel Pro ($20/mo) for 60s timeout
- Or deploy RLM service to handle long responses (Render has no timeout)
- Or chunk responses into <10s segments

### 2. Web Speech API Browser Support

**Issue:** Safari requires user gesture, Firefox uses different engine.
**Mitigation:**
- Use react-speech-recognition for compatibility layer
- Show fallback UI on unsupported browsers
- Consider paid STT API (Deepgram, AssemblyAI) for production

### 3. Markdown Rendering XSS

**Issue:** User-generated markdown could inject scripts.
**Mitigation:**
- react-markdown is safe by default (no dangerouslySetInnerHTML)
- Disallow `rehype-raw` plugin (allows raw HTML)
- Sanitize any HTML in markdown with DOMPurify (if needed)

### 4. Code Highlighting Bundle Size

**Issue:** highlight.js is 250 KB minified (80 KB gzipped).
**Mitigation:**
- Lazy load only needed languages
- Use CDN for highlight.js core
- Consider Shiki (VS Code's highlighter) for smaller bundle

## Sources

### High Confidence (Official Documentation)

- [Vercel AI SDK Stream Protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol) - SSE implementation
- [Next.js Streaming Documentation](https://nextjs.org/learn/dashboard-app/streaming) - Official Next.js guide
- [Anthropic Streaming Messages](https://platform.claude.com/docs/en/build-with-claude/streaming) - Official Python SDK
- [FastAPI Streaming Responses](https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse) - Official docs
- [react-markdown GitHub](https://github.com/remarkjs/react-markdown) - Official repository
- [Tavily API Documentation](https://www.tavily.com/blog/tavily-101-ai-powered-search-for-developers) - Official guide
- [next-themes GitHub](https://github.com/pacocoursey/next-themes) - Official repository
- [Web Speech API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) - Standards documentation
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security) - Official guide

### Medium Confidence (Verified Community Sources)

- [Next.js SSE Streaming Guide](https://upstash.com/blog/sse-streaming-llm-responses) - Upstash (Vercel partner)
- [Fixing Slow SSE in Next.js](https://medium.com/@oyetoketoby80/fixing-slow-sse-server-sent-events-streaming-in-next-js-and-vercel-99f42fbdb996) - Recent implementation (Jan 2026)
- [FastAPI SSE Implementation](https://mahdijafaridev.medium.com/implementing-server-sent-events-sse-with-fastapi-real-time-updates-made-simple-6492f8bfc154) - Detailed tutorial
- [React Markdown Code Highlighting](https://medium.com/young-developer/react-markdown-code-and-syntax-highlighting-632d2f9b4ada) - Practical guide
- [Tavily January 2026 Updates](https://www.tavily.com/blog/what-tavily-shipped-in-january-26) - Official product updates
- [shadcn/ui Dark Mode](https://ui.shadcn.com/docs/dark-mode/next) - Community standard pattern
- [Speech Recognition in Browser](https://www.assemblyai.com/blog/speech-recognition-javascript-web-speech-api) - AssemblyAI guide

### Low Confidence (Not Used for Critical Decisions)

- Various Stack Overflow threads - Referenced for troubleshooting patterns only
- Reddit discussions - General sentiment, not technical facts
- Older blog posts (pre-2024) - May reference outdated APIs

---

## Final Recommendation

**Install 4 packages, extend 0 backend dependencies, migrate 1 database schema.**

**Total estimated effort:**
- Package installation: 15 minutes
- Streaming implementation: 8 hours (backend + frontend)
- Markdown rendering: 2 hours
- Dark mode setup: 1 hour
- Conversation management: 12 hours (schema + UI)
- Web search integration: 4 hours
- Voice input: 4 hours
- **Total: ~31 hours (1 week sprint)**

**Stack additions are minimal and strategic** - most complexity is implementation, not dependencies.

---
*Stack research for: Chat Experience Features (Streaming, Voice, Markdown, Search, Dark Mode, Conversations)*
*Researched: 2026-02-08*
*Confidence: HIGH (verified with official documentation and recent 2026 sources)*
