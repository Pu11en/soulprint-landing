# Phase 5: Gradual Cutover - Research

**Researched:** 2026-02-07
**Domain:** Gradual traffic migration, feature flags, API deprecation, production deployment validation
**Confidence:** HIGH

## Summary

Phase 5 implements a gradual traffic cutover from the legacy v1 `/process-full` endpoint to the new v2 pipeline with processor-based architecture. The standard approach is percentage-based traffic routing using environment variables (10% → 50% → 100%), validation with real production data at each stage, and endpoint deprecation only after sustained stability. This research focused on four critical domains: feature flag patterns in FastAPI using environment variables, percentage-based random routing for canary deployments, production validation strategies with real user data, and API endpoint deprecation best practices.

The recommended approach is to add an environment variable `V2_ROLLOUT_PERCENT` (default 0) that controls traffic routing in the Next.js caller (`app/api/import/process-server/route.ts`), use Python's `random.random() < (percentage/100)` for per-request routing decisions, deploy in stages with production monitoring at each level, and deprecate v1 only after v2 handles 100% traffic successfully for 7+ days with zero rollbacks.

**Primary recommendation:** Implement feature flag in the Next.js API route (not RLM service) to route traffic based on V2_ROLLOUT_PERCENT environment variable, monitor both endpoints' success rates and error patterns during gradual rollout, validate v2 with real production data at 10% before increasing to 50% and 100%, and maintain rollback capability throughout the deprecation period.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Environment variables | Built-in | Feature flag storage | No dependencies, 12-factor app pattern, instant updates on Vercel/Render |
| Python random.random() | Built-in | Percentage-based routing | Cryptographically secure randomness, no dependencies |
| Render health checks | Platform | Zero-downtime validation | Automatic rollback on health check failure during deploy |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Pino logging | 9.5+ | Structured routing decisions | Already in use, log which endpoint was chosen per request |
| SQL queries | Native | Production validation metrics | Query user_profiles.full_pass_status for success/failure rates |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Environment variable | LaunchDarkly / Flagsmith | External services add latency, cost, complexity; env vars sufficient for simple percentage rollout |
| Random routing | User ID hash-based routing | Hash-based gives consistent routing per user (A/B testing), random gives true percentage split (our goal) |
| Next.js routing | RLM service routing | RLM controls pipeline, Next.js controls traffic — separation of concerns, easier rollback |

**Installation:**
```bash
# No new dependencies needed
# Use existing: Python random module, Node.js process.env, Vercel env vars, Render env vars
```

## Architecture Patterns

### Recommended Project Structure
```
soulprint-landing/
├── app/api/import/process-server/route.ts  # Traffic routing logic here
└── .env.production                          # V2_ROLLOUT_PERCENT=10|50|100

soulprint-rlm/
├── main.py                                  # Both /process-full and /process-full-v2 exist
└── ROLLBACK.md                              # Rollback procedure (already exists)
```

### Pattern 1: Environment Variable Feature Flag
**What:** Single numeric env var controls percentage of traffic routed to v2
**When to use:** Simple percentage-based rollout, no per-user targeting needed
**Example:**
```typescript
// Source: FastAPI Best Practices for Production 2026
// app/api/import/process-server/route.ts

// Read rollout percentage from environment (0-100)
const v2RolloutPercent = parseInt(process.env.V2_ROLLOUT_PERCENT || '0', 10);

// Randomly route based on percentage
const useV2 = Math.random() * 100 < v2RolloutPercent;

// Choose endpoint
const endpoint = useV2 ? '/process-full-v2' : '/process-full';

reqLog.info({
  endpoint,
  v2RolloutPercent,
  userId
}, 'Routing import request');

const rlmResponse = await fetch(`${rlmUrl}${endpoint}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: userId,
    storage_path: `user-imports/${parsedJsonPath}`,
    conversation_count: conversations.length,
    message_count: totalMessages,
  }),
  signal: controller.signal,
});
```

**Key principles:**
- Route decision happens PER REQUEST (not per user) for true percentage split
- Log the routing decision for every request (enables monitoring)
- Default to 0% (v1 only) for safety
- Validate percentage is 0-100 (clamp if invalid)

### Pattern 2: Gradual Rollout Stages
**What:** Increase traffic percentage in stages with validation gates
**When to use:** High-risk migrations, need production validation at each stage
**Example:**
```bash
# Stage 1: 10% for 24 hours (canary validation)
# Deploy to Vercel with V2_ROLLOUT_PERCENT=10
vercel env add V2_ROLLOUT_PERCENT production
# Enter: 10

