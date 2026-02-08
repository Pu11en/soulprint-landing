# Phase 7: Production Deployment - Research

**Researched:** 2026-02-07
**Domain:** Deployment automation, smoke testing, rollback procedures
**Confidence:** HIGH

## Summary

Phase 7 deploys the Phase 6 prompt foundation code to the production RLM service on Render. The key challenge is that Phase 6 built prompt composition code in the **soulprint-landing repo** (`rlm-service/` directory), but production deploys from the **separate soulprint-rlm repo** (Pu11en/soulprint-rlm on GitHub). The deployment process is straightforward because Render has automatic GitHub integration - pushing to the main branch triggers automatic rebuild and deploy. The phase requires copying Phase 6 files to the production repo, verifying the deployment, and validating that the personality changes work end-to-end.

**What Phase 6 Built:**
- TypeScript prompt helpers: `lib/soulprint/prompt-helpers.ts` (cleanSection, formatSection)
- Python port: `rlm-service/prompt_helpers.py` (clean_section, format_section)
- Updated Next.js prompt builder: `app/api/chat/route.ts` (buildSystemPrompt)
- Updated RLM prompt builder: `rlm-service/main.py` (build_rlm_system_prompt - NOT in production yet)
- Cross-language hash tests: `__tests__/cross-lang/prompt-hash.test.ts` (30 passing tests)
- Personalized greeting: `app/api/profile/ai-name/route.ts` + `app/chat/page.tsx`

**Current State:**
- Production RLM repo at `/home/drewpullen/clawd/soulprint-rlm` is clean (no uncommitted changes)
- Last commit: `21bb3fd feat(05-04): add RFC 8594 deprecation headers to /process-full`
- Phase 6 code exists ONLY in `/home/drewpullen/clawd/soulprint-landing/rlm-service/`
- Production RLM does NOT have `prompt_helpers.py` or updated `build_rlm_system_prompt`
- Next.js side (soulprint-landing) already has Phase 6 code deployed to Vercel

**Deployment Gap:**
The production RLM service needs Phase 6's prompt composition code. This is a straightforward file copy operation, NOT a complex merge. The production repo already has the v1.3 processors from earlier phases, so we're just adding the prompt helpers and updating the prompt builder function.

**Primary recommendation:** Copy Phase 6 prompt code to production RLM repo, verify build succeeds, push to GitHub, verify Render deployment, run end-to-end smoke tests to confirm personality changes work.

## Standard Stack

This phase uses existing infrastructure, no new tools needed.

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Render | N/A | RLM service hosting | Already in use, auto-deploys from GitHub |
| GitHub | N/A | Source control for soulprint-rlm | Pu11en/soulprint-rlm triggers Render deploys |
| Docker | Latest | RLM service containerization | render.yaml specifies `env: docker` |
| curl | System | Smoke testing API endpoints | Standard HTTP client for verification |
| Supabase REST API | N/A | Direct DB queries for verification | Already used in production for data validation |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| pytest | Latest | Python unit tests | Verify prompt_helpers.py after copy |
| git | System | Version control operations | Copy files, commit, push to production |
| Render Dashboard | Web UI | Deployment monitoring | Watch build logs, verify health |

**Installation:** None needed - all tools already in use.

## Architecture Patterns

### Recommended Deployment Flow

```
1. Copy Phase 6 code to production repo
   ├── prompt_helpers.py (new file)
   └── main.py (update build_rlm_system_prompt function)

2. Verify locally
   ├── Run pytest (if tests exist)
   ├── Check Python syntax
   └── Verify imports work

3. Commit and push
   ├── git add prompt_helpers.py main.py
   ├── git commit -m "feat(06): add prompt foundation from Phase 6"
   └── git push origin main

4. Monitor Render deployment
   ├── Watch Render dashboard for build success
   ├── Check /health endpoint
   └── Review startup logs

5. Smoke test production
   ├── /health returns processors_available: true
   ├── /query accepts request with sections parameter
   └── Response uses personalized language

6. End-to-end verification
   ├── Use real user data (test account)
   ├── Verify AI uses generated name
   ├── Verify greeting is personalized
   └── Verify response quality differs from generic Claude
```

