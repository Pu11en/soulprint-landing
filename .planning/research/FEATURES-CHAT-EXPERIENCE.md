# Feature Research: Full Chat Experience

**Domain:** AI Chat Applications (Conversation Management, Streaming, Search, Rich Rendering, Voice, Dark Mode)
**Researched:** 2026-02-08
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Conversation history list** | 96% of users frustrated by chats that restart from zero. Multi-conversation management is standard across ChatGPT, Claude, Gemini | MEDIUM | Requires conversations table, sidebar UI, list/filter/search. Must support unlimited scroll with recent conversations visible. |
| **Token-by-token streaming** | Makes AI feel instant and alive. Users expect text to appear gradually like ChatGPT/Claude | MEDIUM | Use Server-Sent Events (SSE) or Vercel AI SDK. Critical: return Response immediately, stream in background (avoid buffering). Must handle connection interrupts. |
| **Markdown rendering** | All major AI chats render formatted text, lists, tables, links | LOW | Use react-markdown + remark-gfm for GitHub-flavored markdown (tables, strikethrough, task lists) |
| **Code syntax highlighting** | Code blocks without highlighting feel broken. Users expect colored syntax | MEDIUM | Use react-syntax-highlighter with Prism OR Shiki. Shiki preferred (inline styles, lazy loading, better themes). Memoize parsed blocks for streaming performance. |
| **Copy button on code blocks** | One-click copy is expected. Manual selection feels primitive | LOW | Add copy button to code block component. Show "Copied!" feedback. |
| **Dark mode toggle** | By 2027-2028, dark mode is table stakes, not differentiator | LOW | Use next-themes with localStorage persistence. Inject blocking script to prevent flash. Use #121212 not #000000, off-whites not pure white. |
| **Basic web search with citations** | Users expect AI to access current information with verifiable sources | HIGH | Implement search tool that LLM can call. Return inline citations with clickable links (title, URL, cited_text). Claude-style: inline brackets or links at point of use. |
| **New conversation button** | Users need to start fresh without losing history | LOW | Clear current conversation context, create new conversation in DB, update sidebar |
| **Conversation rename** | Auto-generated titles aren't always descriptive | LOW | Inline edit in sidebar or modal. Update conversations.title in DB |
| **Conversation delete** | Users need to remove unwanted history | LOW | Soft delete (set deleted_at) or hard delete. Show confirmation modal. Remove from sidebar immediately. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Persistent memory across conversations** | SoulPrint's core value: AI that KNOWS you. Memory is becoming standard but deep personality integration is not | HIGH (already built) | You already have this with soulprint + memory search. Differentiator: 7-section structured context (SOUL, IDENTITY, USER) that other platforms don't use. |
| **Memory-informed conversation starters** | Show personalized prompts based on user's past conversations and preferences | MEDIUM | Generate 3-5 suggested questions using recent memory chunks + soulprint. Refresh on each new conversation. More personal than generic "What can I help with?" |
| **Cross-conversation memory highlights** | Surface relevant past conversations automatically during chat | HIGH | Semantic search during response generation. Show "Related conversations" panel with snippets. Goes beyond simple history search. |
| **Personality-aware tone adaptation** | AI adjusts communication style based on soulprint personality profile | MEDIUM | Already have personality system. Differentiator: make it more visible/explicit. Let users see how their SoulPrint shapes responses. |
| **Voice input with personality retention** | Voice that understands your communication patterns and context | MEDIUM-HIGH | Web Speech API (Chrome/Edge only) OR OpenAI Realtime API (production quality). Differentiator: voice + memory integration. |
| **Interrupt & update mid-response** | Refine AI's work in progress without restarting | MEDIUM | Allow user to send message while streaming. Stop current stream, append context, restart. ChatGPT added this in 2026. |
| **Conversation spaces/categories** | Organize conversations by topic (Work, Personal, Creative, etc.) | MEDIUM | Add category to conversations table. Filter sidebar by space. Similar to ChatGPT's "Health" space for privacy. |
| **Memory evolution timeline** | Show how AI's understanding of user has changed over time | HIGH | Visualize soulprint updates chronologically. "AI learned X about you on Y date." Unique to memory-based systems. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time collaboration** | "Make it like Google Docs but for AI chat" | Adds massive technical complexity, unclear user value. Most AI chat is personal. | Focus on personal experience. If sharing needed, add simple export/share link. |
| **Unlimited conversation branching** | "Let users fork conversations at any point" | Creates complex tree UI, unclear mental model for users. ChatGPT doesn't do this. | Single linear conversation with "start new from here" that creates separate conversation. |
| **Manual memory editing** | "Let users edit what AI remembers" | Becomes cognitive burden. Users won't maintain it. Creates inconsistency with actual conversation history. | Automatic memory from conversations only. Let users delete memories but not manually add. |
| **Over-engineered persona switching** | "Let users create multiple AI personas" | Dilutes core value (AI that knows YOU). Adds UI complexity. Most users won't use multiple personas. | Single personality profile from soulprint. Maybe "tone" toggle (professional/casual) at most. |
| **Animated typing indicators** | "Show AI is thinking with animations" | Feels slower than instant streaming. Users prefer seeing tokens immediately. | Start streaming immediately. First token = indicator AI is responding. |
| **Every feature as "AI-powered"** | "Use AI to categorize, summarize, suggest everything" | Each AI call adds latency and cost. Deterministic algorithms work fine for many things. | Use AI where it adds clear value (response generation, semantic search). Use normal code for CRUD operations. |
| **Voice output (TTS) everywhere** | "Read all responses aloud" | Most users read faster than listen. Audio requires attention. Battery drain on mobile. | Make it opt-in for specific messages, not default. Focus on voice INPUT (more valuable). |