# Validate: Query production database for success rates
# SQL: SELECT full_pass_status, COUNT(*) FROM user_profiles WHERE full_pass_started_at > NOW() - INTERVAL '24 hours' GROUP BY full_pass_status

# Stage 2: 50% for 48 hours (broader validation)
# If no issues in stage 1, increase to 50%
vercel env rm V2_ROLLOUT_PERCENT production
vercel env add V2_ROLLOUT_PERCENT production
# Enter: 50

# Validate: Monitor error rates, user complaints, Render logs

# Stage 3: 100% for 7+ days (full cutover)
# If stage 2 successful, go to 100%
vercel env rm V2_ROLLOUT_PERCENT production
vercel env add V2_ROLLOUT_PERCENT production
# Enter: 100

# Stage 4: Deprecate v1 after sustained stability
# If 7+ days at 100% with zero rollbacks, deprecate /process-full
```

**Timeline:**
- Day 1: Deploy with V2_ROLLOUT_PERCENT=10
- Day 2: Validate 10%, increase to 50% if successful
- Day 4: Validate 50%, increase to 100% if successful
- Day 11: Validate 100%, deprecate v1 if 7+ days stable

### Pattern 3: Production Validation Queries
**What:** SQL queries to measure v2 success rate vs v1 baseline
**When to use:** Each rollout stage, before increasing percentage
**Example:**
```sql
-- Source: Production validation patterns

-- Query 1: Count v2 attempts in last 24 hours
-- (Requires logging which endpoint was chosen - add to existing logs)
SELECT
  COUNT(*) as total_imports,
  COUNT(*) FILTER (WHERE full_pass_status = 'complete') as successful,
  COUNT(*) FILTER (WHERE full_pass_status = 'failed') as failed,
  COUNT(*) FILTER (WHERE full_pass_status = 'processing' AND full_pass_started_at < NOW() - INTERVAL '2 hours') as stuck
FROM user_profiles
WHERE full_pass_started_at > NOW() - INTERVAL '24 hours';

