# SOULPRINT IMPLEMENTATION PLAN

## Project Overview

**SoulPrint** is an AI companion platform that captures a user's psychological identity and creates an AI that speaks, thinks, and responds exactly like them. It's not a chatbot - it's a personality mirror.

**Core Vision:**
- AI that IS the user (higher self)
- Indistinguishable from the real person in writing/conversation
- Personal companion for loneliness, emotional support, talking through life
- Can be used via API in external apps

---

## What SoulPrint Does

### The 6 Psychological Pillars

Each user answers 36 questions across 6 pillars:

| Pillar | Questions | What It Captures |
|--------|-----------|------------------|
| 1. Communication Style | s1, q1, s2, q2, s3, q3, v1 | How they speak, write, pace, interrupt |
| 2. Emotional Alignment | s4, q4, s5, q5, s6, q6 | Emotional range, triggers, comforts |
| 3. Decision-Making & Risk | s7, q7, s8, q8, s9, q9 | Gut vs analysis, risk tolerance |
| 4. Social & Cultural Identity | s10, q10, s11, q11, s12, q12 | Networks, norms, beliefs, code-switching |
| 5. Cognitive Processing | s13, q13, s14, q14, s15, q15 | How their brain works, learning style |
| 6. Assertiveness & Conflict | s16, q16, s17, q17, s18, q18 | How they handle tension, conflict style |

Question types:
- `s` = Slider (scale between two extremes)
- `q` = Text question (free response)
- `v` = Voice recording

### The SoulPrint Generation Flow

```
STEP 1: User completes 36 questions
        - Slider values stored
        - Text answers stored
        - Voice recordings transcribed + analyzed
        ↓
STEP 2: Generate 6 Micro-Stories
        - LLM creates one story per pillar
        - Written in user's detected voice/style
        - Contains emotional beats and pause points
        ↓
STEP 3: User reads stories aloud (6 recordings)
        - Captures actual speaking cadence
        - Not performance - just natural reading
        ↓
STEP 4: Extract Emotional Signature Curve
        - Tone breaks
        - Cadence arcs
        - Emotive fluctuation
        - Pause points
        - Emphasis patterns
        ↓
STEP 5: Generate Final SoulPrint
        - 6 pillar summaries
        - Emotional signature data
        - Voice patterns
        - System prompt for LLM
        ↓
STEP 6: Store SoulPrint
        - Saved to database
        - Used as context for ALL future chats
```

### The System Prompt (How SoulPrint Gets Used)

Every chat loads the user's SoulPrint and injects it as the system prompt:

```
You are operating with SoulPrint identity for "{USER_NAME}".

COMMUNICATION STYLE:
{pillar_1_summary}

EMOTIONAL ALIGNMENT:
{pillar_2_summary}

DECISION-MAKING:
{pillar_3_summary}

SOCIAL & CULTURAL:
{pillar_4_summary}

COGNITIVE PROCESSING:
{pillar_5_summary}

CONFLICT STANCE:
{pillar_6_summary}

EMOTIONAL SIGNATURE:
- Rhythm: {cadence_pattern}
- Pause points: {pause_patterns}
- Tone: {tone_pattern}

MEMORIES FROM PAST CONVERSATIONS:
{relevant_memories}

You are not a chatbot. You are their AI companion.
You speak with their rhythm.
You make decisions using their logic.
You handle conflict using their style.

Presence is sacred. Cadence is sacred.
```

---

## Current Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Database/Auth:** Supabase (PostgreSQL)
- **Current AI:** Gemini (to be replaced)
- **Voice:** AssemblyAI for transcription
- **3D Visuals:** Three.js + React Three Fiber

---

## What Exists (Current Codebase)

### Working Features
| Feature | Location | Status |
|---------|----------|--------|
| 36 Questions UI | `app/questionnaire/` | ✅ Working |
| Voice Recording | `components/voice-recorder/` | ✅ Working |
| Voice Transcription | AssemblyAI integration | ✅ Working |
| Basic Prosody Analysis | `lib/prosody/` | ✅ Exists |
| Chat Interface | `app/dashboard/chat/` | ✅ Working |
| User Auth | Supabase + `app/actions/auth.ts` | ✅ Working |
| SoulPrint Storage | Supabase tables | ✅ Working |
| Basic SoulPrint Generation | `lib/soulprint/service.ts` | ✅ Exists |

