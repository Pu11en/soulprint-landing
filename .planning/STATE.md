# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-08)

**Core value:** The AI must feel like YOUR AI -- genuinely human, deeply personalized, systematically evaluated.

**Current focus:** Phase 3 - Emotional Intelligence (IN PROGRESS)

## Current Position

Phase: 3 of 5 (Emotional Intelligence)
Plan: 1 of 3 in phase
Status: In progress
Last activity: 2026-02-09 - Completed 03-01-PLAN.md (Emotional Intelligence Foundation)

Progress: [█████████░] 85% (Phases 1-2 complete, 1/3 plans in Phase 3)

## Performance Metrics

**Velocity:**
- Total plans completed: 52 (from v1.0-v2.0)
- Average duration: ~19 min
- Total execution time: ~21.10 hours across 6 milestones

**By Milestone:**

| Milestone | Phases | Plans | Status |
|-----------|--------|-------|--------|
| v1.0 MVP | 1 | 1 | Shipped |
| v1.1 Stabilization | 7 | 22 | Shipped |
| v1.2 Import UX | 3 | 9 | Shipped |
| v1.3 RLM Sync | 5 | 5 | Shipped |
| v1.4 Personalization | 2 | 7 | Shipped |
| v1.5 Full Chat | 6 | 8 | Shipped |
| v2.0 AI Quality | 5 | 5 | In Progress |

*Metrics updated: 2026-02-09*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

**Carried forward from v1.5:**
- Separate soulprint-rlm repo -- Production RLM deploys from Pu11en/soulprint-rlm
- Sonnet 4.5 on Bedrock for chat quality (switched from Nova Lite)
- OpenClaw-style prompt: minimal preamble, sections define personality
- Two-pass generation: quick pass (~30s, Haiku 4.5) + full pass (RLM background)
- 7-section structured context (SOUL, IDENTITY, USER, AGENTS, TOOLS, MEMORY, daily memory)

**v2.0 Architecture decisions:**
- Evaluation-first approach: build measurement before changing prompts
- Phase 1 -> Phase 2 dependency: need metrics before prompt changes
- Phases 3 and 4 can run in parallel after Phase 2

**From 01-01 (Evaluation Core Library):**
- ChatEvalItem uses index signature for Opik DatasetItemData compatibility
- zod v4 z.record() requires two args (key type + value type)
- Minimum 10 valid pairs enforced for dataset statistical significance
- BaseMetric extension pattern: validationSchema + score with safeParse guard

**From 01-02 (Experiment Runner & CLI Scripts):**
- V1 prompt builder copied inline in baseline.ts (not extracted from chat route) to freeze baseline snapshot
- Array.from(Map.entries()) pattern for ES2017 target compatibility
- PromptVariant interface: { name, buildSystemPrompt } for pluggable prompt strategies
- CLI scripts use DOTENV_CONFIG_PATH=.env.local with import dotenv/config

**From 02-01 (PromptBuilder Class):**
- PromptBuilder uses PromptParams object pattern (not positional args) for extensibility
- v2 personality sections use flowing prose, only functional sections use ## headers
- v2 section ordering: USER before AGENTS/IDENTITY, CONTEXT before REMEMBER
- getPromptVersion() exported standalone for testing/logging without instantiating builder
- PRMT-04 pattern: behavioral_rules from agents_md reinforced in ## REMEMBER after ## CONTEXT

**From 02-02 (Cross-Language Prompt Sync):**
- Python PromptBuilder mirrors TypeScript character-for-character for v1, v2, and imposter mode
- Injectable currentDate/currentTime params added to TypeScript PromptParams for deterministic testing
- Python _parse_section_safe handles both dict and JSON string inputs
- _sections_to_profile helper bridges legacy sections dict to PromptBuilder profile format
- JSON blob serialization pattern for subprocess param passing avoids shell escaping issues

**From 02-03 (Wire v2 to Evaluation):**
- v2 builder uses simplified PromptParams (no dailyMemory/memoryContext) for style comparison
- recordBaseline() accepts optional variant parameter (non-breaking change, defaults to v1)
- v1 baseline remains frozen (not refactored to use PromptBuilder) for historical accuracy
- ChatEvalItem structured sections JSON.stringify into PromptBuilder *_md fields
- VARIANTS map in CLI scripts for variant registry and name-based selection

**From 03-01 (Emotional Intelligence Foundation):**
- Haiku 4.5 on Bedrock for emotion detection (fast, cheap, 150 max tokens, temp 0.2)
- Fail-safe neutral default on any detection error (never crash chat)
- Confidence threshold 0.6 for adaptive tone application (avoid low-confidence misclassification)
- Adaptive tone goes LAST in prompt composition (base → uncertainty → relationship → adaptive)
- Relationship arc thresholds: early (<10), developing (10-50), established (50+)
- Dynamic temperature ranges: factual (0.2), confused (0.25), creative (0.8), default (0.7)
- EmotionallyIntelligentPromptParams extends PromptParams for backward compatibility

### Pending Todos

- Run `scripts/rls-audit.sql` in Supabase SQL Editor (from v1.1 Phase 4)

### Blockers/Concerns

**For v2.0 planning:**
- Phase 3 needs uncanny valley threshold research (how much mirroring is too much)
- Quality scoring metrics need validation that they correlate r>0.7 with user satisfaction

**Carried forward from v1.5:**
- Web search (smartSearch) exists but citations not validated against hallucination

## Session Continuity

Last session: 2026-02-09
Stopped at: Completed 03-01-PLAN.md (Emotional Intelligence Foundation)
Resume file: None

---
*Last updated: 2026-02-09 -- Phase 3 Plan 1 COMPLETE (Emotion detection, relationship arc, adaptive tone foundation)*
