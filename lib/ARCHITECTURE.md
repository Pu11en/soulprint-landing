# SoulPrint `/lib` Architecture

## Overview

The `lib/` directory contains the core logic for SoulPrint's AI personalization engine. It handles data import, memory management, real-time search, and user engagement systems.

```
lib/
├── import/           # ChatGPT export → SoulPrint pipeline
├── memory/           # RAG memory system (query, facts, learning)
├── search/           # Real-time web search (Perplexity, Tavily)
├── supabase/         # Database client patterns
├── gamification/     # XP & achievement system
├── versioning/       # File branching system
├── email.ts          # Email notifications
└── utils.ts          # Tailwind merge utility
```

---

## 1. Import Pipeline

**Flow:** ZIP Upload → Parse → Chunk → Embed → Store

```
┌─────────────────────────────────────────────────────────────────────┐
│                        IMPORT PIPELINE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ChatGPT ZIP                                                        │
│      │                                                              │
│      ▼                                                              │
│  ┌─────────┐   conversations.json    ┌─────────────┐               │
│  │ parser  │ ──────────────────────▶ │ Parsed      │               │
│  │ .ts     │   Tree traversal        │ Conversation│               │
│  └─────────┘                         └─────────────┘               │
│                                             │                       │
│                                             ▼                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    chunker.ts                               │   │
│  │  5-Layer RLM (Retrieval-Layered Memory):                    │   │
│  │  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐         │   │
│  │  │Micro  │ │Flow   │ │Theme  │ │Narrat │ │Macro  │         │   │
│  │  │200chr │ │500chr │ │1000chr│ │2000chr│ │5000chr│         │   │
│  │  │Layer 1│ │Layer 2│ │Layer 3│ │Layer 4│ │Layer 5│         │   │
│  │  └───────┘ └───────┘ └───────┘ └───────┘ └───────┘         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                             │                       │
│                                             ▼                       │
│  ┌─────────────┐    Cohere Embed v3    ┌─────────────────────┐     │
│  │ embedder.ts │ ───────────────────▶  │ conversation_chunks │     │
│  │ (Bedrock)   │    96 texts/batch     │ (Supabase + pgvector)│    │
│  └─────────────┘                       └─────────────────────┘     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `parser.ts` | Parses ChatGPT's tree-structured `conversations.json` via JSZip |
| `chunker.ts` | 5-layer hierarchical chunking for RLM (200→5000 char tiers) |
| `embedder.ts` | Cohere Embed v3 via Bedrock; batch processing (96/batch) |
| `soulprint.ts` | Server-side personality extraction with Claude (LLM synthesis) |
| `client-soulprint.ts` | Browser-side fast analysis (no server upload) |
| `personality-analysis.ts` | Deep RLM profile: identity, soul, rhythm, emotional patterns |

### SoulPrint Generation

Two paths:

1. **Quick Soulprint** (`generateQuickSoulprint`) - Pattern matching:
   - Analyzes writing style, emoji usage, formality
   - Extracts interests, facts, relationships via regex
   - Generates AI persona (SOUL.md) for chat personalization

2. **LLM Soulprint** (`generateLLMSoulprint`) - Claude analysis:
   - Batches 300 conversations → Claude 3.5 Haiku
   - Extracts comprehensive profile (identity, professional, beliefs, etc.)
   - Merges batch results with deduplication

---

## 2. Memory System

**Purpose:** Hierarchical RAG for personalized chat responses

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MEMORY SYSTEM                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User Query                                                         │
│      │                                                              │
│      ▼                                                              │
│  ┌───────────────┐                                                  │
│  │ embedQuery()  │  Cohere v3 (input_type: search_query)           │
│  └───────────────┘                                                  │
│          │                                                          │
│          ▼                                                          │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │              getMemoryContext() - Hierarchical Search          │ │
│  │                                                                 │ │
│  │  1. MACRO (Layer 5)  →  2 chunks, 0.25 threshold               │ │
│  │  2. THEMATIC (Layer 3) → 3 chunks, 0.35 threshold              │ │
│  │  3. MICRO (Layer 1)  →  4 chunks, 0.45 threshold               │ │
│  │  4. Fallback (all layers) if < 3 chunks found                  │ │
│  │                                                                 │ │
│  │  + searchLearnedFacts() → 10 facts, 0.4 threshold              │ │
│  └───────────────────────────────────────────────────────────────┘ │
│          │                                                          │
│          ▼                                                          │
│  ┌───────────────┐                                                  │
│  │ Context Text  │  Formatted: [MACRO] → [THEME] → [MICRO]        │
│  │ + Facts       │  Learned facts prepended                        │
│  └───────────────┘                                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `query.ts` | Vector search with layer filtering, fallback to keyword search |
| `facts.ts` | Extract durable facts from chunks via Claude |
| `learning.ts` | Learn new facts from chat exchanges, store with embeddings |

### Fact Categories

```typescript
type FactCategory = 
  | 'preferences'   // Likes, dislikes, favorites
  | 'relationships' // People mentioned
  | 'milestones'    // Life events, achievements
  | 'beliefs'       // Values, opinions
  | 'decisions'     // Choices, plans
  | 'events'        // Recent/upcoming events
