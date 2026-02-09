# Phase 2: Test Type Safety Fixes - Research

**Researched:** 2026-02-09
**Domain:** TypeScript strict mode compliance for test files
**Confidence:** HIGH

## Summary

Analyzed TypeScript compilation errors when test files are included in strict mode checking. Currently, tsconfig.json EXCLUDES all test files (`__tests__`, `tests`, `**/*.test.ts`, etc.), allowing tests to run with Vitest but hiding 21 type errors that would surface in CI or stricter environments.

**Error breakdown:**
- 2 errors: Cross-language sync tests use overly broad types for function parameters
- 6 errors: Prompt sync tests have type mismatch between test helper and actual type
- 13 errors: Integration test mocks have signature/nullability mismatches with Vitest

**Primary recommendation:** Fix type declarations in test helper functions first (cross-lang sync), then correct Vitest mock types to match actual API signatures. All fixes are localized to test files — no runtime code changes needed.

## Full Error Catalog

### Errors Found (21 total)

Ran `npx tsc --noEmit` with test files included in tsconfig.

```
__tests__/cross-lang/emotional-intelligence-sync.test.ts(23,5): error TS2322: Type '(arc: { stage: "early" | "developing" | "established"; messageCount: number; }) => string' is not assignable to type '(arc: { stage: string; messageCount: number; }) => string'.

__tests__/cross-lang/emotional-intelligence-sync.test.ts(24,5): error TS2322: Type '(state: EmotionalState) => string' is not assignable to type '(state: { primary: string; confidence: number; cues: string[]; }) => string'.

__tests__/cross-lang/prompt-sync.test.ts(176,7): error TS2322: Type 'PromptBuilderProfile' is not assignable to type 'Record<string, unknown>'.
__tests__/cross-lang/prompt-sync.test.ts(198,7): error TS2322: Type 'PromptBuilderProfile' is not assignable to type 'Record<string, unknown>'.
__tests__/cross-lang/prompt-sync.test.ts(260,7): error TS2322: Type 'PromptBuilderProfile' is not assignable to type 'Record<string, unknown>'.
__tests__/cross-lang/prompt-sync.test.ts(285,7): error TS2322: Type 'PromptBuilderProfile' is not assignable to type 'Record<string, unknown>'.
__tests__/cross-lang/prompt-sync.test.ts(309,7): error TS2322: Type 'PromptBuilderProfile' is not assignable to type 'Record<string, unknown>'.
__tests__/cross-lang/prompt-sync.test.ts(339,7): error TS2322: Type 'PromptBuilderProfile' is not assignable to type 'Record<string, unknown>'.

tests/integration/api/import/chunked-upload.test.ts(16,26): error TS2322: Type 'Buffer<ArrayBufferLike>' is not assignable to type 'BlobPart'.
tests/integration/api/import/chunked-upload.test.ts(180,7): error TS2322: Type 'null' is not assignable to type '{ path: string; }'.
tests/integration/api/import/chunked-upload.test.ts(181,7): error TS2322: Type '{ message: string; }' is not assignable to type 'null'.

tests/integration/api/import/complete.test.ts(52,5): error TS2322: Type 'Mock<() => { select: Mock<() => { eq: Mock<() => { single: Mock<() => { data: null; error: { message: string; }; }>; }>; }>; }>' is not assignable to type 'Mock<() => { select: Mock<() => { eq: Mock<() => { single: Mock<() => { data: { user_id: string; archetype: string; }; error: null; }>; }>; }>; }>'.
tests/integration/api/import/complete.test.ts(125,5): error TS2322: Type 'Mock<() => { data: { user: { email: null; user_metadata: {}; }; }; error: null; }>' is not assignable to type 'Mock<() => { data: { user: { email: string; user_metadata: { display_name: string; }; }; }; error: null; }>'.
tests/integration/api/import/complete.test.ts(173,23): error TS2532: Object is possibly 'undefined'.
tests/integration/api/import/complete.test.ts(181,5): error TS2322: Type 'Mock<() => { data: null; error: { message: string; }; }>' is not assignable to type 'Mock<() => { data: { user: { email: string; user_metadata: { display_name: string; }; }; }; error: null; }>'.
tests/integration/api/import/complete.test.ts(239,5): error TS2322: Type 'Mock<() => { data: { user: { email: string; user_metadata: {}; }; }; error: null; }>' is not assignable to type 'Mock<() => { data: { user: { email: string; user_metadata: { display_name: string; }; }; }; error: null; }>'.

tests/integration/api/import/process-server.test.ts(43,17): error TS2339: Property 'default' does not exist on type 'typeof import("zlib")'.
tests/integration/api/import/process-server.test.ts(194,5): error TS2322: Type 'Mock<() => { download: Mock<() => { data: { arrayBuffer: () => Promise<ArrayBuffer>; size: number; type: string; }; error: null; }>; remove: Mock<() => { catch: Mock<Procedure>; }>; }>' is not assignable to type 'Mock<(bucket: string) => { download: Mock<() => { data: { arrayBuffer: () => Promise<ArrayBuffer>; size: number; type: string; }; error: null; }>; upload: Mock<() => { data: { path: string; }; error: null; }>; remove: Mock<...>; }>'.
tests/integration/api/import/process-server.test.ts(223,5): error TS2322: Type 'Mock<() => { download: Mock<() => { data: null; error: { message: string; }; }>; }>' is not assignable to type 'Mock<(bucket: string) => { download: Mock<() => { data: { arrayBuffer: () => Promise<ArrayBuffer>; size: number; type: string; }; error: null; }>; upload: Mock<() => { data: { path: string; }; error: null; }>; remove: Mock<...>; }>'.
tests/integration/api/import/process-server.test.ts(282,5): error TS2322: Type 'Mock<() => { download: Mock<() => { data: { arrayBuffer: () => Promise<ArrayBuffer>; size: number; type: string; }; error: null; }>; remove: Mock<() => { catch: Mock<Procedure>; }>; }>' is not assignable to type 'Mock<(bucket: string) => { download: Mock<() => { data: { arrayBuffer: () => Promise<ArrayBuffer>; size: number; type: string; }; error: null; }>; upload: Mock<() => { data: { path: string; }; error: null; }>; remove: Mock<...>; }>'.
tests/integration/api/import/process-server.test.ts(311,5): error TS2322: Type 'Mock<() => { download: Mock<() => { data: { arrayBuffer: () => Promise<ArrayBuffer>; size: number; type: string; }; error: null; }>; remove: Mock<() => { catch: Mock<Procedure>; }>; }>' is not assignable to type 'Mock<(bucket: string) => { download: Mock<() => { data: { arrayBuffer: () => Promise<ArrayBuffer>; size: number; type: string; }; error: null; }>; upload: Mock<() => { data: { path: string; }; error: null; }>; remove: Mock<...>; }>'.
```

