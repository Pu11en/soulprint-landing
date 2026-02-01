# CLAUDE.md - SoulPrint Development Context

## Project Overview
SoulPrint is a privacy-first AI personalization platform. Users upload their ChatGPT export, we analyze it to create a "SoulPrint" (personality profile), and they get a personalized AI assistant.

## Current Task: Rebuild Import Flow with RLM

### Requirements
1. **RLM-only** - Use our RLM service for everything (no OpenAI for soulprint generation)
2. **Immediate chunking** - Start processing right after upload
3. **Block chat until ready** - User cannot chat until processing complete
4. **Multi-tier chunking** - Different sizes for different retrieval needs
5. **Email notification** - Send email when ready

### Architecture

```
User uploads ZIP
       ↓
Extract conversations.json
       ↓
Store original (gzip) → Supabase Storage (user-exports bucket)
       ↓
Create multi-tier chunks:
  - Tier 1: 100 chars (facts, names, dates)
  - Tier 2: 500 chars (context, topics)
  - Tier 3: 2000 chars (full conversation flow)
       ↓
Send chunks to RLM for embedding
       ↓
RLM generates soulprint from chunks
       ↓
Save to DB:
  - user_profiles.soulprint_text
  - user_profiles.import_status = 'complete'
  - conversation_chunks (all tiers)
       ↓
Send email notification
       ↓
User can now access /chat

```

### Key Files

**Import Flow:**
- `app/import/page.tsx` - Frontend upload UI
- `app/api/import/process/route.ts` - Main import processor
- `app/api/import/upload-raw/route.ts` - Raw JSON storage
- `lib/import/client-soulprint.ts` - Client-side parsing

**RLM Service:**
- URL: `https://soulprint-landing.onrender.com`
- Endpoints:
  - `POST /create-soulprint` - Generate soulprint from conversations
  - `POST /query` - Query with memory context
  - `GET /health` - Health check

**Database (Supabase):**
- `user_profiles` - User data, soulprint, import status
- `conversation_chunks` - Searchable memory chunks

**Email:**
- `lib/email/send.ts` - Resend integration (needs RESEND_API_KEY)

### Multi-Tier Chunking Strategy

```typescript
// Tier 1: Ultra-precise (100 chars)
// For: "What is X?", names, dates, facts
// Example: "User: What's RoboNuggets? Assistant: RoboNuggets is your crypto portfolio tracker..."

// Tier 2: Context (500 chars)  
// For: Topic understanding, preferences
// Example: Full Q&A exchange about a topic

// Tier 3: Flow (2000 chars)
// For: Complex questions needing conversation context
// Example: Multi-turn conversation about a project
```

### Import Status Flow

```
import_status values:
- 'none' → No import started
- 'processing' → Chunking/embedding in progress
- 'complete' → Ready to chat
- 'failed' → Error occurred (check import_error)
```

### Chat Blocking Logic

In `app/chat/page.tsx`, check `import_status`:
- If 'none' → Redirect to /import
- If 'processing' → Show "Still processing..." screen
- If 'complete' → Allow chat
- If 'failed' → Show error, allow re-import

### Environment Variables Needed

```
NEXT_PUBLIC_SUPABASE_URL=https://swvljsixpvvcirjmflze.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
RLM_SERVICE_URL=https://soulprint-landing.onrender.com
RESEND_API_KEY=... (for email notifications)
OPENAI_API_KEY=... (for embeddings only, not soulprint)
```

### Commands

```bash
# Dev server
npm run dev

# Build
npm run build

# Deploy (auto via git push)
git push origin main
```

### What NOT to Change
- Supabase schema (already set up)
- RLM service (external, just call it)
- Auth flow (working)

### What TO Change
1. `app/api/import/process/route.ts` - Use RLM, multi-tier chunks
2. `app/import/page.tsx` - Better progress UI
3. `app/chat/page.tsx` - Block if not ready
4. `lib/email/send.ts` - Trigger on completion