```

### Learning Loop

```
Chat Exchange → extractFactsFromChat() → storeLearnedFacts()
                      ↓
              Claude extracts facts
              (confidence ≥ 0.7)
                      ↓
              embedBatch() + insert to learned_facts table
```

---

## 3. Search Integrations

**Purpose:** Augment LLM with real-time information

```
┌─────────────────────────────────────────────────────────────────────┐
│                      SEARCH INTEGRATIONS                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────┐    ┌──────────────────────────┐      │
│  │       Perplexity         │    │         Tavily           │      │
│  │      (Primary)           │    │       (Backup)           │      │
│  ├──────────────────────────┤    ├──────────────────────────┤      │
│  │ Models:                  │    │ Modes:                   │      │
│  │ • sonar (fast, 10s)      │    │ • basic                  │      │
│  │ • sonar-deep-research    │    │ • advanced               │      │
│  │   (30s, comprehensive)   │    │                          │      │
│  ├──────────────────────────┤    ├──────────────────────────┤      │
│  │ Returns:                 │    │ Returns:                 │      │
│  │ • answer                 │    │ • results[]              │      │
│  │ • citations[]            │    │ • answer (optional)      │      │
│  └──────────────────────────┘    └──────────────────────────┘      │
│                                                                     │
│  Decision Logic (needsRealtimeInfo):                               │
│  ─────────────────────────────────────                             │
│  SKIP: < 10 chars, memory questions, greetings,                    │
│        code generation, opinion questions                          │
│  USE:  news/current events, prices/data, factual questions,        │
│        proper nouns, year references (2024+), questions (?)        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `perplexity.ts` | Real-time search with citations; aggressive decision logic |
| `tavily.ts` | Web search backup with @tavily/core client |

---

## 4. Database Patterns

**Stack:** Supabase + pgvector

```
┌─────────────────────────────────────────────────────────────────────┐
│                       SUPABASE PATTERNS                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Client Types:                                                      │
│  ─────────────                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │  client.ts      │  │  server.ts      │  │  Admin Client   │     │
│  │  (Browser)      │  │  (SSR/Actions)  │  │  (Service Role) │     │
│  │  createBrowser  │  │  cookies-based  │  │  No cookies     │     │
│  │  Client()       │  │  w/ 30-day TTL  │  │  Full access    │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                     │
│  Key Tables:                                                        │
│  ────────────                                                       │
│  • conversation_chunks  (content, embedding, layer_index)          │
│  • learned_facts        (fact, category, embedding, status)        │
│  • user_stats           (xp, level, streak, achievements)          │
│                                                                     │
│  RPC Functions:                                                     │
│  ──────────────                                                     │
│  • match_conversation_chunks_layered(embedding, user, layer)       │
│  • match_learned_facts(embedding, user, threshold)                 │
│                                                                     │
│  Cookie Options (Safari fix):                                       │
│  ─────────────────────────────                                      │
│  { maxAge: 30 days, sameSite: 'lax', secure: production }          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `client.ts` | Browser client with cookie persistence |
| `server.ts` | SSR client with cookie read/write |
| `middleware.ts` | Token refresh on each request |

---

## 5. Supporting Systems

### Gamification (`gamification/xp.ts`)

```typescript
// XP Actions
message_sent:    10 XP
memory_created:  25 XP
daily_login:     15 XP
streak_bonus:    5 × streak_day

// Level formula
threshold(level) = level × 100 × (1 + level × 0.1)
```

**Rarities:** common → uncommon → rare → epic → legendary (with color mappings)

### Versioning (`versioning/branch-manager.ts`)

Git-like branching for user edits:

```
branches/
└── branch_1_username/
    └── [copied files]
```

Methods: `createBranch()`, `writeToFile()`, `mergeBranch()`, `deleteBranch()`

---

## Data Flow Summary

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  ZIP Upload │ → │  Parse/     │ → │  Embed      │ → │  Supabase   │
│             │    │  Chunk (RLM)│    │  (Cohere)   │    │  pgvector   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                ↓
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Chat UI    │ ← │  Response   │ ← │  Claude +   │ ← │  Memory     │
│             │    │             │    │  Context    │    │  Retrieval  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       ↓                                    ↑
┌─────────────┐                      ┌─────────────┐
│  User Msg   │ ───────────────────→ │  Perplexity │
│             │    (if real-time)    │  Search     │
└─────────────┘                      └─────────────┘
       ↓
┌─────────────┐    ┌─────────────┐
│  Learning   │ → │  Store New  │
│  Extract    │    │  Facts      │
└─────────────┘    └─────────────┘
```

---

## Key Technologies

| Component | Technology |
|-----------|------------|
| Embeddings | AWS Bedrock → Cohere Embed v3 |
| LLM | AWS Bedrock → Claude 3.5 Haiku |
| Vector DB | Supabase + pgvector |
| ZIP Parsing | JSZip |
| Search | Perplexity API, Tavily API |
| Auth | Supabase SSR (@supabase/ssr) |
