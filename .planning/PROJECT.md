# SoulPrint

## What This Is

AI companion that actually remembers you. Users import their ChatGPT history, and SoulPrint learns their communication style, preferences, and context to provide truly personalized conversations. Mobile-first, works on any device.

## Core Value

**Import your history → Get an AI that knows you.** The import-to-chat flow must work flawlessly on mobile.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Mobile upload flow works end-to-end (ZIP → processing → chat)
- [ ] Soulprint generated from imported conversations
- [ ] Chat with memory-enhanced responses
- [ ] User can see their import progress
- [ ] Clean, mobile-responsive UI

### Out of Scope

- Desktop-only features — mobile first
- Multiple AI providers — Claude/Bedrock only for now
- Voice features — text chat only for MVP
- Social/sharing — single user experience

## Context

**Tech Stack:**
- Next.js 14 (App Router)
- Supabase (Auth, DB, Storage)
- OpenAI embeddings (text-embedding-3-small)
- Claude/Bedrock for chat
- Vercel deployment

**Current State:**
- Database cleaned: 12 tables (was 29)
- Storage bucket: accepts ZIP, JSON, any MIME type
- Build passing on Vercel
- Import flow: upload → process-server → chunks → embeddings (cron)

**Known Issues:**
- Mobile MIME types vary wildly (fixed by removing restriction)
- Large files (>500MB) hit Vercel memory limits
- Embedding cron needs monitoring

## Constraints

- **Vercel**: 5 min function timeout, ~500MB memory practical limit
- **Mobile**: Must work on iOS Safari, Android Chrome
- **File Size**: ChatGPT exports can be 1-10GB, need chunked processing
- **Cost**: OpenAI embeddings at scale = $$, batch efficiently

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Client-side upload to Supabase | Bypass Vercel 4.5MB limit | ✓ Good |
| Server-side ZIP processing | Mobile browsers crash on large JSZip | ✓ Good |
| Embeddings via cron job | Don't block import flow | — Pending |
| Remove MIME restrictions | Mobile sends application/octet-stream | ✓ Good |
| 12-table schema | Was 29, removed duplicates | ✓ Good |

---
*Last updated: 2026-01-30 after database cleanup*
