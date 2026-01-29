# SoulPrint v2 Blueprint

## 🏷️ Project Name
**SoulPrint** — AI that remembers you

## 🎯 One-Liner
Import your ChatGPT history. Get an AI that actually knows you.

---

## 🎨 Visual Style (CRITICAL)

**Reference:** See `/moodboard/` folder

### Colors
- **Background:** #000000 (pure black)
- **Primary accent:** #EA580C → #F97316 (warm orange gradient)
- **Glass:** rgba(255,255,255,0.1) with blur
- **Text:** #FFFFFF (white), #A3A3A3 (muted)

### Visual Elements
- **3D liquid glass shapes** — glossy orange blobs, pills, spheres
- **Glass morphism** — frosted glass cards with backdrop-blur
- **Soft orange glows** — ambient lighting effects
- **Organic curves** — no harsh corners, everything flows
- **Reflections** — subtle light reflections on surfaces

### CSS Techniques
```css
/* Glass card */
.glass-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
}

/* Orange glow */
.glow {
  box-shadow: 0 0 60px rgba(234, 88, 12, 0.3);
}

/* Gradient text */
.gradient-text {
  background: linear-gradient(135deg, #EA580C, #F97316);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

### Hero Visual
- Large 3D orange blob/sphere animation (CSS or canvas)
- Or use moodboard images as background with overlay
- Floating, pulsing effect

---

## 👤 User Flow

### 1. Landing (/)
**Not logged in:**
- Hero with 3D orange blob visual
- Headline: "AI that remembers you"
- Subheadline: "Import your ChatGPT history. Never repeat yourself again."
- Two glass buttons: "Sign In" / "Get Started"

**Logged in:**
- Redirect to /chat

### 2. Auth (/login, /signup)
- Glass card centered on black bg
- Orange accent on inputs focus
- Google OAuth button
- Smooth transitions

### 3. Import (/import)
- "Connect your memory" header
- Simple 3-step visual:
  1. We email you instructions
  2. You forward your ChatGPT export
  3. We build your memory
- Big orange "Send Instructions" button
- "Skip for now" link

### 4. Chat (/chat)
- Full-screen dark interface
- Glass message bubbles
- Orange accent for AI responses
- Input bar at bottom with glass effect
- Subtle orange glow when AI is "thinking"

---

## ⚙️ Features (MVP)

### Auth
- [x] Email/password (Supabase)
- [x] Google OAuth
- [x] Session persistence

### Import
- [ ] Send email instructions
- [ ] Poll Gmail for forwarded exports
- [ ] Parse ChatGPT ZIP
- [ ] Generate embeddings (OpenAI)
- [ ] Store in Supabase with pgvector

### Chat
- [ ] Streaming responses
- [ ] Memory retrieval via embeddings
- [ ] Context injection in system prompt
- [ ] Message history

---

## 🔧 Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS + custom glass utilities
- **Database:** Supabase (Postgres + pgvector)
- **Auth:** Supabase Auth
- **AI:** OpenAI GPT-4o (chat), text-embedding-3-small (embeddings)
- **Hosting:** Vercel

---

## 📊 Data Model

```sql
-- Users handled by Supabase Auth

-- Imported conversations
imported_chats (
  id uuid primary key,
  user_id uuid references auth.users,
  title text,
  messages jsonb,
  source text, -- 'chatgpt', 'claude', etc.
  imported_at timestamptz
)

-- Embeddings for memory retrieval
memory_embeddings (
  id uuid primary key,
  user_id uuid references auth.users,
  content text,
  embedding vector(1536),
  metadata jsonb,
  created_at timestamptz
)

-- Chat history
chat_messages (
  id uuid primary key,
  user_id uuid references auth.users,
  role text, -- 'user' or 'assistant'
  content text,
  created_at timestamptz
)
```

---

## 📁 File Structure

```
app/
  page.tsx              # Landing hero
  login/page.tsx        
  signup/page.tsx       
  import/page.tsx       
  chat/page.tsx         
  api/
    auth/callback/route.ts
    chat/route.ts
    import/
      send-instructions/route.ts
      email-poll/route.ts
    memory/
      query/route.ts

components/
  ui/
    GlassCard.tsx
    GlassButton.tsx
    GlassInput.tsx
  Hero3D.tsx            # Animated orange blob
  ChatBubble.tsx
  MessageInput.tsx

lib/
  supabase/
    client.ts
    server.ts
  openai.ts
  embeddings.ts

styles/
  globals.css           # Glass utilities, animations
```

---

## ❌ What This Is NOT

- Not a ChatGPT wrapper (it's memory-enhanced)
- Not storing full conversations long-term (just embeddings)
- Not multi-user/teams
- Not mobile app (PWA web only)

---

## ✅ Acceptance Criteria

1. Landing page has premium liquid glass aesthetic
2. User can sign up/login smoothly
3. User receives import instructions email
4. Email forward is processed automatically
5. Chat uses embeddings for memory retrieval
6. AI responses reference relevant past context
7. All pages load < 2s
8. Mobile responsive

---

## 🚀 Build Command

```
Build SoulPrint v2 in /home/drewp/clawd/soulprint-v2

Follow BLUEPRINT.md exactly. Key requirements:
1. Premium liquid glass aesthetic (black bg, orange accents, glass morphism)
2. Working auth flow (Supabase)
3. Import page with email instructions
4. Chat page with streaming responses
5. Use the moodboard images in /moodboard/ for visual reference

Start with: npx create-next-app@latest . --typescript --tailwind --app --src-dir=false
```