## Error Categories

### Category 1: Cross-language Sync Type Precision (2 errors)

**Location:** `__tests__/cross-lang/emotional-intelligence-sync.test.ts`

**Root cause:**
Test file declares function variables with overly broad inline types before importing from the actual module:

```typescript
// Lines 15-17 (current)
let buildUncertaintyInstructions: () => string;
let buildRelationshipArcInstructions: (arc: { stage: string; messageCount: number }) => string;
let buildAdaptiveToneInstructions: (state: { primary: string; confidence: number; cues: string[] }) => string;
```

The actual functions from `@/lib/soulprint/emotional-intelligence` have stricter types:
- `buildRelationshipArcInstructions` expects `{ stage: 'early' | 'developing' | 'established'; messageCount: number }`
- `buildAdaptiveToneInstructions` expects `EmotionalState` with `primary: 'frustrated' | 'satisfied' | 'confused' | 'neutral'`

**Why this matters:** The test's purpose is to verify cross-language sync between TypeScript and Python. Using `string` instead of exact union types defeats type checking and could mask mismatches where Python returns an unexpected value.

**Fix approach:**
Import the actual types from the module instead of declaring inline types:

```typescript
import type { EmotionalState } from '@/lib/soulprint/emotional-intelligence';

// Then use the actual function signatures
let buildRelationshipArcInstructions: (arc: { stage: 'early' | 'developing' | 'established'; messageCount: number }) => string;
let buildAdaptiveToneInstructions: (state: EmotionalState) => string;
```

