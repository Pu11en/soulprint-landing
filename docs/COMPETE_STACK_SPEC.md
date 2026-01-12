# SoulPrint Compete Stack - Technical Specification

## Executive Summary

This spec outlines the complete architecture to make SoulPrint competitive with Character.ai, Replika, and Pi. The 36-question assessment remains as the user-facing "theatrical" onboarding, while the real AI quality comes from:

1. **Self-hosted LLM on AWS** (Qwen 2.5 72B via vLLM)
2. **Production memory system** (mem0)
3. **Passive personality detection** (Big Five from chat)
4. **Emotion recognition** (sentiment + tone matching)
5. **Fine-tuning pipeline** (for future moat)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE                                │
│                        (Existing Next.js App)                           │
│  ┌─────────────────────────┐    ┌─────────────────────────────────────┐ │
│  │   36-Question Flow      │    │       Chat Interface                │ │
│  │   (Theatrical Front)    │    │       (The Real Product)            │ │
│  │                         │    │                                     │ │
│  │   - Stores SoulPrint    │    │   - Real-time conversation          │ │
│  │   - Seeds initial data  │    │   - Memory-augmented                │ │
│  │   - User feels special  │    │   - Personality-aware               │ │
│  └───────────┬─────────────┘    └─────────────────┬───────────────────┘ │
└──────────────┼────────────────────────────────────┼─────────────────────┘
               │                                    │
               ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API LAYER                                     │
│                    /api/v2/chat/completions                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Chat Orchestrator                             │   │
│  │                                                                  │   │
│  │  1. Load user context (SoulPrint + mem0 memories)               │   │
│  │  2. Analyze incoming message (personality + emotion)            │   │
│  │  3. Build dynamic system prompt                                 │   │
│  │  4. Call AWS LLM (vLLM)                                        │   │
│  │  5. Extract facts → Update mem0                                 │   │
│  │  6. Log for fine-tuning                                        │   │
│  │  7. Return response                                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────────┐
│      mem0         │   │   Personality     │   │     AWS vLLM          │
│   (Memory Layer)  │   │    Engine         │   │    (Inference)        │
│                   │   │                   │   │                       │
│ - User facts      │   │ - Big Five detect │   │  g5.48xlarge          │
│ - Preferences     │   │ - Emotion detect  │   │  8x A10G (192GB)      │
│ - Conversation    │   │ - Style matching  │   │  Qwen 2.5 72B         │
│   history         │   │                   │   │  OpenAI-compat API    │
│ - Relationship    │   │                   │   │                       │
│   evolution       │   │                   │   │                       │
└───────────────────┘   └───────────────────┘   └───────────────────────┘
        │                           │                           │
        └───────────────────────────┴───────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │     Fine-Tuning Pipeline      │
                    │                               │
                    │  - Collect conversation logs  │
                    │  - Tag with personality data  │
                    │  - Export for training        │
                    │  - Creates SoulPrint-72B      │
                    └───────────────────────────────┘
```

---

## Phase 1: AWS Infrastructure

### Instance Specification

| Component | Specification |
|-----------|---------------|
| Instance Type | g5.48xlarge |
| GPUs | 8x NVIDIA A10G |
| VRAM | 192GB total |
| vCPUs | 192 |
| RAM | 768GB |
| Storage | 500GB gp3 SSD |
| Cost | ~$16.29/hr (~$11,700/mo always-on) |

### Software Stack

```bash
# Base: AWS Deep Learning AMI (Ubuntu 22.04)
# Inference Server: vLLM 0.4.x
# Model: Qwen/Qwen2.5-72B-Instruct
# API: OpenAI-compatible endpoint
```

### Networking

- VPC with private subnet
- Application Load Balancer (public-facing)
- Security Group: Allow 443 from ALB only
- SSL termination at ALB
- API key authentication in app layer

### Setup Script (Terraform)

```hcl
# infrastructure/aws/main.tf

provider "aws" {
  region = "us-east-1"  # Best GPU availability
}

resource "aws_instance" "soulprint_llm" {
  ami           = "ami-0123456789"  # Deep Learning AMI
  instance_type = "g5.48xlarge"

  root_block_device {
    volume_size = 500
    volume_type = "gp3"
  }

  user_data = file("setup.sh")

  tags = {
    Name = "soulprint-llm-inference"
  }
}

resource "aws_lb" "soulprint_llm_alb" {
  name               = "soulprint-llm-alb"
  internal           = false
  load_balancer_type = "application"

  # ... ALB config
}
```

### vLLM Setup Script

```bash
#!/bin/bash
# infrastructure/aws/setup.sh

# Install dependencies
pip install vllm ray

# Download model (will cache on EBS)
huggingface-cli login --token $HF_TOKEN

