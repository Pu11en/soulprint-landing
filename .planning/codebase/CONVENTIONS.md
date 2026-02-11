# Coding Conventions

**Analysis Date:** 2026-02-11

## Naming Patterns

**Files:**
- Python: `snake_case.py` (e.g., `prompt_builder.py`, `fact_extractor.py`, `dag_parser.py`)
- TypeScript: `kebab-case.ts` or `camelCase.ts` (e.g., `prompt-helpers.test.ts`, `ttl-cache.ts`)
- Test files: `{name}.test.ts` or `{name}.spec.ts` (TypeScript), `test_{name}.py` (Python)

**Functions:**
- Python: `snake_case` (e.g., `extract_facts_from_chunk`, `consolidate_facts`, `download_conversations`)
- TypeScript: `camelCase` (e.g., `parseRequestBody`, `handleAPIError`, `checkRateLimit`)
- Async functions: Prefixed with `async` (e.g., `async function query_with_rlm()`)

**Variables:**
- Python: `snake_case` (e.g., `consolidated_facts`, `conversation_chunks`, `temp_file_path`)
- TypeScript: `camelCase` for mutable variables (e.g., `request`, `response`, `userMessage`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `MAX_CONSECUTIVE_FAILURES`, `FACT_EXTRACTION_PROMPT`)
- Private/internal: Prefix with underscore (e.g., `_try_repair_json`, `_depth`, `_max_depth`)

**Types & Schemas:**
- TypeScript: `PascalCase` for interfaces and types (e.g., `QueryRequest`, `APIErrorResponse`, `UploadSession`)
- Python: `PascalCase` for dataclasses if used (not heavily used in RLM service — mostly dicts with type hints)
- Schema exports: Match as `{name}Schema` (e.g., `chatRequestSchema`, `importCompleteSchema`)

## Code Style

**Formatting:**
- TypeScript: Inferred from ESLint config—uses Next.js core-web-vitals + TypeScript rules
- Python: No formal linter detected (PEP 8 conventions implied by codebase patterns)
- Line length: TypeScript ~100-120 characters, Python ~120+ (streaming_import.py has longer lines)