Or better, don't pre-declare at all and let TypeScript infer from the dynamic import.

### Category 2: Prompt Sync Profile Type Mismatch (6 errors)

**Location:** `__tests__/cross-lang/prompt-sync.test.ts` (lines 176, 198, 260, 285, 309, 339)

**Root cause:**
The `callPythonPromptBuilder` helper function declares its `profile` parameter as `Record<string, unknown>`:

```typescript
// Line 71-74 (current)
function callPythonPromptBuilder(
  version: string,
  params: {
    profile: Record<string, unknown>;  // <-- Too broad
    // ...
  },
): string
```

But tests pass `TEST_PROFILE` which is typed as `PromptBuilderProfile`:

```typescript
// Line 28 (current)
const TEST_PROFILE: PromptBuilderProfile = {
  soulprint_text: 'Drew is a privacy-focused developer who builds AI tools.',
  import_status: 'complete',
  // ... more fields with `string | null` types
};
```

`PromptBuilderProfile` has stricter types (`string | null`, optional `quality_breakdown`), which TypeScript correctly flags as incompatible with the overly broad `Record<string, unknown>`.

**Why this matters:** The Python side expects the exact `PromptBuilderProfile` shape. Using `Record<string, unknown>` in the test helper loses type safety and could allow invalid test data.

**Fix approach:**
Change the `callPythonPromptBuilder` signature to accept `PromptBuilderProfile`:

```typescript
import type { PromptBuilderProfile } from '@/lib/soulprint/prompt-builder';

function callPythonPromptBuilder(
  version: string,
  params: {
    profile: PromptBuilderProfile;  // <-- Use actual type
    dailyMemory?: Array<{ fact: string; category: string }> | null;
    // ...
  },
): string
```

### Category 3: Integration Test Mock Type Mismatches (13 errors)

**Location:**
- `tests/integration/api/import/chunked-upload.test.ts` (3 errors)
- `tests/integration/api/import/complete.test.ts` (5 errors)
- `tests/integration/api/import/process-server.test.ts` (5 errors)

#### Subcategory 3a: Buffer/Blob Type Mismatch

**Error:** `chunked-upload.test.ts(16,26)` - `Buffer<ArrayBufferLike>` not assignable to `BlobPart`

**Root cause:**
```typescript
// Line 16 (current)
const blob = new Blob([buf]);  // buf is Buffer, but Blob expects BlobPart
```

In browser types, `BlobPart = string | Blob | ArrayBuffer | ArrayBufferView`. Node's `Buffer` is not directly assignable.

**Fix approach:**
Convert Buffer to ArrayBuffer or use Uint8Array:

```typescript
const blob = new Blob([new Uint8Array(buf)]);
// or
const blob = new Blob([buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)]);
```

#### Subcategory 3b: Mock Data/Error Nullability

**Errors:**
- `chunked-upload.test.ts(180,181)` - Mock returns `null` for data when it should return `{ path: string }`, and vice versa for error
- `complete.test.ts(52,125,181,239)` - Mock return types don't match original mock shape

**Root cause:**
When overriding mocks per-test, the override must match the EXACT return type of the original mock, including nullability of `data` and `error` fields.

```typescript
// Original mock returns:
{ data: { user_id: string; archetype: string }, error: null }

// Test override returns:
{ data: null, error: { message: string } }  // <-- Type mismatch

// TypeScript sees these as incompatible types
```

**Why this matters:** Vitest's `vi.mocked()` enforces type compatibility to prevent test mocks from diverging from actual API shapes.

**Fix approach:**

**Option 1:** Use type assertions to bypass strict mock typing (fastest):
```typescript
vi.mocked(createClient).mockReturnValueOnce(mockClient as any);
```

**Option 2:** Define union types for mock returns (safer):
```typescript
type SupabaseResponse<T> =
  | { data: T; error: null }
  | { data: null; error: { message: string } };

// Then use in mock definitions
```

