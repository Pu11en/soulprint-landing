# SoulPrint

## What This Is

An AI companion platform that captures a user's psychological identity and creates an AI that speaks, thinks, and responds exactly like them. Not a chatbot - a personality mirror. The AI IS the user (their higher self), indistinguishable from the real person in conversation.

## Core Value

The AI must be indistinguishable from the real person - users should recognize themselves, others can't tell it's AI, and it genuinely feels like them.

## Requirements

### Validated

- ✓ 36-question questionnaire flow (6 pillars x 6 questions each) — existing
- ✓ Questionnaire UI with slider, text, and voice inputs — existing
- ✓ Voice recording infrastructure — existing
- ✓ Voice transcription via AssemblyAI — existing
- ✓ Basic prosody/cadence analysis — existing
- ✓ Chat interface — existing
- ✓ User authentication via Supabase — existing
- ✓ SoulPrint storage in PostgreSQL — existing
- ✓ Basic SoulPrint generation — existing (needs replacement)

### Active

- [ ] Research: Evaluate LLMs for personality mimicry (not locked to any provider)
- [ ] Research: Study companion app repos (a16z, Hukasx0, MimickMyStyle, AvrilAI, ChatPsychiatrist)
- [ ] Research: Evaluate psychological frameworks for personality capture
- [ ] Better SoulPrint generator: Improved prompts, deeper personality capture
- [ ] Better chat: New LLM + improved system prompt + responses that sound like user

### Out of Scope

- Micro-story generator — v2, after core works
- Story reading flow — v2, after core works
- Emotional signature extraction from voice — v2, after core works
- Memory system rebuild — v2, current memory sufficient for MVP
- User API keys for external apps — v2, no immediate use case
- Voice bot / voice chat — future, after text works perfectly
- AWS self-hosting — future, when scale justifies
- Mobile app — future
- Fine-tuned model — future

## Context

**Existing codebase:** Brownfield project with working questionnaire, voice recording, chat interface, and basic SoulPrint generation. The current implementation uses Gemini but produces generic, shallow results. Need to redesign the generation approach from scratch.

**6 Psychological Pillars (current structure, may change based on research):**
1. Communication Style — how they speak, write, pace
2. Emotional Alignment — emotional range, triggers, comforts
3. Decision-Making & Risk — gut vs analysis, risk tolerance
4. Social & Cultural Identity — networks, norms, beliefs
5. Cognitive Processing — how their brain works, learning style
6. Assertiveness & Conflict — how they handle tension

**Tech stack:** Next.js 16, React 19, TypeScript, Tailwind, Supabase, AssemblyAI. Current LLM (Gemini) to be replaced based on research.

**Repos to study:**
- a16z/companion-app — memory system, personality injection
- Hukasx0/ai-companion — long-term memory, real-time learning
- MimickMyStyle_LLM — writing style mimicry approach
- MrReplikant/AvrilAI — user-controlled personality
- EmoCareAI/ChatPsychiatrist — emotional support patterns

## Constraints

- **Quality**: Results must be indistinguishable from real person — non-negotiable
- **LLM Provider**: Open to evaluation — not locked to any provider
- **Infrastructure**: AWS self-hosting desired eventually, but hosted API fine for now

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Start fresh on SoulPrint generator | Current approach too generic, bad prompts, shallow | — Pending |
| Research before building | Quality is priority, need to find best approach | — Pending |
| LLM provider open | Don't lock in until evaluated for personality mimicry | — Pending |
| Defer micro-stories/voice analysis to v2 | Focus on core working first | — Pending |
| Test on self first | Quick validation before broader testing | — Pending |

---
*Last updated: 2026-01-13 after initialization*
