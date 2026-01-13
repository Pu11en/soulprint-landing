# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-13)

**Core value:** The AI must be indistinguishable from the real person
**Current focus:** Phase 2 — LLM Integration (Plan 01 complete)

## Current Position

Phase: 2 of 6 (LLM Integration)
Plan: 02-01 in progress (deployment step incomplete)
Status: **BLOCKED** - SageMaker JumpStart deployment not completing
Last activity: 2026-01-13 — Deployment attempted, not finishing

Progress: ██░░░░░░░░ 15%

### HANDOFF: What Needs to Happen

The LLM deployment to SageMaker is not working. Multiple approaches tried:

1. **Custom container (TGI)** - Container health check failed
2. **JumpStart (current attempt)** - Script runs but no AWS resources created after 20+ min

**Options for next AI:**
1. Debug JumpStart deployment (`scripts/deploy-jumpstart.py`)
2. Use AWS Bedrock instead (simpler, no deployment needed)
3. Use external provider (OpenRouter, Together.ai) as fallback

## Performance Metrics

**Velocity:**
- Total plans completed: 1
- Average duration: ~30 min
- Total execution time: 0.5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 2 | 1 | 30 min | 30 min |

**Recent Trend:**
- Last 5 plans: 02-01 (30 min)
- Trend: —

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Start fresh on SoulPrint generator (current approach too generic)
- Research before building (quality is priority)
- **LLM choice:** Llama 3.3 70B for production, 13B models for development
- **Hosting:** AWS SageMaker with vLLM
- **Personality framework:** Big Five (OCEAN) + LIWC analysis
- **Memory pattern:** a16z-style (preamble + profile + vector memory)
- **Dev model:** Hermes-2-Pro-Llama-3-8B on g5.xlarge (~$24/day)

### Deferred Issues

None yet.

### Blockers/Concerns

- Need SageMaker execution role before deploying model
- Need GPU quota (ml.g5.xlarge) approved

## Session Continuity

Last session: 2026-01-13
Stopped at: SageMaker deployment blocked - JumpStart not creating resources
Resume file: .planning/STATE.md (this file)
Next: Choose different approach - Bedrock or external provider recommended

### Files Created This Session

- `scripts/deploy-jumpstart.py` - JumpStart deployment (not working)
- `scripts/deploy-sagemaker.ts` - TypeScript deployment attempt
- `scripts/cleanup-sagemaker.ts` - Cleanup script
- `scripts/check-status.ts` - Status checker
- `lib/aws/sagemaker.ts` - SageMaker client (working)
- `app/api/llm/chat/route.ts` - API endpoint (needs working endpoint)

### AWS Config in .env.local

```
AWS_ACCESS_KEY_ID=AKIA36MTOXRJLGJFX2EH
AWS_SECRET_ACCESS_KEY=<set>
AWS_REGION=us-east-1
SAGEMAKER_ENDPOINT_NAME=soulprint-llm
SAGEMAKER_EXECUTION_ROLE_ARN=arn:aws:iam::821184871506:role/soulprint-sagemaker-execution-role
```
