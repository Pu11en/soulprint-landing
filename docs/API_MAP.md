# SoulPrint API Map

## Overview

SoulPrint's API is organized into 11 domains. The main data flow is:

```
User Upload → Quick Soulprint → Background Embedding → Chat with Memory
```

---

## 🗨️ Chat

Core conversational AI with memory-augmented responses.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/chat` | POST | Main chat endpoint - queries RLM for memory context, falls back to Bedrock with optional web search |
| `/api/chat/messages` | GET/POST | Load/save chat history to Supabase |
| `/api/chat/health` | GET | Health check for chat service |
| `/api/chat/perplexity-health` | GET | Health check for Perplexity integration |

**External Services:** AWS Bedrock (Claude 3.5 Haiku), Perplexity (Sonar), Tavily, RLM Service, Supabase

---

## 📥 Import

Two-phase import pipeline: quick soulprint (~30s) + background embeddings.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/import/upload` | POST | Triggers import after file upload to Supabase Storage |
| `/api/import/quick` | POST | Phase 1: Generates instant soulprint from ChatGPT export, fires background embed |
| `/api/import/process` | GET/POST | Phase 2: Full processing - downloads from R2, chunks, embeds, stores |
| `/api/import/process-background` | POST | Background embedding trigger |
| `/api/import/upload-chunk` | POST | Chunked upload for large files |
| `/api/import/upload-raw` | POST | Raw file upload endpoint |
| `/api/import/upload-proxy` | POST | Proxy for client-side uploads |
| `/api/import/get-upload-url` | POST | Get pre-signed URL for direct upload |
| `/api/import/save-chunks` | POST | Store conversation chunks to DB |
| `/api/import/save-raw` | POST | Store raw conversation data |
| `/api/import/save-soulprint` | POST | Save generated soulprint to profile |
| `/api/import/create-soulprint` | POST | Generate soulprint from parsed data |
| `/api/import/embed-all` | POST | Embed all chunks for a user |
| `/api/import/embed-background` | POST | Background embedding processor |
| `/api/import/mark-pending` | POST | Mark chunks as pending for embedding |
| `/api/import/queue-processing` | POST | Queue processing job |
| `/api/import/analyze-personality` | POST | Extract personality traits from conversations |
| `/api/import/analyze-deep` | POST | Deep analysis of conversation patterns |
| `/api/import/process-server` | POST | Server-side processing endpoint |

**External Services:** Supabase Storage (R2), OpenAI (embeddings), AWS Bedrock (LLM soulprint generation)

---

## 🧠 Memory

Vector search and memory synthesis for personalized AI.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/memory/query` | POST | Search memory with layered vector search, optional fact extraction |
| `/api/memory/list` | GET | Paginated list of user's memory chunks with search |
| `/api/memory/status` | GET | Check memory/embedding status for user |
| `/api/memory/delete` | DELETE | Remove specific memories |
| `/api/memory/synthesize` | GET/POST | Synthesize learned facts into updated soulprint (cron-able) |

**External Services:** Supabase (pgvector), AWS Bedrock (synthesis)

---

## 📊 Embeddings

Background embedding processor for conversation chunks.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/embeddings/process` | GET/POST | Batch embed chunks using OpenAI text-embedding-3-small |

**External Services:** OpenAI (text-embedding-3-small)

---

## 🎮 Gamification

XP, achievements, and engagement tracking.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/gamification/xp` | POST | Award XP for actions (message, memory, daily login) |
| `/api/gamification/stats` | GET | Get user stats (level, streak, XP) |
| `/api/gamification/achievements` | GET | List all achievements |
| `/api/gamification/achievements/notify` | POST | Mark achievements as notified |

**External Services:** Supabase

---

## 🎤 Voice

Voice enrollment and verification for owner authentication.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/voice/enroll` | GET/POST | Enroll/check voice fingerprint |
| `/api/voice/verify` | POST | Verify voice matches enrolled fingerprint |
| `/api/transcribe` | POST | Transcribe audio via OpenAI Whisper, includes voice verification |

**External Services:** OpenAI (Whisper)

---