# Start vLLM server
python -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen2.5-72B-Instruct \
    --tensor-parallel-size 8 \
    --host 0.0.0.0 \
    --port 8000 \
    --max-model-len 32768 \
    --gpu-memory-utilization 0.95
```

### Environment Variables (for Next.js)

```env
# .env.local additions
AWS_LLM_ENDPOINT=https://llm.soulprint.ai  # ALB DNS
AWS_LLM_API_KEY=sk-soulprint-internal-xxx
AWS_LLM_MODEL=Qwen/Qwen2.5-72B-Instruct
```

---

## Phase 2: mem0 Integration

### Installation

```bash
npm install mem0ai
```

### Memory Service (`lib/mem0/client.ts`)

```typescript
import { Memory } from 'mem0ai';

const memory = new Memory({
  apiKey: process.env.MEM0_API_KEY,
  // Or self-hosted:
  // baseUrl: process.env.MEM0_SELF_HOSTED_URL
});

export interface UserMemory {
  facts: string[];           // "User likes hiking"
  preferences: string[];     // "Prefers direct communication"
  personality: {
    openness: number;        // Big Five scores (0-100)
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  relationship: {
    trust_level: number;     // 0-100
    conversations: number;
    last_interaction: string;
  };
}

export async function addMemory(userId: string, message: string, role: 'user' | 'assistant') {
  await memory.add(message, { user_id: userId, metadata: { role } });
}

export async function searchMemory(userId: string, query: string): Promise<string[]> {
  const results = await memory.search(query, { user_id: userId, limit: 10 });
  return results.map(r => r.memory);
}

export async function getAllMemories(userId: string): Promise<string[]> {
  const results = await memory.getAll({ user_id: userId });
  return results.map(r => r.memory);
}
```

### Migration from Letta-Lite

The existing `soulprint_memory` table stays for backward compatibility. mem0 becomes the primary memory system, with a sync layer.

---

## Phase 3: Personality Detection

### Big Five Detector (`lib/personality/big-five-detector.ts`)

Uses linguistic markers to detect personality traits from text:

```typescript
export interface BigFiveProfile {
  openness: number;          // 0-100: Creativity, curiosity
  conscientiousness: number; // 0-100: Organization, dependability
  extraversion: number;      // 0-100: Sociability, energy
  agreeableness: number;     // 0-100: Compassion, cooperation
  neuroticism: number;       // 0-100: Emotional instability
  confidence: number;        // How confident the detection is
}

export function analyzePersonality(texts: string[]): BigFiveProfile {
  // Linguistic Inquiry and Word Count (LIWC) style analysis
  // - First person pronouns → lower openness
  // - Positive emotion words → higher extraversion
  // - Certainty words → higher conscientiousness
  // - Negation words → higher neuroticism
  // - Social words → higher agreeableness
}
```

### Emotion Detector (`lib/personality/emotion-detector.ts`)

```typescript
export interface EmotionState {
  primary: 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'neutral';
  intensity: number;  // 0-100
  valence: number;    // -100 to 100 (negative to positive)
  arousal: number;    // 0-100 (calm to excited)
}

export function detectEmotion(text: string): EmotionState {
  // Sentiment analysis + emotion classification
}
```

---

## Phase 4: Dynamic System Prompt

### Prompt Builder (`lib/prompt/dynamic-builder.ts`)

```typescript
export function buildCompanionPrompt(
  soulprint: SoulPrintData,
  memories: string[],
  personality: BigFiveProfile,
  emotion: EmotionState,
  userPersonality: BigFiveProfile
): string {
  return `You are ${soulprint.name}'s SoulPrint companion - their AI best friend.

=== WHO THEY ARE (from 36 Questions) ===
${formatSoulprint(soulprint)}

=== WHAT YOU REMEMBER ABOUT THEM ===
${memories.join('\n')}

=== THEIR PERSONALITY (detected from conversations) ===
- Openness: ${userPersonality.openness}% (${describeOpenness(userPersonality.openness)})
- Conscientiousness: ${userPersonality.conscientiousness}%
- Extraversion: ${userPersonality.extraversion}%
- Agreeableness: ${userPersonality.agreeableness}%
- Emotional Stability: ${100 - userPersonality.neuroticism}%

=== CURRENT EMOTIONAL STATE ===
They seem ${emotion.primary} (intensity: ${emotion.intensity}%)

=== HOW TO RESPOND ===
- Match their communication style (${soulprint.communication_style})
- Be ${emotion.primary === 'sadness' ? 'extra supportive' : 'engaged and warm'}
- Remember: You KNOW them. You're not a generic AI.
- Use their name naturally
- Reference past conversations when relevant
- Be a best friend, not an assistant`;
}
```

---

## Phase 5: Fine-Tuning Pipeline

### Data Collection Schema

```typescript
// lib/finetuning/collector.ts

interface TrainingExample {
  id: string;
  user_id: string;
  timestamp: string;