## Feature Dependencies

```
[Conversation Management]
    └──requires──> [Conversations DB Table]
                       └──requires──> [User Authentication] (already built)

[Token Streaming]
    └──requires──> [SSE or Vercel AI SDK]
                       └──requires──> [API Route Handler]

[Code Syntax Highlighting]
    └──requires──> [Markdown Rendering]
                       └──requires──> [react-markdown + remark-gfm]

[Web Search Citations]
    └──requires──> [Tool Calling Architecture]
                       └──requires──> [Search API Integration]

[Voice Input]
    └──requires──> [Audio Permissions]
                       └──requires──> [Web Speech API OR OpenAI Realtime API]

[Memory-Informed Starters]
    └──requires──> [Conversation History]
                       └──requires──> [Memory Search] (already built)

[Dark Mode]
    └──enhances──> [All UI Components]
                       └──requires──> [CSS Variable System]
```

### Dependency Notes

- **Streaming requires SSE:** Must implement before rich rendering, otherwise rendering blocks on full response
- **Markdown must handle streaming:** Standard react-markdown re-renders entire history on each token (performance issue). Need memoization or streaming-aware markdown library (Streamdown)
- **Code highlighting impacts streaming performance:** Each token triggers re-parse of code blocks. Must memoize completed blocks.
- **Web search requires tool architecture:** Don't build search-specific integration. Build generic tool system, add search as first tool.
- **Voice input Chrome-only limitation:** Web Speech API only works in Chrome/Edge. OpenAI Realtime API is cross-browser but costs more.
- **Dark mode affects all components:** Implement early or retrofit everything later. Use CSS variables from start.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate enhanced chat experience.

- [x] **Conversation history (already exists)** — Have single conversation, need multi-conversation management
- [ ] **Conversation sidebar** — List, create new, switch between conversations (P1 for multi-conversation)
- [ ] **Token-by-token streaming** — Makes AI feel modern and responsive (P1 for perceived performance)
- [ ] **Markdown rendering** — Users expect formatted responses (P1 for feature parity)
- [ ] **Code syntax highlighting** — Code blocks are common in AI responses (P1 for developer audience)
- [ ] **Copy button on code blocks** — Low-effort, high-value (P1 with syntax highlighting)
- [ ] **Dark mode** — Table stakes by 2026, implement early (P1 to avoid CSS retrofit)
- [ ] **Conversation rename/delete** — Necessary for multi-conversation management (P1 with sidebar)

### Add After Validation (v1.x)

Features to add once core streaming + conversation management works.