**Option 3:** Create per-test mock factories that return correct types (most maintainable):
```typescript
function createErrorMock(message: string) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: null, error: { message } })),
        })),
      })),
    })),
  };
}
```

**Recommendation:** Use Option 1 (`as any`) for this phase. These are test mocks, not runtime code. The tests verify behavior, not mock type precision. Option 3 is better long-term but requires significant refactoring.

#### Subcategory 3c: Object Possibly Undefined

**Error:** `complete.test.ts(173)` - `Object is possibly 'undefined'`

**Root cause:**
```typescript
// Line 173 (current)
expect(vi.mocked(sendEmail).mock.calls[0][0]).toContain(...);
```

TypeScript's `noUncheckedIndexedAccess` flag makes array access return `T | undefined`. The code accesses `mock.calls[0]` without checking existence.

**Fix approach:**
Use non-null assertion or optional chaining:

```typescript
expect(vi.mocked(sendEmail).mock.calls[0]![0]).toContain(...);
// or
const emailCall = vi.mocked(sendEmail).mock.calls[0];
expect(emailCall).toBeDefined();
expect(emailCall![0]).toContain(...);
```

#### Subcategory 3d: Zlib Default Export

**Error:** `process-server.test.ts(43)` - `Property 'default' does not exist on type 'typeof import("zlib")'`

**Root cause:**
```typescript
// Lines 38-47 (current)
vi.mock('zlib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('zlib')>();
  return {
    ...actual,
    default: {  // <-- zlib has no default export
      ...actual.default,
      gzipSync: vi.fn((buffer) => Buffer.from('compressed-data')),
    },
    gzipSync: vi.fn((buffer) => Buffer.from('compressed-data')),
  };
});
```

Node's `zlib` is a CommonJS module with named exports only, no default export.

**Fix approach:**
Remove the `default` property entirely:

```typescript
vi.mock('zlib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('zlib')>();
  return {
    ...actual,
    gzipSync: vi.fn((buffer) => Buffer.from('compressed-data')),
  };
});
```

#### Subcategory 3e: Storage Mock Signature Mismatch

**Errors:** `process-server.test.ts(194,223,282,311)` - Storage `from()` mock signature mismatch

**Root cause:**
The base `createMockAdminClient` defines `storage.from` with a bucket parameter:

```typescript
// Line 73 (base mock)
from: vi.fn((bucket: string) => ({
  download: vi.fn(...),
  upload: vi.fn(...),
  remove: vi.fn(...),
}))
```

But per-test overrides omit the bucket parameter:

```typescript
// Line 194 (test override)
mockClient.storage.from = vi.fn(() => ({  // <-- Missing (bucket: string) param
  download: vi.fn(() => ({
    data: createMockBlob(JSON.stringify([{ no_mapping: true }])),
    error: null,
  })),
  remove: vi.fn(() => ({ catch: vi.fn() })),
}));
```

The override also omits the `upload` method that the base mock includes.

**Fix approach:**

**Option 1:** Match the base signature exactly (include bucket param and all methods):
```typescript
mockClient.storage.from = vi.fn((bucket: string) => ({
  download: vi.fn(() => ({ ... })),
  upload: vi.fn(() => ({ data: { path: 'test-path' }, error: null })),
  remove: vi.fn(() => ({ catch: vi.fn() })),
}));
```

**Option 2:** Use type assertion (faster):
```typescript
mockClient.storage.from = vi.fn(() => ({ ... })) as any;
```

**Recommendation:** Use Option 2 (`as any`) for this phase. The test doesn't use the bucket parameter or upload method in these specific scenarios, so exact type matching adds no value.

## Fix Strategy

### Priority 1: Cross-language sync types (MUST FIX)

These tests verify Python/TypeScript parity. Type precision is critical.

**Tasks:**
1. Fix `emotional-intelligence-sync.test.ts` - use actual types, not inline declarations
2. Fix `prompt-sync.test.ts` - change `callPythonPromptBuilder` to accept `PromptBuilderProfile`

**Estimated effort:** 15 minutes

### Priority 2: Integration mock types (SHOULD FIX)