**Linting:**
- TypeScript: ESLint with `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Config: `eslint.config.mjs` (Flat config format, not .eslintrc)
- Python: No pre-commit hooks or linting config detected (adheres to general Python standards)

**Commenting:**
- Python: Module docstrings at file top (e.g., `"""Streaming Import Processor..."""`) describing purpose, design decisions, and constraints
- TypeScript: JSDoc comments for complex functions (e.g., `/** Parse and validate a request body... */`)
- Inline comments: Use sparingly, only for non-obvious logic
- Special markers: `[WARN]`, `[ERROR]`, `[ToolCall]` prefixes in print/console logs for categorization

**Spacing & Indentation:**
- Python: 4 spaces per indent level
- TypeScript: 2 spaces per indent level (Next.js/Vercel standard)

## Import Organization

**Python Order:**
1. Standard library imports (`asyncio`, `json`, `os`, `tempfile`)
2. Third-party imports (`fastapi`, `httpx`, `ijson`, `anthropic`)
3. Relative imports from local modules (`from .dag_parser import`, `from prompt_helpers import`)

**TypeScript Order:**
1. Next.js and framework imports (`from 'next/server'`, `from '@/lib/...'`)
2. Third-party imports (`from 'zod'`, `from 'vitest'`)
3. Relative imports (rare, prefer `@/` path aliases)

**Path Aliases:**
- TypeScript: Uses `@/` to point to project root (configured in `tsconfig.json`)
- Examples: `@/lib/logger`, `@/lib/api/schemas`, `@/lib/soulprint/prompt-helpers`

## Error Handling

**Strategy:**
- **Fail gracefully in pipelines**: RLM processors return `empty_facts` or `None` on error rather than raising exceptions. Pipeline never fails due to processor error (e.g., `fact_extractor.py` lines 60-111)
- **Circuit breaker pattern**: `fact_extractor.py` implements circuit breaker (5 consecutive failures) to stop batch reduction if too many errors occur (lines 394-407)
- **Best-effort updates**: RLM service updates progress with "best-effort" policy — logs warning but continues if update fails (`streaming_import.py` lines 34-60)

**Error Logging Patterns:**
- Python: `print(f"[ModuleName] Message: {detail}")` with brackets for category (e.g., `[FactExtractor] Consolidated...`)
- TypeScript: Use `createLogger()` for structured logging with context field (e.g., `log.error({ context, error }, 'API error occurred')`)
- Production vs Development: TypeScript handlers check `process.env.NODE_ENV` to include/exclude stack traces

**Exception Handling:**
- Python: Catch broad `Exception` and log + return safe default (see `fact_extractor.py` lines 109-111: catch all, log, return empty facts)
- TypeScript: Use `handleAPIError(error, context)` helper for consistent API error responses (returns 500 with structured JSON body)

## Validation

**Approach:**
- TypeScript: Centralized Zod schemas in `lib/api/schemas.ts` with `parseRequestBody()` helper
  - Returns validated data OR HTTP 400 Response
  - Converts Zod error details to human-readable messages (security: prevents schema disclosure)
- Python: Ad-hoc validation in processors (no centralized schema library)
  - Example: `conversation_chunker.py` checks for `"messages"` key to distinguish simple vs. ChatGPT export format
  - JSON repair logic in `fact_extractor.py` (lines 241-303) for truncated LLM responses

## State Management & Caching

**Pattern:** Explicit state objects passed through function chains, no global state mutations
- Example: `fact_extractor.py` consolidate/reduce functions operate on immutable dicts returned at each step
- TypeScript: `TTLCache` class with instance-level state (timers, cleanup intervals)

**Async Concurrency Control:**
- Python: `asyncio.Semaphore()` for rate limiting parallel calls (e.g., `fact_extractor.py` lines 133-144)
- TypeScript: Implicit via HTTP client limits (httpx has max concurrency settings not shown in code)

## Function Design

**Size:** Functions are concise (10-80 lines typical), with clear single responsibility
- RLM processors are 100-200 lines when they orchestrate pipelines
- Test functions/fixtures are helper methods (small utility functions)

**Parameters:**
- Python: Use type hints on all function parameters (e.g., `chunks: List[dict]`, `anthropic_client`)
- TypeScript: Full type annotations required
- Optional params: Use `Optional[Type]` (Python) or `?:` (TypeScript)

**Return Values:**
- Explicit return types documented (Python docstrings, TypeScript type annotations)
- Success: Return data directly (e.g., dict, List[dict], Response)
- Failure: Return `None` or empty structure (fail-safe), not exceptions

**Documentation:**
- Python: Docstrings with Args, Returns, Raises sections (see `conversation_chunker.py` lines 25-34, `fact_extractor.py` lines 50-61)
- TypeScript: JSDoc comments for public APIs (see `ttl-cache.ts` class methods)

## Module Design

**Exports:**
- Python: Functions exported by being defined at module level; no `__all__` lists observed
- TypeScript: Named exports preferred (e.g., `export function handleAPIError()`, `export const TTLCache`)
  - Exception: Class exports use `export class` directly

**Barrel Files:**
- Not used extensively in this codebase
- Processors use explicit imports (e.g., `from .dag_parser import extract_active_path`)

**Module Responsibility:**
- Single purpose per file (e.g., `fact_extractor.py` = fact extraction only, `streaming_import.py` = streaming download + progress)
- Related utilities grouped (e.g., all prompt-related code in `prompt_helpers.py` + `prompt_builder.py`)

## Async/Await Patterns

**Python:**
- `async def` for I/O-bound functions (httpx calls, Supabase updates)
- `await` for every async call (no fire-and-forget except with `asyncio.create_task()`)
- `asyncio.gather(*tasks, return_exceptions=True)` for parallel execution with error handling

**TypeScript:**
- `async` function declarations in route handlers
- Consistent `await` usage
- Promise chains avoided in favor of async/await

## Testing Conventions

- See TESTING.md for framework details
- Test functions/methods use `test()` or `it()` depending on framework
- Descriptive test names that read as sentences (e.g., `test_branching_conversation_returns_active_branch`)
- AAA pattern: Arrange, Act, Assert (setup, call, verify)

## Special Patterns

**Streaming & Memory Management:**
- RLM service emphasizes streaming to avoid OOM on large exports
- Download directly to disk (httpx streaming): `async with client.stream("GET", url)...` writes chunks to temp file
- Parse with ijson (streaming JSON parser) instead of loading entire file into memory
- Cleanup in `finally` blocks ensures temp files deleted even on error

**JSON Repair:**
- RLM processors implement JSON repair for truncated LLM responses (`_try_repair_json()` in `fact_extractor.py`)
- Attempts multiple repair strategies: close unterminated strings, balance brackets, find last complete object

**Hierarchical Reduction:**
- When facts exceed token limit, recursively reduce via Haiku 4.5 (see `hierarchical_reduce()` in `fact_extractor.py`)
- Hard truncation fallback after 3 recursion levels to prevent infinite loops

---

*Convention analysis: 2026-02-11*