### Pattern 1: Render Auto-Deploy from GitHub

**What:** Render automatically rebuilds and deploys services when you push to the linked GitHub branch.

**When to use:** Every deployment to production RLM (this is the only deployment method for Render services linked to GitHub).

**How it works:**
1. Developer pushes to `main` branch in Pu11en/soulprint-rlm
2. Render detects push via GitHub webhook
3. Render pulls latest code, runs Docker build
4. If build succeeds, Render spins up new instance
5. If new instance healthy, Render routes traffic to it
6. Old instance terminated after health check passes

**Critical timing:**
- Build typically takes 2-5 minutes
- Health check happens immediately after build
- Zero-downtime deployment if build succeeds
- If build fails, current service continues running unchanged

**Source:** [Render Docs - Deploying on Render](https://render.com/docs/deploys), [Render Community - Auto deployment after a commit/push on Github](https://community.render.com/t/auto-deployment-after-a-commit-push-on-github/23886)

### Pattern 2: Health Check Verification

**What:** After deployment, verify the service is healthy before considering deployment successful.

**When to use:** Immediately after Render shows "Deploy succeeded" notification.

**Example:**
```bash
# Check service health
curl https://soulprint-landing.onrender.com/health

# Expected response:
{
  "status": "healthy",
  "processors_available": true  # Critical: confirms processors imported
}
```

If `processors_available: false`, the deployment failed (processor imports broken). Check Render logs for import errors.

### Pattern 3: Smoke Test Critical Paths

**What:** Test the most critical user-facing functionality to verify deployment didn't break core features.

**When to use:** After health check passes, before declaring deployment successful.

**For RLM service:**
```bash
# Test 1: /query endpoint accepts requests
curl -X POST https://soulprint-landing.onrender.com/query \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test",
    "message": "Hello",
    "sections": {
      "soul": {"personality_traits": ["curious", "direct"]},
      "identity": {"ai_name": "Echo"}
    }
  }'

# Expected: 200 response with AI message referencing personality

# Test 2: Verify deprecation headers (from Phase 5)
curl -I -X POST https://soulprint-landing.onrender.com/process-full

# Expected: Deprecation: true, Sunset: Sat, 01 Mar 2026 00:00:00 GMT
```

### Pattern 4: Rollback Procedure

**What:** Revert to last known good version if deployment causes issues.

**When to use:** If smoke tests fail, health check fails, or production errors appear.

**From existing ROLLBACK.md:**
```bash
# Step 1: Find last good commit
git log --oneline -10

# Step 2: Revert to last good commit
git revert HEAD --no-edit
git push origin main

# Step 3: Verify on Render
# Watch Render dashboard for automatic redeployment
curl https://soulprint-landing.onrender.com/health
```

**Rollback decision criteria:**
- /health returns 503 (processor import failure)
- /query returns 500 errors
- Render dashboard shows service unhealthy
- Users report chat errors

**Source:** `/home/drewpullen/clawd/soulprint-rlm/ROLLBACK.md`

### Anti-Patterns to Avoid

- **Manual file uploads to Render:** Don't use Render's file upload feature - always deploy via git push for version control
- **Skipping health checks:** Always verify /health before considering deployment successful
- **Deploying without local verification:** Run pytest locally before pushing to catch syntax/import errors early
- **Changing multiple things at once:** Phase 7 should ONLY add Phase 6 code, no other changes
- **Ignoring build logs:** If build succeeds but service behaves oddly, check Render logs for warnings

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deployment automation | Custom deployment scripts | Render's GitHub integration | Already configured, zero-downtime, automatic rollback on failed builds |
| Health checking | Custom monitoring service | Existing /health endpoint | Already implemented with processor validation |
| Rollback mechanism | Custom versioning system | git revert + git push | Leverages Render auto-deploy, version controlled |
| End-to-end testing | Custom test framework | Manual smoke tests + existing Playwright tests | Phase 7 is deployment, not feature development |
| Production monitoring | Custom log aggregator | Render Dashboard logs | Already available, no setup needed |

**Key insight:** Render handles the hard parts (zero-downtime deploy, health checks, rollback). Our job is to prepare code, verify it works, and monitor the deployment. Don't build custom tooling for problems Render already solves.

## Common Pitfalls

### Pitfall 1: Copying Files Without Testing Imports

**What goes wrong:** You copy `prompt_helpers.py` to production repo, push to GitHub, Render build fails because imports are broken.

**Why it happens:** The file path differences between repos (`rlm-service/` vs root directory) can break relative imports.

**How to avoid:**
1. After copying files, verify Python can import them:
   ```bash
   cd /home/drewpullen/clawd/soulprint-rlm
   python3 -c "from prompt_helpers import clean_section, format_section; print('OK')"
   ```
2. If existing tests exist, run them: `pytest tests/`
3. Check Dockerfile - if it expects specific directory structure, adjust accordingly

**Warning signs:**
- `ModuleNotFoundError` when testing imports
- Render build logs show "ImportError" during container build
- /health returns `processors_available: false` after deployment

### Pitfall 2: Not Verifying Render Deployment Success

**What goes wrong:** You push to GitHub, assume deployment succeeded because git push worked, but Render build actually failed. Production is still running old code.

**Why it happens:** Git push success ≠ Render deployment success. Render pulls code AFTER push, builds separately, and build can fail.

**How to avoid:**
1. Open Render dashboard BEFORE pushing: https://dashboard.render.com
2. After `git push origin main`, watch dashboard for "Deploy started" notification
3. Wait for "Deploy succeeded" or "Deploy failed" (typically 2-5 minutes)
4. If failed, check build logs in Render dashboard
5. Only after "Deploy succeeded", run health check: `curl https://soulprint-landing.onrender.com/health`

**Warning signs:**
- Render dashboard shows "Deploy failed" in red
- /health endpoint returns old version behavior
- Render logs show Python import errors or missing files

### Pitfall 3: Merging Instead of Copying

**What goes wrong:** You try to `git merge` or `git rebase` between soulprint-landing/rlm-service and soulprint-rlm repos, causing merge conflicts and broken history.

**Why it happens:** These are separate repos with different git histories - they're not forks or branches. Git can't merge unrelated histories cleanly.

**How to avoid:**
1. Use manual file copy, NOT git merge:
   ```bash
   # CORRECT:
   cp /home/drewpullen/clawd/soulprint-landing/rlm-service/prompt_helpers.py \
      /home/drewpullen/clawd/soulprint-rlm/prompt_helpers.py

   # WRONG:
   git merge soulprint-landing/rlm-service  # This won't work
   ```
2. Copy specific files, not entire directories
3. Manually update functions in main.py (don't try to merge the file)

**Warning signs:**
- Git complains about "unrelated histories"
- Merge conflicts appear in files that don't exist in production repo
- File structure gets duplicated (e.g., `rlm-service/rlm-service/`)

### Pitfall 4: Skipping End-to-End Verification

**What goes wrong:** You verify /health passes, assume deployment successful, but personality changes don't actually work in production chat.

**Why it happens:** Health check only tests that code loads, not that it produces correct behavior. Prompt changes are subtle and require actual AI responses to verify.

**How to avoid:**
1. Use a real test account with imported data
2. Send a message via /chat in production
3. Verify AI response:
   - Uses generated name ("I'm Echo" not "I'm an AI assistant")
   - References personality traits from SOUL section
   - Shows personalized greeting on first message
   - Differs noticeably from generic Claude responses
4. Compare before/after responses (save a screenshot of generic response first)

**Warning signs:**
- AI still uses generic greetings ("Hello, how can I help you?")
- AI doesn't reference its generated name
- Responses feel identical to pre-Phase-6 behavior
- First message is generic instead of personalized

### Pitfall 5: Deploying During High Traffic

**What goes wrong:** You deploy during peak usage hours, Render restarts service, users see brief downtime or connection errors.

**Why it happens:** Render does zero-downtime deployment but there's a brief moment during health check when old instance stops and new instance starts.

**How to avoid:**
1. Check current traffic patterns (Render dashboard → Metrics)
2. Deploy during low-traffic periods (likely early morning or late night in user timezone)
3. If urgent deploy needed during traffic, warn users via status page first
4. Monitor Render logs during deployment to catch issues immediately

**Warning signs:**
- Users report "Connection refused" errors during deployment
- Render logs show high request rate during deployment window
- Multiple failed requests in Render metrics dashboard

## Code Examples

Verified patterns from Phase 6 implementation:

### Example 1: Copy Phase 6 Prompt Helpers to Production

```bash
# Navigate to production repo
cd /home/drewpullen/clawd/soulprint-rlm

# Copy prompt_helpers.py (new file)
cp /home/drewpullen/clawd/soulprint-landing/rlm-service/prompt_helpers.py \
   /home/drewpullen/clawd/soulprint-rlm/prompt_helpers.py

# Verify it imports correctly
python3 -c "from prompt_helpers import clean_section, format_section; print('Imports OK')"

# Check the file
cat prompt_helpers.py | head -20
```

### Example 2: Update RLM Prompt Builder in main.py

The production `main.py` needs the `build_rlm_system_prompt` function from Phase 6. This function is in `/home/drewpullen/clawd/soulprint-landing/rlm-service/main.py` lines 200-270.

**DO NOT copy entire main.py** - production version has different endpoints and configuration. Instead, manually add the function:

1. Open production main.py in editor
2. Find where to insert `build_rlm_system_prompt` (likely near other helper functions)
3. Copy the function from soulprint-landing/rlm-service/main.py lines 200-270
4. Add import at top: `from prompt_helpers import clean_section, format_section`
5. Update existing `/query` endpoint to use new function instead of old prompt building

**Key sections to copy from Phase 6:**
- `build_rlm_system_prompt()` function (lines 200-270)
- Import statement: `from prompt_helpers import clean_section, format_section`
- Updated `/query` endpoint that calls `build_rlm_system_prompt()`

### Example 3: Verify Deployment Health

```bash
# After Render shows "Deploy succeeded"

# Check 1: Service is healthy
curl https://soulprint-landing.onrender.com/health

# Expected output:
{
  "status": "healthy",
  "processors_available": true,
  "timestamp": "2026-02-07T..."
}

# Check 2: /query accepts sections parameter
curl -X POST https://soulprint-landing.onrender.com/query \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user",
    "message": "Hello",
    "sections": {
      "soul": {
        "personality_traits": ["curious", "direct"],
        "communication_style": "Casual and concise"
      },
      "identity": {
        "ai_name": "Echo"
      }
    }
  }'

# Expected: Response contains personality-aware language, uses name "Echo"
```

### Example 4: Rollback on Failure

```bash
# If deployment fails or smoke tests fail

cd /home/drewpullen/clawd/soulprint-rlm

# Find last good commit
git log --oneline -10

# Revert most recent commit
git revert HEAD --no-edit

# Push rollback
git push origin main

# Verify rollback deployed
curl https://soulprint-landing.onrender.com/health

# Monitor Render dashboard for "Deploy succeeded"
```

## State of the Art

Deployment practices haven't changed significantly - Render's GitHub auto-deploy is industry standard.

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual FTP/SCP uploads | Git-based auto-deploy | ~2015 | Version control, rollback capability |
| Custom health check scripts | Built-in health endpoints | ~2018 | Faster deployments, simpler monitoring |
| Blue-green manual switching | Automatic zero-downtime | ~2019 | Reduced human error, faster rollout |
| Manual smoke tests | Automated E2E tests | ~2020 | Faster verification, consistent coverage |

**Deprecated/outdated:**
- Manual file uploads via web dashboard (use git push instead)
- Deploying without health checks (always verify /health)
- Skipping rollback procedures (always have revert plan ready)

**Current best practice (2026):**
- Infrastructure as code (render.yaml in repo)
- Automatic deployment from main branch
- Health checks before routing traffic
- Automated rollback on failed health checks
- Comprehensive logging for debugging

## Open Questions

### Question 1: Should we run cross-language hash tests in production?

**What we know:**
- Hash tests exist in `__tests__/cross-lang/prompt-hash.test.ts`
- They verify TypeScript and Python produce identical output
- They run in CI during development

**What's unclear:**
- Whether to run them as part of deployment verification
- Whether to add them to production health check

**Recommendation:**
- Run them locally BEFORE pushing to production (one-time verification)
- Don't add to production /health endpoint (unnecessary overhead)
- Re-run if we ever modify prompt_helpers in future phases

### Question 2: How to verify personality changes with real user data?

**What we know:**
- Need to test with actual imported ChatGPT data, not mock data
- User should notice difference between generic and personalized responses
- First message should use personalized greeting

**What's unclear:**
- Whether to use production user account or create test account
- How to quantify "observably different from generic Claude"

**Recommendation:**
- Use test account with real ChatGPT import (not production user)
- Document specific phrases to check for (e.g., AI name, personality traits mentioned)
- Save before/after screenshots for visual comparison
- Success criteria: AI mentions its name + references at least one personality trait in first response

### Question 3: Timing of Next.js vs RLM deployment

**What we know:**
- Next.js (soulprint-landing) already has Phase 6 code deployed to Vercel
- RLM (soulprint-rlm) needs Phase 6 code deployed to Render
- Both use the prompt helpers for consistency (PROMPT-02)

**What's unclear:**
- Whether deploying RLM alone causes issues if Next.js already deployed
- Whether there's a timing window where they're out of sync

**Recommendation:**
- This is NOT a concern - they're already out of sync (Next.js has new code, RLM doesn't)
- Deploying RLM brings them INTO sync, not out of sync
- No coordination needed - deploy RLM whenever ready

## Sources

### Primary (HIGH confidence)

- Render official docs - [Deploying on Render](https://render.com/docs/deploys)
- Render community - [Auto deployment after a commit/push on Github](https://community.render.com/t/auto-deployment-after-a-commit-push-on-github/23886)
- Production RLM repo - `/home/drewpullen/clawd/soulprint-rlm/` (git status, commit history)
- Phase 6 verification - `.planning/phases/06-prompt-foundation/06-VERIFICATION.md`
- Phase 5 cutover runbook - `.planning/phases/05-gradual-cutover/CUTOVER-RUNBOOK.md`
- Existing rollback procedure - `/home/drewpullen/clawd/soulprint-rlm/ROLLBACK.md`

### Secondary (MEDIUM confidence)

- RLM sync analysis - `.planning/codebase/rlm/SYNC-ANALYSIS.md` (architectural context)
- STATE.md - Production RLM deploys from Pu11en/soulprint-rlm (confirmed via git remote)

### Tertiary (LOW confidence)

- None - all findings verified with primary sources

## Metadata

**Confidence breakdown:**
- Deployment process: HIGH - Verified via Render docs, existing render.yaml, git remote
- Render auto-deploy: HIGH - Official documentation, existing successful deployments
- Rollback procedures: HIGH - ROLLBACK.md exists in production repo, tested in Phase 5
- File copy approach: HIGH - Verified by examining both repos, no git relationship
- Smoke testing approach: MEDIUM - Based on general practices, no project-specific smoke tests exist yet
- End-to-end verification: MEDIUM - Success criteria defined in ROADMAP but no existing E2E test for personality

**Research date:** 2026-02-07
**Valid until:** 60 days (deployment practices stable, Render API unlikely to change)

**Key files examined:**
- `/home/drewpullen/clawd/soulprint-rlm/` - Production repo state
- `/home/drewpullen/clawd/soulprint-landing/rlm-service/` - Phase 6 source code
- `.planning/phases/06-prompt-foundation/06-VERIFICATION.md` - What Phase 6 delivered
- `.planning/ROADMAP.md` - Phase 7 success criteria
- `.planning/REQUIREMENTS.md` - INFRA-02 requirement

**What wasn't researched:**
- Performance impact of new prompt system (not in Phase 7 scope, defer to monitoring)
- Token usage changes from new sections (deferred per REQUIREMENTS.md)
- User feedback collection (not in Phase 7 scope)
- Analytics/metrics tracking (Phase 7 is deployment only)
