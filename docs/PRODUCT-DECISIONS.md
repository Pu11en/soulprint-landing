# SoulPrint Product Decisions

*Last updated: Jan 30, 2026*

This document captures key product decisions for SoulPrint. Reference this before building new features.

---

## Core Architecture

### Memory System
- **RLM Service** is primary for all chat (not optional)
- **Bedrock** is fallback only when RLM fails
- **Perplexity** for web search (user-triggered via toggle)
- **Tavily** as backup if Perplexity fails

### Import & Processing
- **No file size limits** — client-side processing handles any ZIP size
- **Recent conversations first** — prioritize last 30 days during import
- **Progressive loading** — user can chat while older memories still processing
- **User sees progress** — clear indication of what's happening during import

---

## User Experience

### First-Time Users
- **Must provide ChatGPT history** — this creates their SoulPrint
- Cannot use app without import (SoulPrint = the product)

### Chat Experience  
- **Web Search toggle** — user controls when to search (not AI-decided)
- **Chat while processing** — don't block user during embedding

### Data & Privacy
- **30-day retention** — data purged if user doesn't return for 30 days
- **User can delete anytime** — immediate removal on request
- **Client-side processing** — raw conversation text never leaves browser

---

## Abuse & Limits

### Rate Limiting (Light)
- Basic protection against scripted abuse
- Don't punish normal heavy users

### No Size Limits
- Accept any ChatGPT export size
- Client-side processing means server isn't bottleneck

---

## Monitoring & Ops

### Health Checks (every 15 min)
- RLM Service: `/health` endpoint
- SoulPrint site: 200 OK check
- Perplexity: API key validation

### Alerts
- Telegram notification if any service goes down
- Admin dashboard at `/admin`

---

## Technical Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend | Next.js 15, React 19 | Web app |
| Database | Supabase (PostgreSQL + pgvector) | Users, memories, embeddings |
| LLM | AWS Bedrock (Claude 3.5 Haiku) | Response generation |
| Memory Service | RLM (Python/FastAPI on Render) | Vector search + retrieval |
| Web Search | Perplexity API (primary), Tavily (backup) | Real-time info |
| Embeddings | OpenAI text-embedding-3-small | Semantic search |
| Auth | Supabase Auth (Google, Email) | User authentication |

---

## Open Questions

- [ ] Pricing model?
- [ ] Free tier limits?
- [ ] Team/business features?

---

## Change Log

| Date | Decision | Context |
|------|----------|---------|
| 2026-01-30 | No file size limits | Client-side processing handles it |
| 2026-01-30 | 30-day data purge for inactive users | Balance storage vs user experience |
| 2026-01-30 | Web search is user-triggered only | Cost control, predictable behavior |
| 2026-01-30 | Light abuse protection | Don't over-engineer, iterate later |
| 2026-01-30 | Recent memory prioritized | Last 30 days processed first for quick start |
