# SoulPrint Dev Map
*Generated 2026-01-30*

## 🎯 What Is This?

**SoulPrint** — Import your ChatGPT history, get an AI that actually knows you.

---

## 🏗️ Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 15 (App Router) |
| UI | Tailwind + Framer Motion |
| Auth | Supabase Auth |
| Database | Supabase (Postgres + pgvector) |
| LLM | Claude 3.5 Haiku via AWS Bedrock |
| Embeddings | OpenAI text-embedding-3-small |
| Search | Perplexity (primary), Tavily (fallback) |
| Storage | Supabase Storage, Cloudinary |
| Hosting | Vercel |

---

## 🔄 User Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      LANDING (/)                            │
│  "Enter" → Access Code Modal → Auth Modal (signup/login)    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     IMPORT (/import)                        │
│  1. Export guide    2. Upload ZIP    3. Processing    4. Done│
│                                                              │
│  Desktop: Extract conversations.json client-side (faster)   │
│  Mobile: Upload full ZIP to Supabase Storage                │
│                                                              │
│  ⚡ Two-phase processing:                                   │
│     • Quick soulprint (~30s) → user can chat immediately    │
│     • Background embeddings → full memory builds over time  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                       CHAT (/chat)                          │
│  • AI naming flow on first visit                            │
│  • Streaming responses (SSE)                                │
│  • Memory-augmented context injection                       │
│  • Deep Search mode (web search integration)                │
│  • Voice input with owner verification                      │
│  • "Still learning..." indicator while embeddings process   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
app/
├── page.tsx                 # Landing hero
├── enter/page.tsx           # Access code gate
├── login/page.tsx           # → redirect to /
├── signup/page.tsx          # → redirect to /
├── import/page.tsx          # Import wizard (4 steps)
├── chat/page.tsx            # Main chat interface
├── dashboard/page.tsx       # User hub
├── memory/page.tsx          # Memory viewer/manager
├── achievements/page.tsx    # Gamification
├── admin/page.tsx           # Admin tools
└── api/
    ├── chat/               # 4 routes - streaming chat
    ├── import/             # 18 routes - import pipeline
    ├── memory/             # 5 routes - vector search
    ├── embeddings/         # 1 route - embedding processor
    ├── gamification/       # 4 routes - XP/achievements
    ├── voice/              # 3 routes - voice verification
    ├── profile/            # 2 routes - AI name/avatar
    ├── admin/              # 8 routes - admin tools
    ├── cron/               # 2 routes - scheduled tasks
    └── waitlist/           # 2 routes - waitlist flow

components/
├── auth/                   # Auth modals & forms
├── chat/                   # Chat UI components
├── sections/               # Landing page sections
└── ui/                     # Primitives (button, card, etc.)

lib/
├── supabase/               # Client/server/admin clients
├── import/                 # Parser, chunker, embedder, soulprint
├── memory/                 # Query, facts, learning
├── search/                 # Perplexity, Tavily
├── gamification/           # XP, levels, achievements
└── versioning/             # File branching system
```

---

## 🧠 Memory System (RLM)

### Import Pipeline
```
ZIP File
    ↓
parser.ts        → Extract conversations from ZIP
    ↓
chunker.ts       → 5-layer chunking (200→5000 chars)
    ↓
soulprint.ts     → Quick soulprint via regex OR Claude batches
    ↓
embedder.ts      → Cohere Embed v3 via Bedrock (96/batch)
    ↓
conversation_chunks table (with vectors)
```

### Memory Query (Chat Time)
```
User message
    ↓
OpenAI embedding
    ↓
Hierarchical vector search:
  • Macro (5000 char) → broad context
  • Theme (2000 char) → topic relevance  
  • Micro (200 char)  → precise facts
    ↓
Top-k chunks + learned facts
    ↓
Context injection → Claude
    ↓
Response + fact extraction → learned_facts table
```

### Continuous Learning
- Every chat exchange is analyzed for durable facts
- Facts stored with embeddings in `learned_facts`
- Periodic synthesis updates `soulprint_text`

---

## 🗄️ Database Tables

| Table | Purpose |
|-------|---------|
| `user_profiles` | Soulprint, import status, embedding progress |
| `conversation_chunks` | Chunked conversations with vectors |
| `raw_conversations` | Full conversation history (JSON) |
| `learned_facts` | Facts extracted from chat |
| `chat_messages` | Chat history |
| `user_stats` | XP, level, streak |
| `achievements` | Unlocked achievements |
| `tasks` | Scheduled reminders/tasks |

### Key RPC Functions
- `match_conversation_chunks_layered` — Multi-layer vector search
- `match_learned_facts` — Fact retrieval by similarity

---

## ⚡ API Quick Reference

### Chat
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/chat` | POST | Streaming chat with memory |
| `/api/chat/messages` | GET/POST | Load/save history |

### Import
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/import/get-upload-url` | POST | Signed upload URL |
| `/api/import/queue-processing` | POST | Start background processing |
| `/api/import/process-server` | POST | Main processing (5 min) |
| `/api/import/embed-background` | POST | Generate embeddings |
| `/api/import/create-soulprint` | POST | Generate soulprint |

### Memory
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/memory/query` | POST | Vector search |
| `/api/memory/status` | GET | Import/embedding progress |
| `/api/memory/list` | GET | Paginated memories |
| `/api/memory/delete` | DELETE | Remove memories |
| `/api/memory/synthesize` | POST | Update soulprint from facts |

### Profile
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/profile/ai-name` | GET/POST | AI name management |
| `/api/profile/ai-avatar` | POST | Avatar upload |

---

## 🎨 Design System

| Element | Value |
|---------|-------|
| Primary | `#EA580C` (orange-600) |
| Background | `#0a0a0a` / `#0e0e0e` |
| Card BG | `white/[0.03]` + `border-white/[0.06]` |
| Font (headers) | Koulen (uppercase) |
| Font (body) | System |

### Mobile Patterns
- `min-h-[100dvh]` for iOS safe height
- `safe-area-inset-*` for notch padding
- `min-h-[44px]` touch targets
- Swipeable message interactions

---

## 🔧 External Services

| Service | Purpose | Config |
|---------|---------|--------|
| Supabase | Auth, DB, Storage | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| AWS Bedrock | Claude 3.5 Haiku | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` |
| OpenAI | Embeddings, Whisper | `OPENAI_API_KEY` |
| Perplexity | Web search | `PERPLEXITY_API_KEY` |
| Tavily | Backup search | `TAVILY_API_KEY` |
| Cloudinary | Image uploads | `CLOUDINARY_*` |

---

## 📊 File Counts

- **Pages:** 15
- **API Routes:** 50
- **Components:** 40+
- **Lib Modules:** 12

---

## 🚀 Running Locally

```bash
git clone https://github.com/Pu11en/soulprint-landing.git
cd soulprint-landing
npm install
cp .env.example .env.local  # Fill in keys
npm run dev
```

Build:
```bash
npm run build  # Must pass before deploy
```

---

## 📝 Known Issues / TODOs

From `SCHEMA-ANALYSIS.md`:
- [ ] Run migrations on production Supabase
- [ ] Add `locked_at` timestamp when locking soulprint
- [ ] Race condition protection (add 'importing' status)

Dead code to remove:
- `lib/import/embedder.ts` (old Titan system)
- `app/api/import/process/route.ts`
- `scripts/generate-embeddings.ts`
