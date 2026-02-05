# Technical Context

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Vercel    │────▶│  Supabase   │────▶│   Render    │
│  (Next.js)  │     │ (Postgres)  │     │   (RLM)     │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │
      │                   │                   │
      ▼                   ▼                   ▼
   Frontend          Database           AI/Embeddings
   + API Routes      + Auth             (Bedrock)
                     + Storage
```

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | Next.js 16, React 19 | App Router, Server Components |
| Styling | Tailwind CSS | Custom glass utilities |
| Database | Supabase Postgres | + pgvector for embeddings |
| Auth | Supabase Auth | Email + Google OAuth |
| Storage | Supabase Storage | Raw export backups |
| AI | AWS Bedrock | Claude for chat, embeddings |
| Images | Cloudinary | Avatar storage |
| Email | Resend | Notifications |
| Hosting | Vercel | Auto-deploy from GitHub |
| Domain | soulprintengine.ai | Production URL |
| RLM | Render | Python service for Bedrock |

## Key Patterns

### Client-Side Import
```typescript
// User's browser does all parsing - no upload needed
const zip = await JSZip.loadAsync(file);
const conversations = await parseConversations(zip);
// Only metadata + chunks sent to server
```

**Why**: Handles 10GB+ exports without upload limits or timeouts.

### Multi-Tier Chunking
```typescript
// Tier 1: 100 chars - facts, names, dates
// Tier 2: 500 chars - topic context
// Tier 3: 2000 chars - full conversation flow
const chunks = createMultiTierChunks(conversation);
```

**Why**: Different granularities serve different query types.

### Memory Query Flow
```typescript
// 1. User message → embedding
// 2. Semantic search on chunks
// 3. Top-k results → system prompt
// 4. Claude responds with context
```

### Streaming Responses
```typescript
// Server-Sent Events for real-time chat
const stream = await getRLMStream(message, context);
return new Response(stream, {
  headers: { 'Content-Type': 'text/event-stream' }
});
```

## Database Schema

### user_profiles
- `id`, `user_id` (FK to auth.users)
- `ai_name`, `ai_avatar_url`
- `soulprint_text` - generated personality
- `import_status` - none/processing/complete/failed
- `soul_md`, `identity_md`, `agents_md`, `user_md`
- Timestamps and counters

### conversation_chunks
- `id`, `user_id`
- `content` - chunk text
- `embedding` - vector(1536)
- `tier` - 1/2/3
- `metadata` - source info

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://swvljsixpvvcirjmflze.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

# RLM
RLM_SERVICE_URL=https://soulprint-landing.onrender.com

# External
RESEND_API_KEY=...
CLOUDINARY_CLOUD_NAME=djg0pqts6
CLOUDINARY_API_KEY=136843289897238
CLOUDINARY_API_SECRET=...
```

## API Route Patterns

### Error Handling
```typescript
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Business logic
    const result = await doWork();
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[RouteTag] Error:', error);
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}
```

### Streaming
```typescript
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Stream chunks
      for await (const chunk of source) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      controller.close();
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    }
  });
}
```

## Known Issues

### RLM Cold Start
Render free tier spins down after inactivity. First request after idle = ~10s delay.
**Mitigation**: Health check ping every 5 min via cron.

### Large Import Timeouts
Very large exports (10GB+) may timeout during embedding generation.
**Mitigation**: Background processing with status polling.

### Mobile Keyboard
iOS Safari keyboard can obscure input in chat.
**Mitigation**: Use visualViewport API for proper sizing.

## File Structure

```
soulprint-landing/
├── app/
│   ├── api/          # 28 API routes
│   ├── chat/         # Main chat page
│   ├── import/       # Upload flow
│   ├── dashboard/    # User dashboard
│   └── ...
├── components/
│   ├── ui/           # Radix-based components
│   └── ...
├── lib/
│   ├── supabase/     # DB clients
│   ├── import/       # Parser logic
│   ├── memory/       # Query utils
│   └── rlm/          # RLM client
├── .planning/        # GSD specs
└── docs/             # Documentation
```

---
*Last updated: 2026-02-05*