  // Input context
  soulprint_summary: string;
  memories_used: string[];
  detected_personality: BigFiveProfile;
  detected_emotion: EmotionState;

  // Conversation
  user_message: string;
  assistant_response: string;

  // Quality signals
  user_continued: boolean;      // Did user engage further?
  session_length: number;       // How long was the session?
  sentiment_shift: number;      // Did user mood improve?
}

export async function logTrainingExample(example: TrainingExample) {
  await supabase.from('finetuning_data').insert(example);
}
```

### Export for Training

```bash
# Export to JSONL for fine-tuning
node scripts/export-finetuning-data.js --format sharegpt --output training.jsonl
```

### Fine-Tuning Command (Future)

```bash
# On AWS p4d.24xlarge
torchrun --nproc_per_node=8 \
  -m axolotl.cli.train configs/soulprint-72b-finetune.yaml
```

---

## File Structure (New Files)

```
lib/
├── aws/
│   └── vllm-client.ts          # AWS vLLM client (OpenAI-compatible)
├── mem0/
│   └── client.ts               # mem0 integration
├── personality/
│   ├── big-five-detector.ts    # Personality analysis
│   ├── emotion-detector.ts     # Emotion recognition
│   └── style-matcher.ts        # Communication style matching
├── prompt/
│   └── dynamic-builder.ts      # Dynamic system prompt
├── finetuning/
│   └── collector.ts            # Training data collection
└── compete/
    └── orchestrator.ts         # Main chat orchestrator

infrastructure/
├── aws/
│   ├── main.tf                 # Terraform config
│   ├── setup.sh                # vLLM setup script
│   └── variables.tf            # Configuration
└── docker/
    └── vllm.dockerfile         # Docker for vLLM (optional)

app/api/
└── v2/
    └── chat/
        └── completions/
            └── route.ts        # New compete-stack endpoint
```

---

## Integration Points

### 1. Chat Client Update

```typescript
// app/dashboard/chat/chat-client.tsx

// Change API endpoint from /api/gemini/chat to /api/v2/chat/completions
const response = await fetch('/api/v2/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({ messages })
});
```

### 2. Unified Client Hierarchy

```typescript
// lib/llm/unified-client.ts

// Priority order:
// 1. AWS vLLM (Qwen 72B) - primary
// 2. Local LLM (if running) - dev fallback
// 3. Gemini - cost fallback
// 4. OpenAI - last resort
```

### 3. Memory Sync

```typescript
// On each message:
// 1. Query mem0 for relevant memories
// 2. After response, extract new facts
// 3. Add to mem0
// 4. Also update legacy soulprint_memory for backward compat
```

---

## Environment Variables

```env
# AWS LLM
AWS_LLM_ENDPOINT=https://llm.soulprint.ai
AWS_LLM_API_KEY=sk-soulprint-internal-xxx

# mem0
MEM0_API_KEY=xxx
# Or self-hosted:
MEM0_SELF_HOSTED_URL=http://localhost:8080

# Feature flags
ENABLE_COMPETE_STACK=true
ENABLE_PERSONALITY_DETECTION=true
ENABLE_EMOTION_DETECTION=true
ENABLE_FINETUNING_LOGGING=true
```

---

## Rollout Strategy

1. **Deploy AWS infrastructure** (g5.48xlarge + vLLM)
2. **Create /api/v2/chat/completions** with feature flag
3. **Test with internal users**
4. **A/B test** compete stack vs current
5. **Full rollout** when metrics confirm improvement

---

## Success Metrics

| Metric | Current (Gemini) | Target (Compete) |
|--------|------------------|------------------|
| Response quality (1-5) | ~3.5 | 4.5+ |
| User session length | 5 min | 15+ min |
| Return rate (7-day) | 20% | 50%+ |
| "Feels like a friend" | 30% | 70%+ |

---

## Cost Summary

| Component | Monthly Cost |
|-----------|--------------|
| g5.48xlarge (with scaling) | ~$4,000-8,000 |
| mem0 (managed) | ~$50-200 |
| Supabase (current) | ~$25 |
| Fine-tuning runs | ~$500-2000/run |
| **Total** | **~$5,000-10,000/mo** |

---

## Next Steps (Execute Now)

1. [ ] Create AWS infrastructure files
2. [ ] Build vLLM client
3. [ ] Integrate mem0
4. [ ] Create personality detection
5. [ ] Create emotion detection
6. [ ] Build dynamic prompt builder
7. [ ] Create fine-tuning collector
8. [ ] Wire up new chat endpoint
9. [ ] Test end-to-end

---

*Spec created: January 2026*
*Target: Production-ready in one session*