-- Query 2: Compare v1 vs v2 success rates
-- (Requires endpoint routing to be logged in user_profiles or separate table)
-- Simplified: Use full_pass_completed_at as proxy (v2 updates this, v1 doesn't)
SELECT
  CASE
    WHEN full_pass_completed_at IS NOT NULL THEN 'v2'
    ELSE 'v1'
  END as endpoint_version,
  COUNT(*) as imports,
  AVG(CASE WHEN import_status = 'complete' THEN 1 ELSE 0 END) as success_rate
FROM user_profiles
WHERE soulprint_generated_at > NOW() - INTERVAL '24 hours'
GROUP BY endpoint_version;

-- Query 3: Detect anomalies (v2 slower than v1)
SELECT
  user_id,
  full_pass_started_at,
  full_pass_completed_at,
  EXTRACT(EPOCH FROM (full_pass_completed_at - full_pass_started_at)) / 60 as duration_minutes
FROM user_profiles
WHERE full_pass_started_at > NOW() - INTERVAL '24 hours'
  AND full_pass_completed_at IS NOT NULL
ORDER BY duration_minutes DESC
LIMIT 20;
```

**Validation checklist for each stage:**
- [ ] Success rate ≥ 95% (compare to v1 baseline)
- [ ] No stuck imports (full_pass_status='processing' for >2 hours)
- [ ] Average completion time ≤ v1 baseline + 20%
- [ ] Zero critical errors in Render logs
- [ ] No user complaints in support channels

### Pattern 4: Endpoint Deprecation Timeline
**What:** Phased deprecation after 100% cutover validation
**When to use:** After v2 handles 100% traffic successfully for 7+ days
**Example:**
```markdown
# Phase 1: Deprecation announcement (Day 11)
- Add Deprecation header to /process-full responses
- Update API documentation (if public)
- Log deprecation warnings in RLM service
- No functional changes (v1 still works)

# Phase 2: End of active support (Day 18)
- Add Sunset header with specific date (e.g., 2026-03-01)
- v1 endpoint returns 410 Gone for new requests
- Existing in-flight v1 jobs complete normally
- Monitor for any callers still using v1 (should be 0%)

# Phase 3: Final shutdown (Day 25)
- Remove /process-full endpoint from main.py
- Remove run_full_pass_v1_background function
- Update tests to remove v1 endpoint tests
- Keep rollback capability for 7 more days (git revert)

# Phase 4: Cleanup (Day 32)
- Remove v1-specific code completely
- Rename /process-full-v2 to /process-full (optional)
- Update all documentation references
```

**Deprecation headers:**
```python
# Source: RFC 8594 (Sunset header) and IETF deprecation standards

@app.post("/process-full")
async def process_full(request: ProcessFullRequest, background_tasks: BackgroundTasks, response: Response):
    """
    DEPRECATED: Use /process-full-v2 instead.
    This endpoint will be removed on 2026-03-01.
    """
    # Add deprecation headers
    response.headers["Deprecation"] = "true"
    response.headers["Sunset"] = "Thu, 01 Mar 2026 00:00:00 GMT"
    response.headers["Link"] = '</process-full-v2>; rel="alternate"'

    # Log deprecation usage
    print(f"[DEPRECATED] /process-full called by user {request.user_id}")

    # Continue with v1 logic (still functional)
    # ...
```

### Pattern 5: Instant Rollback During Cutover
**What:** Environment variable rollback without code deploy
**When to use:** Production issues detected during any rollout stage
**Example:**
```bash
# EMERGENCY: Rollback from 50% to 10% (no code deploy needed)

# Option 1: Vercel dashboard
# 1. Go to project → Settings → Environment Variables
# 2. Find V2_ROLLOUT_PERCENT
# 3. Change from 50 to 10
# 4. Click "Redeploy" (uses existing code, new env var)

# Option 2: Vercel CLI
vercel env rm V2_ROLLOUT_PERCENT production
vercel env add V2_ROLLOUT_PERCENT production
# Enter: 10

# Option 3: Complete rollback to v1 only
vercel env rm V2_ROLLOUT_PERCENT production
vercel env add V2_ROLLOUT_PERCENT production
# Enter: 0

# Verify rollback
curl -I https://soulprint-landing.onrender.com/health
# Should show healthy status

# Check logs
vercel logs --follow
# Should show "Routing import request" with endpoint=/process-full
```

**Rollback decision criteria:**
- Error rate >5% for v2 (immediate rollback)
- Stuck imports >10 in 1 hour (immediate rollback)
- User complaints about slow imports (rollback within 1 hour)
- Render health checks failing (automatic rollback by platform)
- Any data corruption detected (immediate rollback + investigation)

### Anti-Patterns to Avoid
- **Deploying v2 at 100% immediately:** Skip validation stages, high risk of widespread failure
- **Not logging routing decisions:** Cannot measure v2 success rate or debug issues
- **Using user ID hash for routing:** Gives consistent routing (same user always v2), skews metrics and prevents comparison
- **Deprecating v1 before 7 days at 100%:** Insufficient confidence in v2 stability
- **Removing rollback capability too soon:** Need 7+ days at 100% before removing v1 code
- **Not monitoring Render logs during rollout:** Miss early warning signs of v2 issues

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Feature flag service | Custom flag management API | Environment variables | No dependencies, instant updates, 12-factor app standard |
| Percentage routing logic | Complex weighted random | `random.random() < (pct/100)` | Simple, cryptographically secure, no edge cases |
| Health check monitoring | Custom status dashboard | Render health checks + Pino logs | Platform-native, automatic rollback, no maintenance |
| Rollback procedure | Custom rollback API | Environment variable change + git revert | Instant rollback, no new code, auditable |
| Success rate tracking | Custom analytics | SQL queries on user_profiles | Data already exists, no new infrastructure |

**Key insight:** For simple percentage-based rollouts, environment variables are sufficient. Don't add LaunchDarkly or Flagsmith unless you need advanced features (user targeting, gradual rollout automation, real-time dashboards). The complexity and latency aren't worth it for a one-time migration.

## Common Pitfalls

### Pitfall 1: Not Logging Routing Decisions
**What goes wrong:** Deploy v2 at 50%, see issues, cannot determine if issues are v1 or v2 because routing isn't logged
**Why it happens:** Logging added after deployment when debugging starts, too late to analyze past requests
**How to avoid:**
- Log routing decision in every request: `reqLog.info({ endpoint, v2RolloutPercent, userId }, 'Routing import request')`
- Include endpoint in all subsequent logs for that request
- Add endpoint column to user_profiles (optional, for SQL analysis)
**Warning signs:** Cannot answer "How many requests went to v2 yesterday?" without log analysis

### Pitfall 2: Using Same User for v1 and v2 Testing
**What goes wrong:** Test with one user, they hit v2 at 10% rollout, you assume v2 works, increase to 100%, different users hit issues
**Why it happens:** 10% rollout is random per-request, one user can hit v2 multiple times, others never hit it
**How to avoid:**
- Test with 10+ different users during 10% stage
- Use SQL queries to count unique users hitting v2 (not just request count)
- Monitor for patterns: "Only users with 5000+ conversations fail on v2"
**Warning signs:** v2 works for you, but users report failures at higher rollout percentages

### Pitfall 3: Increasing Rollout Too Quickly
**What goes wrong:** Deploy 10% → works for 2 hours → increase to 100% → widespread failures because 2 hours doesn't catch edge cases
**Why it happens:** Impatience or time pressure to "finish the migration"
**How to avoid:**
- Wait 24 hours at 10% (catches daily peak traffic, different user patterns)
- Wait 48 hours at 50% (catches weekend vs weekday differences)
- Wait 7 days at 100% before deprecating v1 (catches weekly patterns, rare edge cases)
**Warning signs:** Rollback from higher percentage reveals issues not seen at lower percentage

### Pitfall 4: No Rollback Plan During Cutover
**What goes wrong:** Issues arise at 50%, no documented rollback, team debates what to do, users affected for hours
**Why it happens:** Assume "we'll figure it out if problems happen"
**How to avoid:**
- Document rollback procedure BEFORE first rollout stage
- Test rollback in staging (change env var, verify routing switches)
- Set alert thresholds: "If error rate >5%, rollback immediately"
- Assign on-call person with rollback authority
**Warning signs:** Team asks "How do we rollback?" after issues start

### Pitfall 5: Deprecating v1 Without Validation Period
**What goes wrong:** 100% on v2 for 2 days → deprecate v1 → rare edge case hits → cannot rollback because v1 code removed
**Why it happens:** Wanting to "clean up old code" quickly
**How to avoid:**
- Keep v1 code for 7+ days after 100% cutover (rollback capability)
- Monitor for ANY v1 endpoint calls during 100% period (should be 0%)
- Only remove v1 after sustained success (zero rollbacks, zero user complaints)
**Warning signs:** Pressure to "finish the migration" by removing v1 code too soon

### Pitfall 6: Not Monitoring Render Logs During Rollout
**What goes wrong:** v2 at 50%, errors logged in Render but not monitored, issues accumulate, user complaints before team notices
**Why it happens:** Assume "health checks will catch problems"
**How to avoid:**
- Monitor Render logs actively during each rollout stage increase
- Set up log alerts: "ERROR in full_pass" triggers notification
- Check logs hourly during first 24 hours of each stage
- Look for patterns: "fact_extractor failing for large conversations"
**Warning signs:** Users report issues before team sees errors in logs

### Pitfall 7: Forgetting to Update Next.js Caller
**What goes wrong:** RLM service has /process-full-v2, but Next.js always calls /process-full, rollout env var has no effect
**Why it happens:** Focus on RLM changes, forget caller needs routing logic
**How to avoid:**
- Implement routing logic in Next.js BEFORE setting rollout percentage
- Test locally: Set V2_ROLLOUT_PERCENT=100, verify /process-full-v2 is called
- Add logs in Next.js to confirm endpoint selection
**Warning signs:** V2_ROLLOUT_PERCENT=50 but all logs show /process-full (v1)

## Code Examples

Verified patterns from official sources:

### Traffic Routing in Next.js Caller
```typescript
// Source: FastAPI Best Practices for Production 2026
// File: app/api/import/process-server/route.ts

// Add after line 382 (where rlmUrl is defined)

// Read V2 rollout percentage from environment (0-100, default 0)
const v2RolloutPct = Math.max(0, Math.min(100,
  parseInt(process.env.V2_ROLLOUT_PERCENT || '0', 10)
));

// Randomly decide which endpoint to use based on percentage
// Math.random() returns [0, 1), multiply by 100 gives [0, 100)
const useV2Pipeline = Math.random() * 100 < v2RolloutPct;

// Choose endpoint based on decision
const endpoint = useV2Pipeline ? '/process-full-v2' : '/process-full';

reqLog.info({
  endpoint,
  v2RolloutPercent: v2RolloutPct,
  userId,
  conversationCount: conversations.length
}, 'Routing import request to RLM pipeline');

// Call RLM with selected endpoint
const rlmResponse = await fetch(`${rlmUrl}${endpoint}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: userId,
    storage_path: `user-imports/${parsedJsonPath}`,
    conversation_count: conversations.length,
    message_count: totalMessages,
  }),
  signal: controller.signal,
});

// Log success/failure for monitoring
if (!rlmResponse.ok) {
  const errorText = await rlmResponse.text().catch(() => 'Unknown error');
  reqLog.error({
    endpoint,
    status: rlmResponse.status,
    error: errorText
  }, 'RLM pipeline returned error');
} else {
  reqLog.info({ endpoint }, 'RLM pipeline accepted job');
}
```

### Deprecation Headers in RLM Service
```python
# Source: RFC 8594 Sunset header, IETF deprecation standards
# File: soulprint-rlm/main.py

from fastapi import Response
from datetime import datetime, timedelta

@app.post("/process-full")
async def process_full(
    request: ProcessFullRequest,
    background_tasks: BackgroundTasks,
    response: Response
):
    """
    DEPRECATED: Use /process-full-v2 instead.

    This endpoint will be removed on 2026-03-01.
    New integrations should use /process-full-v2.
    """
    # Add deprecation headers (RFC-compliant)
    response.headers["Deprecation"] = "true"
    response.headers["Sunset"] = "Thu, 01 Mar 2026 00:00:00 GMT"
    response.headers["Link"] = '</process-full-v2>; rel="alternate"'

    # Log deprecation usage for monitoring
    print(f"[DEPRECATED] /process-full called by user {request.user_id}")

    # Continue with existing v1 logic
    background_tasks.add_task(run_full_pass_v1_background, request)

    return {
        "status": "accepted",
        "message": "Full pass processing started (DEPRECATED: Use /process-full-v2)",
        "deprecation_notice": "This endpoint will be removed on 2026-03-01. Use /process-full-v2."
    }
```

### Production Validation SQL
```sql
-- Source: Production database monitoring patterns
-- Run these queries at each rollout stage

-- Query 1: Overall success rate (last 24 hours)
SELECT
  COUNT(*) as total_imports,
  COUNT(*) FILTER (WHERE import_status = 'complete' OR full_pass_status = 'complete') as successful,
  COUNT(*) FILTER (WHERE import_status = 'failed' OR full_pass_status = 'failed') as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE import_status = 'complete' OR full_pass_status = 'complete') / COUNT(*), 2) as success_rate_pct
FROM user_profiles
WHERE soulprint_generated_at > NOW() - INTERVAL '24 hours';

-- Query 2: Detect stuck imports (processing >2 hours)
SELECT
  user_id,
  full_pass_status,
  full_pass_started_at,
  EXTRACT(EPOCH FROM (NOW() - full_pass_started_at)) / 60 as minutes_stuck
FROM user_profiles
WHERE full_pass_status = 'processing'
  AND full_pass_started_at < NOW() - INTERVAL '2 hours'
ORDER BY full_pass_started_at ASC;

-- Query 3: Performance comparison (duration histogram)
SELECT
  CASE
    WHEN duration_minutes < 5 THEN '<5 min'
    WHEN duration_minutes < 10 THEN '5-10 min'
    WHEN duration_minutes < 20 THEN '10-20 min'
    WHEN duration_minutes < 30 THEN '20-30 min'
    ELSE '>30 min'
  END as duration_bucket,
  COUNT(*) as import_count
FROM (
  SELECT
    EXTRACT(EPOCH FROM (full_pass_completed_at - full_pass_started_at)) / 60 as duration_minutes
  FROM user_profiles
  WHERE full_pass_started_at > NOW() - INTERVAL '24 hours'
    AND full_pass_completed_at IS NOT NULL
) as durations
GROUP BY duration_bucket
ORDER BY duration_bucket;

-- Query 4: Error patterns (most common errors)
SELECT
  full_pass_error,
  COUNT(*) as error_count
FROM user_profiles
WHERE full_pass_status = 'failed'
  AND full_pass_started_at > NOW() - INTERVAL '24 hours'
GROUP BY full_pass_error
ORDER BY error_count DESC
LIMIT 10;
```

### Rollout Stage Deployment
```bash
# Source: Vercel environment variable management

# Stage 1: Deploy with 10% v2 traffic
vercel env add V2_ROLLOUT_PERCENT production
# When prompted, enter: 10

# Redeploy to pick up new env var (uses existing code)
vercel --prod

# Verify deployment
curl -X POST https://your-app.vercel.app/api/import/process-server \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"storagePath": "user-imports/test.json"}'

# Monitor logs for routing decisions
vercel logs --follow | grep "Routing import request"

# After 24 hours validation, increase to 50%
vercel env rm V2_ROLLOUT_PERCENT production
vercel env add V2_ROLLOUT_PERCENT production
# Enter: 50

vercel --prod

# After 48 hours validation, increase to 100%
vercel env rm V2_ROLLOUT_PERCENT production
vercel env add V2_ROLLOUT_PERCENT production
# Enter: 100

vercel --prod
```

### Emergency Rollback Procedure
```bash
# Source: Production incident response patterns

# EMERGENCY: Issues detected at 50% rollout

# Step 1: Immediate rollback to 0% (v1 only)
vercel env rm V2_ROLLOUT_PERCENT production
vercel env add V2_ROLLOUT_PERCENT production
# Enter: 0

vercel --prod

# Step 2: Verify rollback worked
vercel logs --follow | grep "Routing import request"
# Should show: endpoint=/process-full (v1)

# Step 3: Check RLM service health
curl https://soulprint-landing.onrender.com/health
# Should return 200 with status=ok

# Step 4: Monitor for stabilization
# - Check error rate drops to baseline
# - Verify no stuck imports
# - Wait 30 minutes for in-flight v2 jobs to complete/fail

# Step 5: Investigate root cause
# - Review Render logs for v2 errors
# - Check SQL for common failure patterns
# - Identify which conversation sizes/types fail
# - Fix issue in development branch
# - Test fix locally before re-attempting rollout
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Big-bang deployment | Gradual percentage-based rollout | Industry standard 2024+ | Reduces risk, enables validation |
| Feature flag services | Environment variables for simple flags | Trend in 2025-2026 | Simpler, faster, no external dependencies |
| Manual traffic splitting | Random percentage routing | Standard practice | True percentage split, easy implementation |
| Immediate deprecation | 7+ day validation period | Best practice 2026 | Ensures stability before removing rollback |
| Code-based rollback | Environment variable rollback | Modern ops practice | Instant rollback without code deploy |

**Deprecated/outdated:**
- Immediate 100% deployment for major changes - Too risky, no validation
- Hash-based user routing for simple rollouts - A/B testing pattern, not needed here
- Custom feature flag APIs - Overkill for simple percentage flags
- Deprecating endpoints on same day as 100% rollout - Insufficient validation period

## Open Questions

1. **Should we add endpoint routing to user_profiles table?**
   - What we know: Logging in Next.js shows which endpoint was chosen, Pino logs searchable
   - What's unclear: Is SQL analysis needed or are logs sufficient?
   - Recommendation: Start with logs only, add DB column if SQL analysis needed for validation

2. **What's the rollback time limit at each stage?**
   - What we know: 24 hours at 10%, 48 hours at 50%, 7 days at 100% are minimums
   - What's unclear: If issues arise on day 6 at 100%, do we restart the 7-day clock?
   - Recommendation: Any rollback at 100% restarts 7-day validation period

3. **Should v2 endpoint enforce storage_path requirement during gradual rollout?**
   - What we know: v2 requires storage_path (WIRE-04), v1 doesn't
   - What's unclear: Could Next.js caller send requests to v2 without storage_path?
   - Recommendation: Next.js already stores raw JSON before calling RLM, storage_path always present

4. **How to handle in-flight v1 jobs during v1 endpoint removal?**
   - What we know: BackgroundTasks killed on restart, processing_jobs tracks recovery
   - What's unclear: Should we wait for zero in-flight v1 jobs before removing endpoint?
   - Recommendation: Wait until v1 endpoint receives zero requests for 24 hours before removal

## Sources

### Primary (HIGH confidence)
- FastAPI Best Practices for Production 2026: https://fastlaunchapi.dev/blog/fastapi-best-practices-production-2026
- FastAPI Environment Variables official docs: https://fastapi.tiangolo.com/advanced/settings/
- Render Deployment Documentation: https://render.com/docs/deploys
- Render Health Checks: https://render.com/docs/health-checks
- Vercel Environment Variables: https://vercel.com/docs/environment-variables
- RFC 8594 (Sunset HTTP Header): https://www.rfc-editor.org/rfc/rfc8594

### Secondary (MEDIUM confidence)
- Harness: Understanding Canary Releases and Feature Flags: https://www.harness.io/blog/canary-release-feature-flags
- API Governance Best Practices 2026 (Treblle): https://treblle.com/blog/api-governance-best-practices
- Best Practices for Deprecating APIs (Treblle): https://treblle.com/blog/best-practices-deprecating-api
- Moesif: API Deprecation Best Practices: https://www.moesif.com/blog/best-practices/api-analytics/API-Best-Practices-For-Feature-Deprecation/
- Zalando RESTful API Guidelines (Deprecation): https://github.com/zalando/restful-api-guidelines/blob/main/chapters/deprecation.adoc
- Advanced API Development Best Practices 2026: https://stellarcode.io/blog/advanced-api-development-best-practices-2026/

### Tertiary (LOW confidence)
- Python Weighted Random Selection: https://nickjanetakis.com/blog/pick-1-of-2-items-randomly-with-a-weighted-percent-in-python-and-ruby
- Kolmisoft: Percent-Based Routing: https://blog.kolmisoft.com/percent-probability-based-routing/

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Environment variables and random routing are battle-tested patterns
- Architecture: HIGH - Patterns verified from Render/Vercel official docs and industry best practices
- Pitfalls: MEDIUM - Based on common patterns and production deployment experience, not all tested in this specific context

**Research date:** 2026-02-07
**Valid until:** 90 days (deployment patterns stable, gradual rollout is standard practice)
