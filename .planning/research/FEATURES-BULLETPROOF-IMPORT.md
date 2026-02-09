# Feature Research: Bulletproof ChatGPT Import Processing

**Domain:** Large-file data import with long-running background processing
**Researched:** 2026-02-09
**Confidence:** MEDIUM

_Confidence rationale: Strong consensus from multiple sources on file upload best practices and UX patterns. Lower confidence on ChatGPT-specific parsing details (limited official documentation). Convoviz provides one proven parsing approach but not authoritative spec._

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Progress indicator during upload** | Industry standard for any file upload; users expect visual feedback | LOW | Already implemented (XHR chunked upload). HTML5 progress events standard across modern browsers |
| **Processing status visibility** | Users need to know if import is still running or stuck | LOW | Already implemented (import_status tracking). Must be visible on multiple pages |
| **Error messages with actionable guidance** | When something fails, users need to know what went wrong AND how to fix it | MEDIUM | NN/g guideline: errors must state what happened, why, and next steps. Currently basic |
| **Large file handling (300MB+)** | ChatGPT power users can have 100MB-2GB+ exports; failing on large files eliminates core audience | HIGH | Requires streaming parser. Current approach loads entire JSON into memory (OOMs on Vercel). Critical blocker |
| **Mobile upload support** | Users expect to upload from any device | MEDIUM | Current Vercel approach works on mobile, but large files may hit iOS/Android constraints. Must test 100MB+ files |
| **Processing completion notification** | Users won't sit and watch; they need to be told when ready | LOW | Email notification already planned. Industry standard for async operations taking >30 seconds |
| **Resumable uploads on network failure** | Large files + mobile networks = inevitable interruptions | MEDIUM | Already implemented via Supabase Storage's chunked upload. Test failure recovery |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Accurate DAG traversal (real conversations only)** | Competitors show duplicate/dead-branch messages from edits; we show clean conversation history | HIGH | Requires current_node→parent chain traversal, not naive node iteration. Convoviz shows this is achievable |
| **Hidden message filtering** | Show users their actual conversations, not internal tool outputs (web search, code execution, reasoning) | MEDIUM | Requires message metadata inspection. Improves soulprint quality by removing noise |
| **Multi-part content parsing** | Users with images/files in conversations get complete history, not just first text fragment | MEDIUM | Current parser only takes parts[0]. Need polymorphic content.parts handling |
| **Detailed progress reporting (stages)** | Instead of generic "processing...", show "Parsing conversations (2/5)", "Generating embeddings (4/5)" | MEDIUM | Reduces perceived wait time. Requires sub-task progress tracking from RLM service |
| **Smart retry on transient failures** | Network hiccups during RLM calls don't require full re-import | MEDIUM | RLM service is external (Render). Should retry embedding/soulprint generation without re-parsing |
| **Background processing with "close and come back"** | User can close browser/tab, get email when done | LOW | Already planned. Differentiator because many tools require keeping page open |
| **Duplicate conversation detection** | Skip processing if user re-uploads same export | LOW | Already implemented. Saves processing costs and user confusion |
| **Validation before heavy processing** | Check for conversations.json structure validity BEFORE starting expensive parsing/embedding | MEDIUM | Fail-fast approach. Reduces wasted RLM costs and user wait time on malformed exports |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time streaming progress (WebSocket)** | "It would be cool to see each conversation process" | Adds architectural complexity (WebSocket infrastructure), rarely watched by users, mobile battery drain | Email notification when done. Poll-based status checks on /import page if user stays |
| **In-browser parsing of large files** | "Faster, no upload needed" | Browser memory constraints worse than server (especially mobile), browser crash loses all work, can't resume | Server-side streaming parser on RLM (Render has 16GB RAM, can handle 2GB+ files) |
| **Parallel conversation processing** | "Process multiple conversations at once for speed" | Marginal speed gain (I/O bound, not CPU bound), complicates progress reporting, harder to debug failures | Sequential processing with clear progress stages. Simplicity > premature optimization |
| **Incremental import (only new conversations)** | "Don't re-process everything on subsequent uploads" | Export format doesn't include reliable timestamps, risk missing edited conversations, complex diff logic | Full re-import with duplicate detection. Storage is cheap, correctness is expensive |
| **Client-side soulprint generation** | "Reduce server costs, privacy-first" | Large LLM required (can't run in browser), inconsistent results across devices, no fallback on failure | Server-side RLM processing. True privacy = not storing raw conversations (already handled via chunks only) |

## Feature Dependencies

```
[Large File Handling - Streaming Parser]
    └──enables──> [Mobile Upload Support (100MB+)]
    └──enables──> [Accurate DAG Traversal]
                      └──requires──> [Hidden Message Filtering]
                      └──requires──> [Multi-part Content Parsing]

[Processing Status Visibility]
    └──enhanced by──> [Detailed Progress Reporting (stages)]
    └──enhanced by──> [Email Notification When Done]

[Error Recovery]
    └──requires──> [Validation Before Heavy Processing]
    └──enhanced by──> [Smart Retry on Transient Failures]

[Background Processing]
    └──requires──> [Processing Status Visibility]
    └──requires──> [Email Notification When Done]
```

### Dependency Notes

- **Streaming Parser enables DAG Traversal:** Can't parse complex tree structures if entire file must fit in memory. Streaming allows incremental node processing.
- **DAG Traversal requires filtering/parsing:** Accurate conversation reconstruction depends on skipping hidden messages and handling multi-part content. Order matters: filter first, then traverse.
- **Status visibility enables background processing:** Users won't close browser if they can't check status later. Email alone isn't enough (spam folder, delay).
- **Validation before processing reduces wasted effort:** If file is malformed, fail in <5 seconds, not after 5 minutes of processing.

## MVP Definition

### Launch With (v1) - BULLETPROOF MILESTONE

Minimum viable for "moving import processing to RLM with convoviz-quality parsing."

- [x] **Large file handling (streaming parser)** — Eliminates current OOM failures. Non-negotiable for 300MB+ files.
- [x] **Accurate DAG traversal (current_node chain)** — Core quality improvement. This is why we're porting convoviz approach.
- [x] **Hidden message filtering** — Prevents noise in soulprint. Table stakes for quality.
- [x] **Multi-part content parsing** — Handles images/files in conversations. Required for complete history.
- [x] **Processing status visibility** — Already implemented, must maintain during refactor.
- [x] **Email notification when done** — Already planned. Required for background processing UX.
- [x] **Error messages with actionable guidance** — Improve current basic errors. "Upload failed" → "File too large (max 2GB)" or "Not a valid ChatGPT export (missing conversations.json)".
- [ ] **Validation before heavy processing** — Fail-fast on malformed exports. Saves user time and RLM costs.

### Add After Validation (v1.x)

Features to add once core is stable and validated with real imports.

- [ ] **Detailed progress reporting (stages)** — Trigger: User feedback requests "stuck or working?" clarity. Improves perceived performance.
- [ ] **Smart retry on transient failures** — Trigger: RLM service shows >5% transient network errors. Reduces support burden.
- [ ] **Mobile-specific optimizations** — Trigger: Analytics show >20% mobile uploads or mobile failures. Test iOS/Android large file limits.
- [ ] **Import history (past imports list)** — Trigger: Users want to see "when did I last import?" Nice-to-have for power users.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Selective conversation import** — Why defer: Complex UI, unclear demand. Let users export smaller sets from ChatGPT instead.
- [ ] **Multi-format support (Anthropic, Gemini exports)** — Why defer: Scope creep. Validate ChatGPT import quality first.
- [ ] **Visual conversation browser** — Why defer: Feature creep. Core value is soulprint generation, not conversation exploration UI.
- [ ] **Export merged conversations** — Why defer: No clear use case. Users have original export already.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Streaming parser (large files) | HIGH (eliminates OOMs) | HIGH (Python, memory management) | P1 |
| Accurate DAG traversal | HIGH (quality differentiator) | HIGH (tree algorithms) | P1 |
| Hidden message filtering | HIGH (clean soulprints) | MEDIUM (metadata parsing) | P1 |
| Multi-part content parsing | MEDIUM (completeness) | MEDIUM (polymorphic handling) | P1 |
| Validation before processing | HIGH (saves time/cost) | LOW (schema checks) | P1 |
| Actionable error messages | HIGH (reduces support) | LOW (better error strings) | P1 |
| Email notification | HIGH (async UX standard) | LOW (already planned) | P1 |
| Processing status visibility | HIGH (user confidence) | LOW (already implemented) | P1 |
| Detailed progress reporting | MEDIUM (perceived speed) | MEDIUM (RLM service changes) | P2 |
| Smart retry (transient fails) | MEDIUM (reliability) | MEDIUM (retry logic + state) | P2 |
| Mobile optimizations | LOW (until proven needed) | HIGH (device testing matrix) | P2 |
| Import history | LOW (power user feature) | MEDIUM (new DB schema + UI) | P3 |
| Selective conversation import | LOW (unclear demand) | HIGH (complex UI + logic) | P3 |
| Multi-format support | LOW (scope creep) | HIGH (per-format parsers) | P3 |

**Priority key:**
- P1: Must have for bulletproof milestone (launch-blocking)
- P2: Should have, add based on real usage patterns
- P3: Nice to have, defer until PMF or clear demand

## User Journey Scenarios

### Scenario 1: Power User with Large Export (1.5GB, 5+ years of ChatGPT)

**Current experience (broken):**
1. Upload ZIP (5 min on decent connection)
2. Server starts processing
3. **FAILS** - Vercel serverless OOMs loading conversations.json
4. Error: "Something went wrong"
5. User frustrated, can't use product

**Bulletproof experience (target):**
1. Upload ZIP (5 min, shows progress bar)
2. Validation: "Export contains 12,347 conversations. Estimated processing: 8-12 minutes"
3. "Processing started. You can close this page - we'll email you when ready."
4. User closes browser, does other tasks
5. 10 minutes later: Email "Your SoulPrint is ready!"
6. Returns to /chat, uses product immediately

**Key features enabling this:**
- Streaming parser (no OOM)
- Validation before processing (time estimate)
- Background processing + email (async UX)
- Processing status page (if user checks back)

### Scenario 2: Mobile User with Medium Export (150MB)

**Current experience (working but slow):**
1. Upload ZIP on phone (10 min on LTE)
2. Upload completes, processing starts
3. User puts phone in pocket, screen locks
4. 5 minutes later: checks /import page, still processing
5. No notification, user assumes it's stuck
6. Uploads again (duplicate), wastes time

**Bulletproof experience (target):**
1. Upload ZIP (10 min, shows progress, works on LTE)
2. Validation: "Export looks good! Processing will take ~5 minutes"
3. "We'll send a text/email when ready. Safe to close this page."
4. User pockets phone
5. 5 minutes later: Push notification (if web push enabled) or email
6. Opens app, ready to chat

**Key features enabling this:**
- Mobile-friendly upload (already works via Supabase)
- Clear time expectations (validation)
- Multi-channel notification (email + optional push)
- Duplicate detection (prevents accidental re-upload)

### Scenario 3: User with Malformed Export

**Current experience (wastes time):**
1. Upload ZIP (3 min)
2. Server starts processing
3. 5 minutes of parsing, embedding, soulprint generation
4. **FAILS** at final step - conversations.json missing key fields
5. Error: "Import failed"
6. User wasted 8 minutes (upload + processing)

**Bulletproof experience (target):**
1. Upload ZIP (3 min)
2. Validation (5 seconds): **FAILS**
3. Error: "This doesn't look like a ChatGPT export. Missing conversations.json. [Download guide]"
4. User fixes issue (downloads correct export)
5. Re-uploads, succeeds

**Key features enabling this:**
- Validation before processing (fail-fast)
- Actionable error messages (what to do next)
- Documentation links (reduce support burden)

## Competitor Feature Analysis

| Feature | ChatGPT Official Export | Convoviz | Our Approach |
|---------|------------------------|----------|--------------|
| **Large file support** | ✅ Generates exports up to 2GB+ | ✅ Handles via Python streaming | ✅ RLM service on Render (16GB RAM), streaming parser |
| **DAG traversal (clean conversations)** | N/A (just exports data) | ✅ Active vs full branch rendering | ✅ Current_node→parent chain, active branch only |
| **Hidden message filtering** | N/A | ⚠️ Unclear from docs | ✅ Filter tool outputs, web browsing, reasoning |
| **Multi-part content** | ✅ Exports all content types | ✅ Preserves inline media | ✅ Handle polymorphic parts array |
| **Progress reporting** | N/A | ❌ CLI tool, no progress | ✅ Stage-based progress (parsing → embedding → soulprint) |
| **Background processing** | N/A | ❌ Synchronous CLI | ✅ RLM background job + email notification |
| **Mobile support** | ✅ Export works on mobile | ❌ Desktop CLI only | ✅ Web upload works on mobile (test large files) |
| **Error recovery** | N/A | ❌ Crash = restart | ✅ Smart retry on RLM failures, validation before processing |
| **Purpose** | Data portability | Markdown archive + visualization | AI personalization (soulprint generation) |

**Key takeaway:** We're combining Convoviz's parsing quality with web-app UX expectations (progress, mobile, background processing). Our differentiator is **production-ready, user-friendly import** vs Convoviz's developer-focused CLI tool.

## Technical Implementation Notes

### Large File Handling Research

**Problem:** ChatGPT exports can exceed 2GB. Current approach loads entire `conversations.json` into memory.

**Solution:** Streaming JSON parser
- **Python:** `ijson` library - incremental parsing, processes 10M items with ~2MB RAM vs 5.5GB for full parse
- **Node.js:** `stream-json` - similar approach for Node-based parsers
- **Implementation:** RLM service (Python-based) should use `ijson` to parse conversations incrementally

**Source confidence:** HIGH - Multiple sources confirm streaming parser necessity for 100MB+ JSON files

### DAG Traversal Research

**Problem:** ChatGPT conversations are trees (DAG), not lists. Each node has parent/children. Naive iteration includes dead branches from message edits.

**Solution:** Current_node → parent chain traversal
- Start at conversation's `current_node` (the active leaf)
- Follow `parent` pointers back to root
- Reverse list to get chronological order
- Ignores edited/abandoned branches automatically

**Source:** Convoviz implementation, OpenAI community discussions confirming DAG structure

**Source confidence:** MEDIUM - Convoviz proves it works, but no official OpenAI spec

### Hidden Message Filtering

**Problem:** Export includes messages users never saw: web search queries, tool executions, internal reasoning steps.

**Solution:** Filter by message metadata
- Check `author.role` - keep only 'user' and 'assistant'
- Check `metadata.is_visually_hidden_from_conversation` - skip if true
- Check message type - skip tool calls, retrieval results

**Source:** OpenAI community discussions, Convoviz behavior (implied)

**Source confidence:** LOW - No official documentation, inferred from community knowledge

### Multi-part Content

**Problem:** Messages can have multiple parts: text, images, code blocks. Current parser only takes `parts[0]`.

**Solution:** Polymorphic parts array handling
- Iterate all items in `content.parts`
- Each part has `content_type` field
- Handle: 'text', 'code', 'image' (at minimum)
- Concatenate text-based parts, store image references

**Source:** OpenAI API documentation (similar structure), Convoviz inline media support

**Source confidence:** MEDIUM - API structure similar, but export format may differ

## Progress Reporting UX Research

**User expectations (Jakob Nielsen):**
- <1 second: Feels instant, no feedback needed
- 1-10 seconds: User notices delay, show "working" indicator
- >10 seconds: User attention wanders, MUST show progress indicator + allow interruption

**For file processing:**
- Upload progress: % complete, bytes transferred (standard HTML5)
- Processing progress: Stage-based better than time-based (time is unpredictable)
  - "Extracting conversations (1/5)"
  - "Parsing conversation tree (2/5)"
  - "Generating embeddings (3/5)"
  - "Creating soulprint (4/5)"
  - "Finalizing (5/5)"

**Mobile vs Desktop:**
- Desktop: Progress bar on page is sufficient
- Mobile: Background processing + notification essential (users lock screen)

**Source confidence:** HIGH - Nielsen Norman Group UX research, multiple modern examples

## Error Recovery Research

**Best practices:**
- **Chunked uploads:** Already implemented (Supabase Storage). Failure only loses current chunk, not entire file.
- **Resumable uploads:** Standard for >100MB files. Supabase handles this.
- **Retry with backoff:** For transient network failures (RLM service calls). Exponential backoff: 1s, 2s, 4s, 8s.
- **Fail-fast validation:** Check file structure before expensive operations. 5 seconds of validation saves 5 minutes of wasted processing.

**Error message principles (NN/g):**
1. State what went wrong (explicit, human-readable)
2. Explain why it happened (if known)
3. Provide next steps (actionable guidance)

**Examples:**
- ❌ Bad: "Import failed"
- ✅ Good: "File is too large (2.3GB, max 2GB). Try exporting a smaller date range from ChatGPT."

- ❌ Bad: "Processing error"
- ✅ Good: "Couldn't connect to processing service. This is usually temporary. [Retry] or wait for email notification."

**Source confidence:** HIGH - Industry standard practices, NN/g UX research

## Mobile-Specific Considerations

**Upload constraints:**
- iOS: No specific file size limit for web uploads, but memory constraints around 100-200MB depending on device
- Android: Varies by manufacturer, similar memory constraints
- Both: Network interruptions more common (LTE/5G switching, weak signal)

**Solutions:**
- Chunked upload (already implemented) - essential for mobile
- Background processing - mobile users will lock screen or switch apps
- Clear progress indicators - can't assume user is watching
- Notification when done - email or push (web push API)

**Testing matrix:**
- iOS Safari: 50MB, 150MB, 300MB files
- Android Chrome: Same
- Slow network simulation (DevTools)
- Interrupted upload recovery

**Source confidence:** MEDIUM - General mobile constraints documented, SoulPrint-specific testing required

## Dependencies on Existing Infrastructure

**Already implemented (must maintain):**
- Supabase Storage direct upload (chunked, resumable)
- Import status tracking (`none`, `processing`, `complete`, `failed`)
- Duplicate import detection
- Stuck processing detection (>15 min timeout)
- Email notification (Resend integration exists)

**Must change (this milestone):**
- Parser: Replace Vercel serverless with RLM streaming parser
- Processing location: Move from Vercel API route to RLM service
- DAG traversal: Implement current_node→parent chain
- Message filtering: Add hidden message detection
- Content parsing: Handle multi-part content

**Must add (new capabilities):**
- Validation before processing (structure checks)
- Actionable error messages (better error strings)
- Progress stages (requires RLM service changes)
- Smart retry (requires RLM service changes)

## Complexity Notes

**HIGH complexity:**
- Streaming JSON parser in Python (memory management, incremental processing)
- Accurate DAG traversal (tree algorithms, handling edge cases like loops or malformed graphs)
- Large file support (testing 300MB-2GB range, memory profiling)

**MEDIUM complexity:**
- Hidden message filtering (metadata inspection, unknown edge cases)
- Multi-part content parsing (polymorphic types, unknown content types)
- Detailed progress reporting (requires RLM service refactor for sub-task updates)
- Smart retry logic (state management, determining transient vs permanent failures)
- Validation before processing (need to understand full schema, edge cases)

**LOW complexity:**
- Email notification (already exists, just integrate)
- Processing status visibility (already exists, maintain during refactor)
- Error message improvements (better strings, minimal code change)
- Duplicate detection (already exists)

## Sources

**File Upload Best Practices:**
- [Handling Large File Uploads (Uploadcare)](https://uploadcare.com/blog/handling-large-file-uploads/)
- [Optimizing File Uploads in Web Applications (Transloadit)](https://transloadit.com/devtips/optimizing-file-uploads-in-web-applications/)
- [How to Handle Large File Uploads (DEV Community)](https://dev.to/leapcell/how-to-handle-large-file-uploads-without-losing-your-mind-3dck)

**Streaming JSON Parsing:**
- [JSON Streaming: How to Work with Large JSON Files Efficiently (Medium)](https://medium.com/@AlexanderObregon/json-streaming-how-to-work-with-large-json-files-efficiently-c7203de60ac2)
- [Processing Large JSON Files in Python Without Running Out of Memory (Python Speed)](https://pythonspeed.com/articles/json-memory-streaming/)
- [stream-json npm package](https://www.npmjs.com/package/stream-json)

**ChatGPT Export Structure:**
- [Decoding Exported Data by Parsing conversations.json (OpenAI Community)](https://community.openai.com/t/decoding-exported-data-by-parsing-conversations-json-and-or-chat-html/403144)
- [Questions About JSON Structures in Exported conversations.json (OpenAI Community)](https://community.openai.com/t/questions-about-the-json-structures-in-the-exported-conversations-json/954762)
- [Convoviz GitHub Repository](https://github.com/mohamed-chs/convoviz)

**Progress & UX:**
- [Progress Trackers and Indicators (UserGuiding)](https://userguiding.com/blog/progress-trackers-and-indicators)
- [Response Time Limits (Nielsen Norman Group)](https://www.nngroup.com/articles/response-times-3-important-limits/)
- [Handling Long-Running Tasks in Modern Web Apps](https://www.ichaoran.com/posts/2024-11-26-long-running-task-app/)

**Error Handling:**
- [10 Design Guidelines for Reporting Errors in Forms (NN/g)](https://www.nngroup.com/articles/errors-forms-design-guidelines/)
- [Error Messages: Examples, Best Practices & Common Mistakes (CXL)](https://cxl.com/blog/error-messages/)
- [Data Validation and Error Handling Best Practices (Echobind)](https://echobind.com/post/data-validation-error-handling-best-practices)

**Background Processing:**
- [The Complete Guide to Background Processing with FastAPI × Celery/Redis](https://blog.greeden.me/en/2026/01/27/the-complete-guide-to-background-processing-with-fastapi-x-celery-redishow-to-separate-heavy-work-from-your-api-to-keep-services-stable/)
- [How to Implement Background Job Processing in Go](https://oneuptime.com/blog/post/2026-01-30-go-background-job-processing/view)

**Mobile Constraints:**
- [Uploading Large Files from iOS Applications (Bipsync)](https://bipsync.com/blog/uploading-large-files-from-ios-applications/)
- [Mobile vs Desktop Usage Statistics for 2026 (Research.com)](https://research.com/software/guides/mobile-vs-desktop-usage)

---
*Feature research for: Bulletproof ChatGPT Import Processing*
*Researched: 2026-02-09*