## 👤 Profile

User profile and AI customization.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/profile/ai-name` | GET/POST | Get/set custom AI name |
| `/api/profile/ai-avatar` | GET/POST | Get/set AI avatar |

**External Services:** Supabase

---

## 🔐 Auth

Authentication endpoints.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/signout` | POST | Sign out user |

**External Services:** Supabase Auth

---

## 📧 Waitlist

Email confirmation flow for waitlist signups.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/waitlist` | POST | Submit email for waitlist (sends confirmation) |
| `/api/waitlist/confirm` | GET | Confirm email from link |

**External Services:** Email service (Resend/SendGrid)

---

## ⏰ Cron / Tasks

Scheduled tasks and recurring automations.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/tasks` | GET/POST/DELETE | CRUD for user's recurring tasks |
| `/api/cron/tasks` | GET | Vercel Cron endpoint - processes due tasks, fetches real-time content |

**External Services:** Perplexity (Sonar), Tavily, Email service

---

## 🛠️ Admin

Admin-only endpoints for platform management.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/admin/metrics` | GET | Dashboard metrics (users, messages, performance) |
| `/api/admin/reset-user` | GET/POST/DELETE | List users, get status, or reset user data |
| `/api/admin/rechunk` | POST | Re-chunk all conversations with multi-layer strategy |
| `/api/admin/migrate` | POST | Database migration endpoint |
| `/api/admin/migrate-gamification` | POST | Gamification schema migration |
| `/api/admin/rlm-status` | GET | RLM service status |
| `/api/admin/health` | GET | Admin health check |
| `/api/admin/referrals` | GET | Referral program stats |

**Access:** Restricted to admin emails (drew@archeforge.com, drewspatterson@gmail.com)

---

## 🔧 Utility / Debug

Misc utility endpoints.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/branch` | GET/POST | File versioning for user edits (branching system) |
| `/api/health/supabase` | GET | Supabase connection health |
| `/api/rlm/health` | GET | RLM service health check |
| `/api/test-r2` | GET | Test R2 storage connection |
| `/api/test-upload` | POST | Test upload endpoint |
| `/api/debug/test-import` | POST | Debug import flow |

---

## External Service Integrations

| Service | Usage |
|---------|-------|
| **Supabase** | Auth, Database (pgvector), Storage (R2) |
| **AWS Bedrock** | Claude 3.5 Haiku for chat & soulprint generation |
| **OpenAI** | Whisper (transcription), text-embedding-3-small |
| **Perplexity** | Sonar model for real-time web search |
| **Tavily** | Web search fallback |
| **RLM Service** | Custom memory retrieval + response generation |
| **Email** | Resend/SendGrid for transactional emails |

---

## Main Data Flows

### 1. Import Flow
```
User Upload (ZIP)
    ↓
Supabase Storage
    ↓
/api/import/upload (triggers)
    ↓
/api/import/quick (Phase 1: ~30s)
    ├── Parse conversations.json
    ├── Store raw_conversations
    ├── Generate LLM soulprint
    ├── Update user_profiles
    └── Trigger background job
            ↓
/api/import/process (Phase 2: minutes-hours)
    ├── Chunk conversations (multi-layer)
    ├── Embed via OpenAI
    └── Store with vectors
```

### 2. Chat Flow
```
User Message
    ↓
/api/chat
    ├── Get user profile & soulprint
    ├── Search memories (if soulprint exists)
    ├── Optional: Web search (Perplexity/Tavily)
    ↓
Try RLM Service → Success? → Return
    ↓ (Fallback)
AWS Bedrock (Claude 3.5 Haiku)
    ├── Build prompt with memory context
    └── Generate response
    ↓
Learn from chat (async)
    ↓
Stream response (SSE)
```

### 3. Memory Learning
```
Chat Conversation
    ↓
/lib/memory/learning.ts
    ├── Extract facts from exchange
    ├── Store in learned_facts
    ↓
/api/memory/synthesize (cron or manual)
    ├── Get new facts since last synthesis
    ├── LLM: Integrate into soulprint
    └── Update user_profiles.soulprint_text
```