### Needs Building/Updating
| Feature | Priority | Notes |
|---------|----------|-------|
| Together.ai Client | HIGH | Replace Gemini with Qwen 3 |
| Micro-Story Generator | HIGH | LLM generates stories from 36 Q |
| Story Reading Flow | HIGH | UI for reading stories aloud |
| Emotional Signature Extractor | HIGH | Analyze voice for cadence |
| Enhanced SoulPrint Generator | HIGH | Synthesize all data into profile |
| System Prompt Builder | HIGH | Build prompt from SoulPrint |
| Memory System Enhancement | MEDIUM | Better conversation memory |
| User API Keys | MEDIUM | For external app access |
| Fine-tuning Data Collection | LOW | Log data for future model training |

---

## Key Files to Know

```
app/
├── questionnaire/
│   ├── page.tsx              # Main questionnaire flow
│   ├── new/page.tsx          # New SoulPrint creation
│   └── complete/page.tsx     # Completion page
├── dashboard/
│   └── chat/
│       ├── page.tsx          # Chat page
│       └── chat-client.tsx   # Chat UI component
├── api/
│   ├── soulprint/
│   │   ├── generate/route.ts # SoulPrint generation endpoint
│   │   └── submit/route.ts   # Submit questionnaire answers
│   ├── gemini/chat/route.ts  # Current chat endpoint (REPLACE)
│   └── voice/analyze/route.ts # Voice analysis endpoint
└── actions/
    └── soulprint-management.ts # SoulPrint CRUD operations

lib/
├── questions.ts              # 36 questions data
├── soulprint/
│   └── service.ts            # SoulPrint generation logic
├── prosody/                  # Voice/cadence analysis
├── gemini/                   # Current LLM (REPLACE)
└── supabase/                 # Database clients

components/
├── voice-recorder/           # Voice recording components
└── dashboard/                # Dashboard UI components
```

---

## API Setup

### Together.ai (LLM Provider)

**Why Together.ai:**
- Has Qwen 3 235B (best open-source model)
- Pay per token (cheap for low usage)
- OpenAI-compatible API
- No infrastructure to manage

**Pricing:** ~$0.50 per 1M tokens (~$50-100/month early stage)

**Setup:**
1. Sign up at https://together.ai
2. Get API key
3. Add to `.env.local`: `TOGETHER_API_KEY=xxx`

**API Usage:**
```typescript
const response = await fetch('https://api.together.xyz/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'Qwen/Qwen3-235B-A22B',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    temperature: 0.8,
    max_tokens: 2048
  })
});
```

---

## Repos to Study/Fork

These repos have solved pieces of what SoulPrint needs:

### 1. a16z/companion-app
**URL:** https://github.com/a16z-infra/companion-app
**Take:** Memory system, personality backstory injection, conversation flow
**Why:** Clean Next.js stack, similar architecture, tutorial-level code

### 2. Hukasx0/ai-companion
**URL:** https://github.com/Hukasx0/ai-companion
**Take:** Long-term memory, real-time learning from conversations
**Why:** Good memory architecture, learns about users over time

### 3. MimickMyStyle_LLM
**URL:** https://github.com/Amirthavarshini-Dhanavel/MimickMyStyle_LLM
**Take:** Writing style fine-tuning approach
**Why:** For future fine-tuning - captures how to mimic writing style

### 4. MrReplikant/AvrilAI
**URL:** https://github.com/MrReplikant/AvrilAI
**Take:** User-controlled personality system
**Why:** Anti-Replika approach - users control their AI's personality fully

### 5. EmoCareAI/ChatPsychiatrist
**URL:** https://github.com/EmoCareAI/ChatPsychiatrist
**Take:** Emotional support conversation patterns
**Why:** Fine-tuned for counseling/support conversations

---

## Implementation Steps

### Phase 1: LLM Setup (Together.ai)

**Goal:** Replace Gemini with Qwen 3 via Together.ai

**Tasks:**
1. Create `lib/together/client.ts` - Together.ai API client
2. Update `app/api/chat/route.ts` - Use Together.ai for chat
3. Update `lib/soulprint/service.ts` - Use Together.ai for generation
4. Test chat works with new LLM
5. Remove Gemini dependencies

**Files to create/modify:**
- CREATE: `lib/together/client.ts`
- MODIFY: `app/api/gemini/chat/route.ts` → rename to `app/api/chat/route.ts`
- MODIFY: `lib/soulprint/service.ts`

### Phase 2: Micro-Story Generator

**Goal:** Generate 6 personalized stories from 36-question answers

**Tasks:**
1. Create function to format 36 answers by pillar
2. Create prompt template for story generation
3. Generate one story per pillar
4. Store stories for user to read