- [ ] **Web search with citations** — Validates if users need current info beyond their memory (P2, add when users request it)
- [ ] **Memory-informed conversation starters** — Differentiator but not blocking (P2, enhances new conversation experience)
- [ ] **Voice input** — High-value but niche. Add when mobile usage grows (P2, triggered by mobile analytics)
- [ ] **Interrupt & update** — Nice polish but not essential (P2, copy ChatGPT's pattern)
- [ ] **Conversation spaces/categories** — Needed when users have 50+ conversations (P2, triggered by power users)

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Cross-conversation memory highlights** — Complex, needs experimentation (P3, after memory usage validation)
- [ ] **Memory evolution timeline** — Unique differentiator but edge case (P3, marketing feature more than utility)
- [ ] **Advanced voice features** — Voice + memory integration needs research (P3, requires voice input adoption)
- [ ] **Rich media rendering** — Images, videos in responses (P3, not common in current usage)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Token-by-token streaming | HIGH (perceived perf) | MEDIUM (SSE or Vercel AI SDK) | P1 |
| Conversation sidebar | HIGH (table stakes) | MEDIUM (UI + DB queries) | P1 |
| Markdown rendering | HIGH (all AI chats have it) | LOW (react-markdown) | P1 |
| Code syntax highlighting | HIGH (developer audience) | MEDIUM (Shiki + memoization) | P1 |
| Dark mode | HIGH (2026 expectation) | LOW (next-themes) | P1 |
| Conversation rename/delete | MEDIUM (conversation mgmt) | LOW (DB updates) | P1 |
| Copy button on code | MEDIUM (convenience) | LOW (button + clipboard API) | P1 |
| Web search citations | MEDIUM (current info) | HIGH (search API + tool system) | P2 |
| Memory-informed starters | MEDIUM (differentiator) | MEDIUM (generate from memory) | P2 |
| Voice input | MEDIUM (accessibility) | MEDIUM-HIGH (Web Speech API) | P2 |
| Interrupt & update | LOW (nice-to-have) | MEDIUM (streaming control) | P2 |
| Conversation spaces | LOW (power users only) | MEDIUM (category system) | P2 |
| Cross-conversation highlights | MEDIUM (differentiator) | HIGH (semantic search UI) | P3 |
| Memory evolution timeline | LOW (marketing value) | HIGH (timeline visualization) | P3 |

**Priority key:**
- P1: Must have for launch (table stakes + core streaming experience)
- P2: Should have, add when possible (differentiators + polish)
- P3: Nice to have, future consideration (unique but not essential)

## Competitor Feature Analysis

| Feature | ChatGPT | Claude | Our Approach (SoulPrint) |
|---------|---------|--------|--------------------------|
| Conversation sidebar | Unlimited scroll, recent limit, spaces (Health), Library for images | Clean list, search, projects/workspaces | **Similar:** List with search/filter. **Differentiator:** Memory-informed suggestions per conversation |
| Streaming | Token-by-token with interrupt/update | Token-by-token, smooth | Token-by-token via Vercel AI SDK or SSE. Consider interrupt later. |
| Web search | Built-in, citations in footnotes | Built-in, inline citations with links | **Follow Claude's pattern:** Inline citations at point of use (better UX than footnotes) |
| Code rendering | Syntax highlighting + copy button | Syntax highlighting + copy button | Same (Shiki or Prism + copy) |
| Dark mode | Yes, with localStorage | Yes | Yes, next-themes (same approach) |
| Memory | Profile-style persistent memory, workspace-level | Workspace memory, project context | **Differentiator:** Deep personality profile (SoulPrint) + 7-section context + memory search across all conversations |
| Voice input | Built-in (mobile + desktop) | Not standard (varies by platform) | **Start with:** Web Speech API (Chrome/Edge). **Future:** OpenAI Realtime API for cross-browser |
| Voice output | Read responses aloud | Not standard | **Skip for MVP.** Voice INPUT more valuable than output. |
| Collaboration | Share conversations (link) | Share artifacts/projects | **Defer.** Focus on personal experience first. Simple export/share later. |
| Multimodal | Images, files, vision | Images, PDFs, vision | **Defer.** Text-first, add media post-MVP |

## Implementation Notes

### Streaming Performance

**Critical for SoulPrint:** With memory search returning context chunks, responses can be longer than typical AI chats. Streaming performance even more important.

- Use Vercel AI SDK `useChat()` hook for client-side streaming
- Server: Return Response immediately, stream in background (don't await loop completion)
- Memoize parsed markdown blocks to prevent re-rendering entire conversation history on each token
- Consider Streamdown library for streaming-aware markdown (handles incomplete syntax during streaming)

### Conversation Management Schema

**Recommended DB structure:**

```sql
conversations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  title TEXT, -- Auto-generate from first message or user-edited
  category TEXT, -- NULL initially, add for spaces feature later
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ -- Soft delete
)

messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  role TEXT, -- 'user' | 'assistant' | 'system'
  content TEXT,
  created_at TIMESTAMPTZ
)
```

**Performance:** Index on `user_id, updated_at DESC` for sidebar queries. Index on `conversation_id, created_at` for message retrieval.

### Dark Mode Architecture

- Use next-themes with `ThemeProvider`
- Store preference in localStorage (key: 'theme', value: 'light'|'dark'|'system')
- Inject blocking script in <head> to prevent flash
- Use CSS variables for colors: `--background`, `--text`, `--accent`
- Prefer dark grays (#121212) over pure black (#000000)
- Use off-whites (#E0E0E0) over pure white (#FFFFFF) for text in dark mode

### Web Search Implementation

**Follow Claude's pattern (better UX than ChatGPT):**

1. LLM calls search tool with query
2. Fetch results (Tavily, Brave Search, or Google Custom Search)
3. Return to LLM with `cited_text`, `title`, `url`
4. LLM incorporates with inline citations: "According to [Source Name](url), ..."
5. Render as clickable links at point of use (not footnotes)

**Note:** Citations don't count toward token usage (per Claude API docs)

### Voice Input Options

**Option 1: Web Speech API (Quick Start)**
- Pros: Native browser API, no additional cost, simple implementation
- Cons: Chrome/Edge only, requires internet, less accurate than OpenAI
- Use case: MVP, test user adoption

**Option 2: OpenAI Realtime API (Production Quality)**
- Pros: Cross-browser, high accuracy, low latency (~250ms)
- Cons: Additional API costs, more complex integration
- Use case: Post-MVP when voice input adoption validated

### Recommended Stack for These Features

| Feature | Library/Tool | Why |
|---------|--------------|-----|
| Streaming | Vercel AI SDK `useChat()` | Handles SSE, state management, error recovery out of the box |
| Markdown | `react-markdown` + `remark-gfm` | Standard, supports GitHub-flavored markdown |
| Syntax highlighting | `shiki` | Better themes, inline styles, lazy loading. Use `rehype-shiki` plugin |
| Code copy button | Custom component with `navigator.clipboard` | Simple, built-in API |
| Dark mode | `next-themes` | Prevents flash, handles system preference, localStorage persistence |
| Conversation state | React Context + Zustand | Context for current conversation, Zustand for sidebar list |
| Web search | Tavily API or Brave Search API | Purpose-built for AI, includes snippets and citations |
| Voice input | Web Speech API (MVP), OpenAI Realtime API (later) | Balance simplicity vs quality |

## Known Performance Pitfalls

### 1. Markdown Re-rendering During Streaming

**Problem:** react-markdown re-renders entire conversation on each token, exponentially worse as conversation grows.

**Solution:** Memoize completed message blocks. Only re-render actively streaming message.

```typescript
const MemoizedMessage = React.memo(({ content }) => (
  <ReactMarkdown>{content}</ReactMarkdown>
));

// In render:
{messages.map((msg, i) =>
  msg.isStreaming ?
    <ReactMarkdown>{msg.content}</ReactMarkdown> : // Re-renders
    <MemoizedMessage content={msg.content} key={i} /> // Cached
)}
```

### 2. Code Block Syntax Parsing on Each Token

**Problem:** Shiki/Prism re-parses code blocks on every token during streaming, even if code block is incomplete.

**Solution:** Defer syntax highlighting until code block closes. Show plain text during streaming, highlight when complete.

```typescript
const isCodeBlockComplete = content.match(/```[\s\S]*?```$/);
```

### 3. SSE Buffering in Next.js

**Problem:** Next.js waits for route handler to complete before sending Response, buffering entire stream.

**Solution:** Return Response immediately, stream in background using ReadableStream.

```typescript
const stream = new ReadableStream({
  async start(controller) {
    for await (const chunk of llmStream) {
      controller.enqueue(encoder.encode(chunk));
    }
    controller.close();
  }
});

return new Response(stream, {
  headers: { 'Content-Type': 'text/event-stream' }
});
// DON'T await stream completion here!
```

### 4. Sidebar Query on Every Render

**Problem:** Fetching conversation list from DB on every sidebar render causes unnecessary load.

**Solution:** Use TanStack Query (React Query) for caching + background updates.

```typescript
const { data: conversations } = useQuery({
  queryKey: ['conversations'],
  queryFn: fetchConversations,
  staleTime: 60000, // Cache for 1 minute
});
```

## Sources

### Conversation Management
- [ChatGPT Sidebar Redesign: New Features Explained](https://www.ai-toolbox.co/chatgpt-management-and-productivity/chatgpt-sidebar-redesign-guide)
- [ChatGPT — Release Notes | OpenAI Help Center](https://help.openai.com/en/articles/6825453-chatgpt-release-notes)
- [AI Chat with History: Why Persistent Memory Changes Everything](https://www.jenova.ai/en/resources/ai-chat-with-history)
- [Database design for storing chats - GeeksforGeeks](https://www.geeksforgeeks.org/dbms/how-to-design-a-database-for-messaging-systems/)

### Streaming Responses
- [Real-time AI in Next.js: How to stream responses with the Vercel AI SDK - LogRocket Blog](https://blog.logrocket.com/nextjs-vercel-ai-sdk-streaming/)
- [Using Server-Sent Events (SSE) to stream LLM responses in Next.js | Upstash Blog](https://upstash.com/blog/sse-streaming-llm-responses)
- [Fixing Slow SSE (Server-Sent Events) Streaming in Next.js and Vercel](https://medium.com/@oyetoketoby80/fixing-slow-sse-server-sent-events-streaming-in-next-js-and-vercel-99f42fbdb996)
- [Vercel AI SDK Complete Guide: Building Production-Ready AI Chat Apps with Next.js](https://dev.to/pockit_tools/vercel-ai-sdk-complete-guide-building-production-ready-ai-chat-apps-with-nextjs-4cp6)

### Web Search & Citations
- [Web search tool - Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)
- [Anthropic's Claude Can Search The Web, Closing Gap With ChatGPT](https://www.searchenginejournal.com/anthropic-claude-web-search/542639/)
- [Anthropic adds web search to its Claude chatbot | TechCrunch](https://techcrunch.com/2025/03/20/anthropic-adds-web-search-to-its-claude-chatbot/)

### Markdown & Code Rendering
- [Streamdown: Markdown Rendering Component Designed for AI Streaming Responses](https://www.kdjingpai.com/en/streamdown/)
- [Markdown Rendering with Syntax Highlighting Implementation | Tech Journey](https://hejoseph.com/dev/docs/Portfolio/Chatbot/markdown-display/)
- [Enhancing Your React-Markdown Experience with Syntax Highlighting](https://hannadrehman.com/blog/enhancing-your-react-markdown-experience-with-syntax-highlighting)
- [react-markdown GitHub](https://github.com/remarkjs/react-markdown)
- [Next.js: Markdown Chatbot with Memoization](https://ai-sdk.dev/cookbook/next/markdown-chatbot-with-memoization)

### Voice Input
- [Web Speech API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Introducing the Realtime API | OpenAI](https://openai.com/index/introducing-the-realtime-api/)
- [Voice AI in 2026: 9 numbers that signal what's next](https://www.speechmatics.com/company/articles-and-news/voice-ai-in-2026-9-numbers-that-signal-whats-next)
- [Conversational AI Trends 2026 | Enterprise Implementation](https://www.webmobinfo.ch/blog/conversational-ai-trends-to-watch-in-2026)

### Dark Mode
- [Next.js Dark Mode Implementation: Complete next-themes Guide](https://eastondev.com/blog/en/posts/dev/20251220-nextjs-dark-mode-guide/)
- [GitHub - pacocoursey/next-themes](https://github.com/pacocoursey/next-themes)
- [Dark Mode Design Best Practices in 2026](https://www.tech-rz.com/blog/dark-mode-design-best-practices-in-2026/)
- [Dark Mode Done Right: Best Practices for 2026](https://medium.com/@social_7132/dark-mode-done-right-best-practices-for-2026-c223a4b92417)

### AI Personalization & Memory
- [AI Trends for 2026 - Artificial Ignorance](https://www.ignorance.ai/p/ai-trends-for-2026)
- [The CX Leader's Guide to AI Memory: Personalization, Retention, and Next-Gen Chatbots](https://www.useinvent.com/blog/the-cx-leader-s-guide-to-ai-memory-personalization-retention-and-next-gen-chatbots)
- [Introducing AI assistants with memory - Perplexity](https://www.perplexity.ai/hub/blog/introducing-ai-assistants-with-memory)
- [ChatGPT New Features (2025): GPT-5, Memory, Agents & Major Updates](https://mindliftly.com/future-of-chatgpt-2025-2026-roadmap-gpt-5-next-ai-trends/)

### Anti-Patterns
- [Anti-Patterns in Corporate AI Adoption](https://www.teamform.co/blogs/anti-patterns-in-corporate-ai-adoption-lessons-from-real-world-experiences)
- [Anti-patterns that cause problems for AI implementation](https://mindtitan.com/resources/blog/ai-implementation/)

### State Management & Libraries
- [React Query as a State Manager in Next.js](https://geekyants.com/blog/react-query-as-a-state-manager-in-nextjs-do-you-still-need-redux-or-zustand)
- [TanStack Query with Next.js](https://tanstack.com/query/latest/docs/framework/react/examples/nextjs)

---
*Feature research for: AI Chat Applications - Full Chat Experience (SoulPrint)*
*Researched: 2026-02-08*
