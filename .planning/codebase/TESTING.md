# Testing Patterns

**Analysis Date:** 2026-02-01

## Test Framework

**Status:** Not detected

**Current State:**
- No test framework is configured (Jest, Vitest, or others)
- No test files exist in source tree (`app/`, `lib/`, `components/`)
- `package.json` contains no testing dependencies
- No test configuration files found (`jest.config.js`, `vitest.config.ts`, etc.)
- Test output files present (`test-output.txt`, `test-output-final.txt`) but represent manual/exploratory testing, not automated suites

**Development Testing:**
- Manual testing through `npm run dev` (Next.js dev server)
- Browser/UI testing during development
- No automated test runners currently in place

## Why Testing is Currently Missing

The codebase shows signs of rapid iteration and feature development:
- Recent commits focused on feature additions (mobile chat redesign, app simplification)
- Complex async operations (LLM analysis, embeddings, Supabase queries) currently tested manually
- No infrastructure for automated testing set up
- Focus has been on feature delivery rather than test infrastructure

## Recommended Testing Strategy

**Unit Tests:**
- Utility functions: `lib/utils.ts` (cn function)
- Gamification logic: `lib/gamification/xp.ts` (calculations, level progression)
- Data parsing: `lib/import/parser.ts` (ChatGPT export parsing)
- Fact extraction: `lib/memory/facts.ts` (JSON parsing, filtering)

**Integration Tests:**
- API routes with Supabase: `app/api/admin/health/route.ts`, `app/api/admin/metrics/route.ts`
- Server actions: `app/actions/auth.ts` (sign up, sign in, OAuth flow)
- File operations: `app/api/branch/route.ts` (create, read, write branches)

**Component Tests (if added):**
- Form components: `components/auth/login-form.tsx`, `components/auth/signup-modal.tsx`
- Chat components: `components/chat/ChatInput.tsx`, `components/chat/ChatMessage.tsx`
- Toast system: `components/AchievementToast.tsx` (rendering, auto-dismiss, queue)

## Critical Areas Without Tests

**High Priority for Testing:**

**Authentication Flow** (`app/actions/auth.ts`):
- User sign-up with referral code recording
- Sign-in with password
- OAuth sign-in with Google
- Sign-out with cookie cleanup
- Session persistence checks

**Import & Analysis Pipeline** (`lib/import/`):
- `parser.ts`: Parsing ChatGPT export ZIPs, message ordering
- `soulprint.ts`: LLM-based personality analysis, sampling logic
- `embedder.ts`: OpenAI embedding batching, vector storage
- `personality-analysis.ts`: JSON extraction from LLM responses

**Memory System** (`lib/memory/`):
- `facts.ts`: Fact extraction confidence filtering
- `learning.ts`: Fact storage, deduplication
- `query.ts`: Semantic search over embeddings

**Gamification** (`lib/gamification/xp.ts`):
- Level calculation from XP
- Progress percentage calculation
- Achievement unlocking logic

**Data Sync** (`components/chat/BackgroundSync.tsx`):
- IndexedDB operations
- Batch upload logic
- State management during sync

## Manual Testing Observations

**Test Output Files** (exploratory):
- `test-output.txt`, `test-output-2.txt`, etc. present in root
- Indicate manual testing/verification was performed
- Not part of automated pipeline

**Testing During Development:**
- Developers use `npm run dev` and browser to test
- Changes verified manually before commits
- Recent commits show feature-focused testing

## Testing Infrastructure Requirements

**To Implement Testing:**

1. **Install testing framework:**
   ```bash
   npm install --save-dev vitest @vitest/ui
   # Or
   npm install --save-dev jest @testing-library/react @testing-library/dom
   ```

2. **Testing utilities for this stack:**
   - Supabase mocking: `supabase/supabase-js` has testing support
   - OpenAI mocking: Mock HTTP responses or use test API keys
   - Next.js testing: Use `next/experimental/testing/library` or standalone test runners

3. **Configuration needs:**
   - TypeScript support (both frameworks support `tsconfig.json`)
   - Path alias support (`@/*`) must be configured in test setup
   - Environment variable handling for tests