**Prompt for each pillar:**
```
Based on this user's responses to Pillar {N} ({PILLAR_NAME}):

Slider responses:
{SLIDER_DATA}

Text responses:
{TEXT_DATA}

Voice transcript (if available):
{VOICE_TRANSCRIPT}

Write a short story (3-4 paragraphs) that:
- Is written in THEIR voice based on their communication style
- Contains natural pause points for reading aloud
- Has emotional beats that match their personality
- Feels like something THEY would say about themselves

This story will be read aloud to capture their speaking cadence.
The story should be personal, reflective, and reveal their {PILLAR_NAME}.
```

### Phase 3: Story Reading Flow

**Goal:** UI for users to read their 6 stories aloud

**Tasks:**
1. Create new page: `app/questionnaire/stories/page.tsx`
2. Display one story at a time
3. Record user reading each story
4. Store recordings for analysis
5. Navigate to next story after each recording

**UI Flow:**
```
"Read this story aloud, naturally - no performance needed"
[Story text displayed]
[Record button]
[Next story →]
```

### Phase 4: Emotional Signature Extractor

**Goal:** Analyze voice recordings to extract cadence patterns

**Tasks:**
1. Enhance `lib/prosody/` analysis
2. Extract from story readings:
   - Tone breaks (where voice changes)
   - Cadence arcs (rhythm patterns)
   - Pause points (natural pauses)
   - Emphasis patterns (stressed words)
   - Speed variations
3. Create "Emotional Signature Curve" data structure
4. Store with SoulPrint

**Data structure:**
```typescript
interface EmotionalSignatureCurve {
  averagePace: 'slow' | 'moderate' | 'fast';
  pauseFrequency: number; // pauses per minute
  toneVariation: 'monotone' | 'moderate' | 'expressive';
  emphasisPatterns: string[]; // types of words emphasized
  emotionalRange: 'contained' | 'moderate' | 'expressive';
  speechMarkers: string[]; // filler words, phrases
}
```

### Phase 5: Enhanced SoulPrint Generator

**Goal:** Create final SoulPrint from all collected data

**Tasks:**
1. Gather all data: 36 answers + voice transcripts + story readings + emotional signature
2. Create comprehensive generation prompt
3. Generate 6 pillar summaries
4. Generate overall personality synthesis
5. Generate system prompt template
6. Store complete SoulPrint

**Generation prompt:**
```
You are creating a SoulPrint - a complete psychological profile for an AI companion.

USER'S 36 QUESTION RESPONSES:
{ALL_ANSWERS_BY_PILLAR}

VOICE ANALYSIS FROM STORY READINGS:
{EMOTIONAL_SIGNATURE_CURVE}

SPEECH PATTERNS DETECTED:
{SPEECH_MARKERS}

Create a SoulPrint with:

1. PILLAR SUMMARIES (one paragraph each):
   - Communication Style: How they express themselves
   - Emotional Alignment: Their emotional patterns
   - Decision-Making: How they make choices
   - Social/Cultural: Their identity and values
   - Cognitive Processing: How they think
   - Conflict Style: How they handle tension

2. VOICE PROFILE:
   - Speaking rhythm description
   - Natural pause patterns
   - Tone characteristics
   - Unique speech markers

3. AI BEHAVIOR GUIDELINES:
   - How should the AI speak to match them?
   - What tone should it use?
   - How should it handle emotional moments?
   - What should it avoid?

Be extremely specific. Use their actual words as examples.
This will be used to make an AI that is indistinguishable from them.
```

### Phase 6: System Prompt Builder

**Goal:** Build dynamic system prompt from SoulPrint data

**Tasks:**
1. Create `lib/prompt/soulprint-builder.ts`
2. Load user's SoulPrint from database
3. Load relevant memories
4. Build complete system prompt
5. Use in every chat request

**Function signature:**
```typescript
async function buildSoulPrintPrompt(userId: string): Promise<string> {
  const soulprint = await getSoulPrint(userId);
  const memories = await getRelevantMemories(userId);
  return formatSystemPrompt(soulprint, memories);
}
```

### Phase 7: Memory System Enhancement

**Goal:** Better conversation memory using patterns from repos

**Tasks:**
1. Study a16z/companion-app memory system
2. Study Hukasx0/ai-companion long-term memory
3. Implement fact extraction from conversations
4. Implement memory search/retrieval
5. Inject relevant memories into system prompt

**Memory types:**
- Facts: "User has a dog named Max"
- Preferences: "User prefers direct communication"
- Events: "User mentioned job interview on Monday"
- Emotional: "User was feeling anxious about presentation"

