# Requirements: SoulPrint v2.0 AI Quality & Personalization

**Defined:** 2026-02-08
**Core Value:** The AI must feel like YOUR AI -- genuinely human, deeply personalized, systematically evaluated.

## v2.0 Requirements

Requirements for the AI Quality & Personalization milestone. Each maps to roadmap phases.

### Evaluation

- [ ] **EVAL-01**: Opik evaluation datasets exist for personality consistency, factuality, and tone matching
- [ ] **EVAL-02**: LLM-as-judge scoring rubrics evaluate prompt quality with >70% human agreement
- [ ] **EVAL-03**: Experiment runner can compare prompt variants with aggregate scores
- [ ] **EVAL-04**: Baseline metrics are recorded for current v1 prompt system before any changes

### Prompts

- [ ] **PRMT-01**: System prompts use natural voice (flowing personality primer) instead of technical markdown headers
- [ ] **PRMT-02**: Prompt template system supports versioned swap (v1-technical / v2-natural-voice via env var)
- [ ] **PRMT-03**: Next.js and RLM prompt builders produce identical output for same sections
- [ ] **PRMT-04**: Personality instructions are reinforced after RAG memory retrieval (not overridden by chunks)

### Emotional Intelligence

- [ ] **EMOT-01**: AI detects user frustration, satisfaction, and confusion from text patterns and adapts response style
- [ ] **EMOT-02**: AI acknowledges uncertainty explicitly ("I don't have enough info about X") instead of hallucinating
- [ ] **EMOT-03**: Relationship arc adapts tone based on conversation history depth (cautious early, confident later)

### Quality

- [ ] **QUAL-01**: Each soulprint section is scored 0-100 for data quality (completeness, coherence, specificity)
- [ ] **QUAL-02**: Quality scores are surfaced in system prompt so AI knows its own data confidence
- [ ] **QUAL-03**: Low-quality soulprints are flagged for automated refinement

### Validation

- [ ] **VALD-01**: Prompt regression test suite catches personality degradation before deploy
- [ ] **VALD-02**: Long-session testing (10+ messages) validates no uncanny valley or personality drift
- [ ] **VALD-03**: Async observability adds <100ms P95 latency overhead

## v2.1 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Linguistic Mirroring

- **LING-01**: User's formality level, emoji usage, humor style, and sentence structure are extracted from ChatGPT export
- **LING-02**: AI mirrors user's linguistic patterns in responses (gradual adaptation over 3-4 exchanges)
- **LING-03**: Linguistic profile is refined incrementally during chat conversations

### Memory Narrative

- **MNAR-01**: Memory context is presented as flowing narrative paragraphs instead of bullet lists
- **MNAR-02**: Signature greeting from identity section is used on first message of each session

### Adaptive Depth

- **ADPT-01**: AI enforces depth preference (brief vs detailed) from tools section more strongly

## v2.2+ Requirements

Deferred to future release.

### Iterative Refinement

- **REFN-01**: Soulprint updates automatically from new conversations (with drift detection)
- **REFN-02**: Conversation-level topic shift detection adjusts tone dynamically

### User Controls

- **CTRL-01**: User can view and edit specific memories
- **CTRL-02**: A/B testing framework for prompt variations with statistical significance

## Out of Scope

| Feature | Reason |
|---------|--------|
| NLP libraries (winkNLP, compromise) | LLM-based extraction more accurate and maintainable |
| Sentiment analysis libraries | Claude has native emotional intelligence via prompts |
| Alternative eval frameworks (DeepEval, RAGAS) | Opik already integrated and sufficient |
| Real-time soulprint updates during chat | Causes personality drift -- research pitfall #1 |
| Perfect linguistic mimicry | Uncanny valley -- research pitfall #3 |
| Exposed evaluation scores to users | Gamification anxiety -- UX pitfall |
| Model picker / persona switching | Dilutes core SoulPrint value |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EVAL-01 | - | Pending |
| EVAL-02 | - | Pending |
| EVAL-03 | - | Pending |
| EVAL-04 | - | Pending |
| PRMT-01 | - | Pending |
| PRMT-02 | - | Pending |
| PRMT-03 | - | Pending |
| PRMT-04 | - | Pending |
| EMOT-01 | - | Pending |
| EMOT-02 | - | Pending |
| EMOT-03 | - | Pending |
| QUAL-01 | - | Pending |
| QUAL-02 | - | Pending |
| QUAL-03 | - | Pending |
| VALD-01 | - | Pending |
| VALD-02 | - | Pending |
| VALD-03 | - | Pending |

**Coverage:**
- v2.0 requirements: 16 total
- Mapped to phases: 0
- Unmapped: 16 (pending roadmap creation)

---
*Requirements defined: 2026-02-08*
*Last updated: 2026-02-08 after user approval*