These are test infrastructure issues, not runtime bugs. Fixes ensure tests compile in strict mode.

**Tasks:**
1. Fix `chunked-upload.test.ts` - Buffer to BlobPart conversion, mock nullability
2. Fix `complete.test.ts` - add `!` for array access, use `as any` for mock overrides
3. Fix `process-server.test.ts` - remove zlib.default, add `as any` for storage mocks

**Estimated effort:** 30 minutes

### Verification

After fixes, run:
```bash
npx tsc --noEmit  # Should show 0 errors in test files
npm test          # All tests should still pass
```

## Risks

### Risk 1: Type assertions hide real issues

**Mitigation:** Only use `as any` for Vitest mock overrides, not for test logic. The tests themselves verify behavior; mock type precision is secondary.

### Risk 2: Removing test file exclusion could break build

**Current state:** `tsconfig.json` excludes test files, so these errors don't block builds.

**Mitigation:** Fix all errors BEFORE removing the exclusion. Then update tsconfig in a separate commit.

### Risk 3: Tests pass at runtime but fail type checking

**Why it happens:** Vitest runs tests with its own TypeScript setup, which may be more lenient than strict mode.

**Mitigation:** After fixing types, add a pre-commit hook or CI check that runs `npx tsc --noEmit` with test files included.

## Standard Patterns for Test Type Safety

### Pattern 1: Import actual types, don't inline

**Bad:**
```typescript
let myFunction: (arg: string) => number;
```

**Good:**
```typescript
import type { MyFunction } from '@/lib/module';
let myFunction: MyFunction;
```

### Pattern 2: Use type assertions for mock overrides

**Bad:** Try to make mock types perfectly match (painful)

**Good:**
```typescript
vi.mocked(module).mockReturnValueOnce(testValue as any);
```

### Pattern 3: Non-null assertions for array access with noUncheckedIndexedAccess

**Bad:**
```typescript
const item = array[0];  // Type: T | undefined
```

**Good:**
```typescript
const item = array[0]!;  // Type: T (asserted non-null)
// or
expect(array[0]).toBeDefined();
const item = array[0]!;
```

### Pattern 4: Match CommonJS module structure in mocks

**Bad:**
```typescript
vi.mock('zlib', () => ({
  default: { gzipSync: vi.fn() },  // zlib has no default
}));
```

**Good:**
```typescript
vi.mock('zlib', () => ({
  gzipSync: vi.fn(),  // Named export only
}));
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type-safe test mocks | Manual mock types matching each API | Vitest's `vi.mocked()` with `as any` for overrides | Vitest already provides type inference; perfect typing adds no test value |
| Buffer/Blob conversions | Custom buffer wrapper | `new Uint8Array(buffer)` | Built-in, no dependencies |
| Dynamic import type inference | Pre-declared function signatures | Let TypeScript infer from import result | Reduces maintenance, ensures type accuracy |

## Verification Checklist

After implementing fixes:

- [ ] Run `npx tsc --noEmit` with test files included → 0 errors
- [ ] Run `npm test` → all tests pass
- [ ] Check that test behavior is unchanged (no false positives/negatives)
- [ ] Consider updating tsconfig.json to include test files (separate task)

## Sources

### Primary (HIGH confidence)
- TypeScript compiler output (`npx tsc --noEmit` with test files included)
- Test file source code (`__tests__/**/*.ts`, `tests/**/*.ts`)
- Type definitions (`lib/soulprint/emotional-intelligence.ts`, `lib/soulprint/prompt-builder.ts`)

### Secondary (MEDIUM confidence)
- Vitest documentation on mock typing (inference from usage)
- TypeScript handbook on `noUncheckedIndexedAccess` (affects array access)

## Metadata

**Confidence breakdown:**
- Error catalog: HIGH - Direct compiler output, exact line numbers
- Root cause analysis: HIGH - Verified against source code and type definitions
- Fix approaches: HIGH - Standard TypeScript patterns for each error category

**Research date:** 2026-02-09
**Valid until:** 90 days (stable domain - TypeScript compiler behavior, Vitest mock types)