### Phase 8: User API Keys

**Goal:** Let users access their SoulPrint from external apps

**Tasks:**
1. Create API key generation UI in settings
2. Create `app/api/v1/chat/route.ts` - public API endpoint
3. Validate API key on requests
4. Load user's SoulPrint based on API key
5. Document API for users

**API endpoint:**
```
POST /api/v1/chat
Headers:
  Authorization: Bearer sk-soulprint-xxx

Body:
{
  "message": "Hello, how are you?"
}

Response:
{
  "response": "...",
  "soulprint_id": "..."
}
```

---

## Database Schema Updates

### soulprints table (enhance existing)
```sql
ALTER TABLE soulprints ADD COLUMN IF NOT EXISTS:
  pillar_1_summary TEXT,
  pillar_2_summary TEXT,
  pillar_3_summary TEXT,
  pillar_4_summary TEXT,
  pillar_5_summary TEXT,
  pillar_6_summary TEXT,
  emotional_signature JSONB,
  voice_patterns JSONB,
  system_prompt TEXT,
  micro_stories JSONB,
  story_recordings JSONB
```

### user_memories table (create if not exists)
```sql
CREATE TABLE IF NOT EXISTS user_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  memory TEXT NOT NULL,
  memory_type TEXT, -- fact, preference, event, emotional
  importance FLOAT DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed TIMESTAMPTZ DEFAULT NOW()
);
```

### api_keys table (create if not exists)
```sql
CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL, -- first 8 chars for display
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);
```

---

## Environment Variables

Add to `.env.local`:
```bash
# Together.ai (LLM)
TOGETHER_API_KEY=your-together-api-key

# Feature flags
ENABLE_MICRO_STORIES=true
ENABLE_STORY_READING=true
ENABLE_EMOTIONAL_SIGNATURE=true
ENABLE_MEMORY_SYSTEM=true
ENABLE_USER_API_KEYS=true
```

---

## Testing Checklist

### Phase 1: LLM
- [ ] Together.ai client connects
- [ ] Chat works with Qwen 3
- [ ] SoulPrint generation works

### Phase 2: Micro-Stories
- [ ] Stories generate for each pillar
- [ ] Stories reflect user's answers
- [ ] Stories are appropriate length

### Phase 3: Story Reading
- [ ] UI displays stories correctly
- [ ] Recording works
- [ ] All 6 stories can be recorded

### Phase 4: Emotional Signature
- [ ] Voice analysis extracts cadence
- [ ] Signature curve is generated
- [ ] Data structure is complete

### Phase 5: SoulPrint Generator
- [ ] All data is synthesized
- [ ] Pillar summaries are accurate
- [ ] System prompt is complete

### Phase 6: System Prompt
- [ ] Prompt builds correctly
- [ ] Memories are included
- [ ] Chat uses SoulPrint context

### Phase 7: Memory
- [ ] Facts are extracted
- [ ] Memories are retrieved
- [ ] Relevant memories are injected

### Phase 8: API Keys
- [ ] Keys can be generated
- [ ] API validates keys
- [ ] External requests work

---

## Cost Estimates

| Stage | Users | Together.ai | Total/Month |
|-------|-------|-------------|-------------|
| Development | 1-5 | ~$20 | ~$45 |
| Early users | 10-50 | ~$50-100 | ~$75-125 |
| Growth | 50-200 | ~$100-300 | ~$125-325 |
| Scale | 200+ | ~$300+ | Consider self-host |

---

## Future Roadmap (Not Now)

1. **Voice Chat** - Speak to your SoulPrint (Deepgram + TTS)
2. **Fine-tuned Model** - Train SoulPrint-30B on conversation data
3. **AWS Self-hosting** - When scale justifies ~$4k/month
4. **Chrome Extension** - Use SoulPrint anywhere on the web
5. **Desktop Widget** - Always-on companion
6. **Mobile App** - iOS/Android companion

---

## Summary

**What we're building:** An AI companion that IS the user - speaks like them, thinks like them, responds like them.

**How it works:**
1. 36 questions capture personality
2. User reads generated stories aloud
3. Voice analysis extracts cadence/rhythm
4. Everything synthesized into SoulPrint
5. SoulPrint injected into every chat
6. AI becomes indistinguishable from user

**Tech approach:**
- Together.ai for LLM (Qwen 3)
- Supabase for database
- AssemblyAI for voice
- Study repos for memory/personality patterns

**First priority:** Get Together.ai working, then build micro-story generator.

---

*Take this plan to VS Code. Let Claude Code execute it step by step.*
