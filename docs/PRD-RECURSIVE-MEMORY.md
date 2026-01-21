# PRD: SoulPrint Recursive Memory System

## Overview

Replace SoulPrint's current top-5 vector search memory retrieval with recursive LLM exploration. The companion will explore full conversation history, connect patterns across time, and respond with genuine continuity—not keyword matching.

**GitHub Reference:** [ysz/recursive-llm](https://github.com/ysz/recursive-llm)

---

## Problem

Current state:
- User sends message
- System generates embedding, searches Supabase for top 5 similar messages
- Injects those 5 messages into L3 (memory layer)
- Companion responds with limited context

**What's broken:**
- Top-5 retrieval misses relevant context that doesn't match keywords
- No synthesis across conversations—just raw message injection
- Companion can't "remember" arcs, only similar phrases
- Users don't feel known over time

---

## Solution

Integrate recursive-llm to give the companion exploratory access to full conversation history:

1. Pull full history from Supabase (not top 5)
2. Pass to recursive-llm as a searchable variable (not stuffed in prompt)
3. LLM explores: peeks at chunks, regex searches, recurses up to 5 levels
4. Returns synthesized context relevant to current conversation
5. Inject synthesis into L3
6. Companion responds with genuine understanding

---

## Goals

| Goal | Description |
|------|-------------|
| **Genuine Continuity** | Companion remembers the arc of user's life, not just similar keywords |
| **Deeper Understanding** | Surface patterns user never explicitly stated |
| **Data Isolation** | All processing stays in AWS—no data leaks to external providers |
| **Cost Efficiency** | Scale to 40+ users without breaking the bank |

---

## Non-Goals (V1)

- Recursive personality refinement (future)
- Real-time self-improvement loops (future)
- Multi-user memory sharing (not planned)

---

## Technical Approach

### Architecture

```
User Message
    ↓
Soul Engine (Next.js)
    ↓
Pull full history ← Supabase (chat_logs)
    ↓
POST /explore → Python Microservice (recursive-llm)
    ↓
Recursive exploration (up to 5 levels) ← Claude Sonnet on Bedrock
    ↓
Synthesized context returned
    ↓
Inject into L3 layer
    ↓
Final response ← Claude Sonnet on Bedrock
    ↓
Stream to user
```

### Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Storage** | Supabase | Chat logs, soulprints, memory cache |
| **LLM** | Claude 3.5 Sonnet on Bedrock | Exploration + final response (single model) |
| **Embeddings** | Amazon Titan Embeddings v2 | Vector storage (AWS-native, no data leak) |
| **Exploration Engine** | ysz/recursive-llm (Python) | Recursive context processing |
| **Microservice** | Python (FastAPI) on ECS/Lambda | Hosts recursive-llm |
| **App** | Next.js (existing) | Soul Engine integration |

### Data Flow

**Current (replace this):**
```
message → embedding → vector search (top 5) → inject → respond
```

**New:**
```
message → pull full history → RLM explore → synthesize → inject → respond
```

---

## Database Changes

### New Supabase Function

```sql
-- Pull full chat history for RLM exploration
CREATE OR REPLACE FUNCTION get_full_chat_history(
  p_user_id uuid,
  p_limit int DEFAULT 500
)
RETURNS TABLE(
  role text,
  content text,
  created_at timestamptz
) AS $$
  SELECT role, content, created_at
  FROM chat_logs
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT p_limit;
$$ LANGUAGE sql;
```

### New Table: Memory Synthesis Cache

```sql
CREATE TABLE memory_syntheses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  query_hash text NOT NULL,
  synthesis text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

CREATE INDEX idx_memory_syntheses_user_query
ON memory_syntheses(user_id, query_hash);
```

### Embeddings Migration

Switch from OpenAI to Titan:

```typescript
// Before (lib/soulprint/memory/retrieval.ts)
const embedding = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: content
});

// After
const embedding = await bedrockClient.invokeModel({
  modelId: "amazon.titan-embed-text-v2:0",
  body: JSON.stringify({ inputText: content })
});
```

---

## API Design

### Python Microservice

**Endpoint:** `POST /explore`

**Request:**
```json
{
  "history": [
    {"role": "user", "content": "...", "created_at": "..."},
    {"role": "assistant", "content": "...", "created_at": "..."}
  ],
  "query": "the custody situation",
  "max_depth": 5,
  "timeout_ms": 10000
}
```

**Response:**
```json
{
  "synthesis": "User has been dealing with custody negotiations since March. Key events: initial filing (March 12), mediation attempt (April 3) which failed, current status is awaiting court date. Emotional state has shifted from anxious to more resolved. Partner mentioned: ex-wife Sarah. Children: two, ages 8 and 11.",
  "sources": ["2024-03-12", "2024-04-03", "2024-04-15"],
  "depth_reached": 3,
  "tokens_used": 4500
}
```

---

## Fallback Strategy

If RLM exploration fails or times out:

1. **First fallback:** Use cached synthesis from `memory_syntheses` table
2. **Second fallback:** Use current vector search (top 5)
3. **Third fallback:** Respond with L1 + L2 only (no memory context)

**Goal:** Never let memory retrieval block the response. Degrade gracefully.

---

## Cost Model

### Assumptions
- 40 active users
- 10 messages per user per day
- 400 messages/day total
- 5 recursive exploration levels per message

### Monthly Cost (Single Model: Sonnet)

| Component | Calculation | Cost |
|-----------|-------------|------|
| Exploration tokens | 400 msgs × 6,000 tokens × 30 days | ~$20/day |
| Final response tokens | 400 msgs × 2,000 tokens × 30 days | ~$6/day |
| Titan Embeddings | 800 embeddings/day × 30 days | ~$0.50/month |
| Supabase | Free tier | $0 |
| **Monthly Total** | | **~$650** |

### Zero Usage
$0 — Bedrock is pure pay-per-token.

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **User-reported continuity** | 80%+ say "companion remembers me" | In-app survey after 2 weeks |
| **Context retrieval accuracy** | 90%+ relevant context surfaced | Manual audit of 50 conversations |
| **Response latency** | <3 seconds p95 | CloudWatch metrics |
| **Exploration success rate** | 99%+ without fallback | Log analysis |
| **Monthly cost** | <$800 at 40 users | AWS billing |

---

## Build Steps

### Step 1: Supabase Setup
- [ ] Add `get_full_chat_history` function
- [ ] Create `memory_syntheses` table
- [ ] Add full-text search index on `chat_logs.content`
- [ ] Test bulk retrieval performance

### Step 2: AWS Bedrock Setup
- [ ] Enable Claude 3.5 Sonnet in Bedrock console
- [ ] Enable Amazon Titan Embeddings v2
- [ ] Create IAM role with `bedrock:InvokeModel` permission
- [ ] Test model invocation from local environment

### Step 3: Python Microservice
- [ ] Clone ysz/recursive-llm
- [ ] Create FastAPI wrapper with `/explore` endpoint
- [ ] Configure to use Bedrock (boto3)
- [ ] Add timeout handling (10s max)
- [ ] Add recursion depth cap (5 levels)
- [ ] Containerize with Docker
- [ ] Deploy to ECS or Lambda

### Step 4: Soul Engine Integration
- [ ] Create `exploreMemoryRLM()` function in `lib/soulprint/memory/`
- [ ] Update `constructSystemPrompt()` to use RLM exploration
- [ ] Add synthesis caching logic
- [ ] Implement fallback chain
- [ ] Switch embeddings from OpenAI to Titan

### Step 5: Testing
- [ ] Unit tests for exploration endpoint
- [ ] Integration tests with real conversation histories
- [ ] Load testing (simulate 40 concurrent users)
- [ ] Fallback scenario testing

### Step 6: Monitoring
- [ ] CloudWatch dashboard for latency + error rates
- [ ] AWS Cost Explorer alerts ($50/day threshold)
- [ ] Logging for exploration depth + token usage

### Step 7: Ship
- [ ] Deploy to production
- [ ] Monitor for 48 hours
- [ ] Gather user feedback
- [ ] Iterate

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| RLM exploration too slow | Bad UX, timeouts | 10s timeout + fallback to cache |
| Costs spike unexpectedly | Budget blown | Daily cost alerts, recursion caps |
| Synthesis quality poor | Wrong context surfaced | Prompt tuning, manual audits |
| Bedrock rate limits | Requests fail | Implement retry with backoff |
| Python microservice down | Memory layer broken | Fallback to vector search |

---

## Future Considerations (Post-V1)

- **Recursive personality refinement:** Companion updates its understanding of user personality based on conversation patterns
- **Proactive memory:** Companion surfaces relevant memories without being asked
- **Cross-session synthesis:** Build long-term user model beyond individual conversations
- **Local LLM option:** SageMaker self-hosting for enterprise compliance

---

## References

- [ysz/recursive-llm](https://github.com/ysz/recursive-llm) — Core exploration engine
- [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/) — Cost reference
- [Amazon Titan Embeddings](https://docs.aws.amazon.com/bedrock/latest/userguide/titan-embedding-models.html) — Embeddings docs
- `/ace-extraction/SOULPRINT-MEMORY-SPEC.md` — Current L3 memory layer spec
- `/lib/soulprint/memory/retrieval.ts` — Current retrieval implementation