4. **Recommended approach for this codebase:**
   - Start with Vitest (smaller, faster, TypeScript-first)
   - Add @vitest/ui for visual feedback
   - Use MSW (Mock Service Worker) for API mocking
   - Co-locate tests with source files using `.test.ts` or `.spec.ts` suffix

## Test Data Considerations

**API Mocking Needed:**
- Supabase Auth API (sign-up, sign-in, OAuth)
- Supabase Database (profiles, conversations, memories, chunks)
- OpenAI API (embeddings)
- Bedrock API (LLM calls for analysis)
- Resend Email API

**Fixtures Directory Structure** (recommended):
```
lib/
  __tests__/
    fixtures/
      chatgpt-export.json
      parsed-conversation.json
      memory-chunks.json
      embeddings.json
    mocks/
      supabase.ts
      openai.ts
      bedrock.ts
```

**Sample Test Data Format:**
- ChatGPT conversations: `lib/import/client-soulprint.ts` shows expected structure
- Parsed conversations: `lib/import/parser.ts` defines `ParsedConversation` interface
- Memory chunks: `lib/import/chunker.ts` defines `Chunk` interface
- Embeddings: Arrays of numbers matching OpenAI embedding dimensions

## Current Code Structure for Testing

**Testable Utilities** (already modular, easy to test):
- `lib/utils.ts`: Simple `cn()` utility
- `lib/gamification/xp.ts`: Pure functions for calculations
- `lib/import/parser.ts`: Pure parsing logic
- `lib/import/chunker.ts`: Chunking algorithms
- `lib/memory/facts.ts`: Fact filtering and grouping

**Testable API Routes** (with mocked services):
- `app/api/admin/health/route.ts`: Service health checks
- `app/api/admin/metrics/route.ts`: Data aggregation
- `app/api/branch/route.ts`: File operations

**Testable Server Actions** (with mocked Supabase):
- `app/actions/auth.ts`: All auth flows
- `app/actions/referral.ts`: Referral recording

**Untestable Without Major Refactoring** (tightly coupled to external services):
- Components with side effects: `components/chat/BackgroundSync.tsx`
- IndexedDB operations in components

## Testing Best Practices for This Codebase

**Pattern 1: Pure Function Testing**
```typescript
// lib/gamification/xp.ts - Already testable
import { XP_CONFIG } from '@/lib/gamification/xp';

describe('XP Calculation', () => {
  it('should calculate correct level from XP', () => {
    expect(XP_CONFIG.calculateLevel(0)).toBe(1);
    expect(XP_CONFIG.calculateLevel(110)).toBe(2);
  });

  it('should calculate progress to next level', () => {
    const progress = XP_CONFIG.getLevelProgress(55);
    expect(progress.current).toBe(55);
    expect(progress.needed).toBe(100);
  });
});
```

**Pattern 2: Async Service Function Testing**
```typescript
// lib/memory/facts.ts - Requires Bedrock mocking
import { extractFacts } from '@/lib/memory/facts';
import { vi } from 'vitest';

vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: vi.fn(),
  InvokeModelCommand: vi.fn(),
}));

describe('Fact Extraction', () => {
  it('should extract facts from memory chunks', async () => {
    const mockResponse = {
      facts: [{
        category: 'preferences',
        fact: 'Likes coffee',
        confidence: 0.9,
        sourceChunkId: 'chunk-1',
        evidence: 'I love coffee'
      }]
    };

    const facts = await extractFacts([...]);
    expect(facts.length).toBeGreaterThan(0);
  });
});
```

**Pattern 3: API Route Testing**
```typescript
// app/api/branch/route.ts - Requires Supabase mocking
import { POST } from '@/app/api/branch/route';

describe('Branch API', () => {
  it('should create branch on POST', async () => {
    const request = new Request('http://localhost:3000/api/branch', {
      method: 'POST',
      body: JSON.stringify({ action: 'create', files: [] })
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
```

## Environment for Tests

**Required Environment Variables** (for integration tests):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
BEDROCK_MODEL_ID
OPENAI_API_KEY
```

**Test Environment Setup** (recommended):
- Use `.env.test` with mock/test credentials
- Mock all external API calls with MSW or vi.mock()
- Use test database or in-memory SQLite for Supabase
- Never make real API calls from test suite

---

*Testing analysis: 2026-02-01*
