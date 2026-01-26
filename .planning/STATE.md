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

**UPDATE 2026-01-25:** SageMaker is NOT needed! The codebase already supports AWS Bedrock.

The LLM client (`lib/llm/local-client.ts`) has smart fallback:
1. **AWS Bedrock** (PRODUCTION) ← Ready to use!
2. **SageMaker** (Legacy) ← Skip this
3. **Ollama** (Local dev) ← Works for offline

**To unblock Phase 2 with Bedrock (SIMPLER PATH):**
1. Go to AWS Bedrock Console (us-east-1)
2. Enable model access for `anthropic.claude-3-5-haiku-20241022-v2:0`
3. Add to Vercel env vars: `BEDROCK_MODEL_ID=anthropic.claude-3-5-haiku-20241022-v2:0`
4. Deploy - done!

The research recommended self-hosted Llama for cost, but Bedrock/Claude:
- No infrastructure to manage
- Pay-per-token (cheaper to start)
- Already integrated in code
- Can switch to Llama later for scale

**Original SageMaker attempts (for reference):**
1. Custom container (TGI) - Container health check failed
2. JumpStart - Script runs but no AWS resources created

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
AWS_ACCESS_KEY_ID=<redacted>
AWS_SECRET_ACCESS_KEY=<redacted>
AWS_REGION=us-east-1
SAGEMAKER_ENDPOINT_NAME=soulprint-llm
SAGEMAKER_EXECUTION_ROLE_ARN=arn:aws:iam::<account-id>:role/<role-name>
```

**Note:** Real credentials should NEVER be stored in planning documents. See AWS console for actual values.
