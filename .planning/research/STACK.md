# Technology Stack for Next.js App Hardening

**Project:** SoulPrint Landing
**Domain:** Next.js 16 + Supabase + AWS Bedrock Application Security & Testing
**Researched:** 2026-02-06
**Confidence:** HIGH

## Recommended Stack

### Testing Framework
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vitest | ^3.0.0 | Unit & Component Testing | 10-20x faster than Jest in watch mode, native ESM support, no heavy config needed. Official Next.js docs now recommend it. Works seamlessly with Next.js 15/16. |
| React Testing Library | ^16.0.0 | Component Testing | Industry standard for testing React components. Focuses on user behavior over implementation details. Essential with Vitest. |
| Playwright | ^1.50.0 | E2E Testing | Multi-browser support (Chromium, Firefox, WebKit), built-in automatic waiting, production-ready. Official Next.js recommendation for E2E tests. Required for testing async Server Components. |
| MSW (Mock Service Worker) | ^2.6.0 | API Mocking | Network-level API mocking works for both client and server. Framework-agnostic, intercepts fetch/axios/etc regardless of implementation. |

### CSRF Protection
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @edge-csrf/nextjs | ^2.1.0 | CSRF Token Protection | Built specifically for Next.js Edge Runtime and Vercel. Lightweight, works with API routes and Server Actions. Better than next-csrf for serverless. |

### Rate Limiting
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @upstash/ratelimit | ^2.0.3 | Serverless Rate Limiting | Purpose-built for Vercel Edge/serverless. Uses Upstash Redis (REST API-based, no connection overhead). Caches data while function is "hot" to reduce Redis calls. |
| @arcjet/next | ^1.0.0-alpha.28 | Comprehensive Security (Alternative) | All-in-one security: rate limiting, bot detection, Shield WAF, email validation. Runs in Next.js middleware. More opinionated than Upstash. |

### TypeScript Type Safety
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | ^5.7.0 | Static Type Checking | Core language. Use strict mode with all flags enabled. |
| @total-typescript/ts-reset | ^0.6.1 | Type System Improvements | "CSS reset" for TypeScript. Changes JSON.parse to return `unknown` instead of `any`, forcing proper validation. Makes fetch, localStorage safer. |
| zod | ^3.24.1 | Runtime Validation | TypeScript-first schema validation. Infers types from schemas. Essential for API routes, user input, external data. Zero dependencies. |
| @typescript-eslint/eslint-plugin | ^8.19.0 | Lint Rules | Type-aware linting. Use `strict-type-checked` config for maximum safety. Catches bugs that TypeScript compiler misses. |

### Security Headers & Protection
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| next-secure-headers | ^2.2.0 | Security Headers | Sets CSP, HSTS, X-Frame-Options, etc. for Next.js without custom server. Retains Automatic Static Optimization. |
| eslint-plugin-no-unsanitized | ^4.1.2 | XSS Prevention | Blocks unsafe innerHTML, outerHTML, insertAdjacentHTML. Critical for preventing XSS attacks. |

### Memory Leak Detection
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| memlab | ^1.2.2 | Browser Memory Leak Detection | Meta's tool for finding memory leaks in web apps. Works with Playwright/Puppeteer. Built-in leak detectors. |
| Chrome DevTools | Built-in | Node.js Memory Profiling | Both Node.js and Chrome run V8, so DevTools can profile Node apps. Heap snapshots, allocation timelines. Best for server-side leaks. |

### Supporting Testing Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/jest-dom | ^6.6.3 | Custom Matchers | Adds toBeInTheDocument(), toHaveValue(), etc. Improves test readability. |
| @vitejs/plugin-react | ^4.3.4 | Vite React Support | Required by Vitest for React component testing. Handles JSX transformation. |
| vite-tsconfig-paths | ^5.1.4 | Path Alias Resolution | Makes Vitest understand tsconfig path mappings like `@/components`. |
| jsdom | ^25.0.1 | DOM Environment | Simulates browser DOM in Node.js for Vitest component tests. |

### Development Tools
| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| @typescript-eslint/parser | ^8.19.0 | TypeScript ESLint Parser | Required for linting TypeScript with type information. |
| eslint-config-next | ^15.1.6 | Next.js ESLint Config | Pre-configured rules for Next.js best practices. |

## Installation

### Core Testing Setup
```bash
# Vitest + React Testing Library
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom vite-tsconfig-paths

# Playwright E2E
npm install -D @playwright/test
npx playwright install --with-deps

# API Mocking
npm install -D msw
```

### Security & Rate Limiting
```bash
# CSRF Protection
npm install @edge-csrf/nextjs

# Rate Limiting (choose one)
npm install @upstash/ratelimit @upstash/redis
# OR
npm install @arcjet/next

# Security Headers
npm install next-secure-headers
```

### Type Safety
```bash
# Zod Runtime Validation
npm install zod

# TypeScript Reset
npm install -D @total-typescript/ts-reset

# Strict ESLint
npm install -D @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-no-unsanitized
```

### Memory Leak Detection
```bash
# Memlab
npm install -D memlab
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Unit Testing | Vitest | Jest | Jest is slower (20x in watch mode), requires heavy config for ESM, Babel transforms add overhead. Jest 30 improved but still behind Vitest. |
| E2E Testing | Playwright | Cypress | Playwright has better multi-browser support, faster, works with Server Components. Cypress has licensing concerns for teams. |
| Rate Limiting | @upstash/ratelimit | Vercel WAF | Vercel WAF requires Pro/Enterprise plan. Upstash works on Hobby tier. More control over logic. |
| CSRF | @edge-csrf/nextjs | next-csrf | next-csrf doesn't support Edge Runtime. @edge-csrf designed specifically for Vercel Edge. |
| Runtime Validation | Zod | Yup | Zod is TypeScript-first (infer types from schema), zero dependencies, better DX. Yup requires separate type definitions. |
| Memory Profiling | Chrome DevTools + memlab | Clinic.js | Clinic.js is unmaintained as of 2025, breaks with newer Node versions. Chrome DevTools is always current. |
| Security | @arcjet/next | Individual libraries | Arcjet is all-in-one but opinionated and still alpha. Use individual libraries for production stability. Consider Arcjet post-beta. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Jest (new projects) | Slow, complex ESM config, Babel overhead. Next.js moved to Vitest in docs. | Vitest |
| Helmet.js | Requires custom Express server, Next.js team discourages custom servers. Breaks Vercel optimizations. | next-secure-headers |
| Clinic.js | Unmaintained since 2024, breaks with Node 20+. Tied to Node internals. | Chrome DevTools, memlab |
| Generic rate limiting (express-rate-limit, etc.) | Stateful, requires connection pooling. Doesn't work in serverless. | @upstash/ratelimit (Redis REST API) |
| TypeScript without strict mode | Allows implicit `any`, unsafe null handling, weak type checking. Technical debt grows fast. | tsconfig.json with `"strict": true` |
| Mixing Jest and Vitest | Different mocking APIs, config conflicts, confusing for team. Pick one. | Vitest (new standard) |

## Configuration Examples

### Vitest Setup (vitest.config.mts)
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
})
```

### TypeScript Strict Config (tsconfig.json)
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### ts-reset Import (src/reset.d.ts)
```typescript
import '@total-typescript/ts-reset'
```

### ESLint Strict Config (.eslintrc.json)
```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/strict-type-checked",
    "plugin:no-unsanitized/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": true
  },
  "plugins": ["@typescript-eslint", "no-unsanitized"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-member-access": "error"
  }
}
```

### Upstash Rate Limiting (middleware.ts)
```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  analytics: true,
});

export async function middleware(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return new Response("Too Many Requests", { status: 429 });
  }

  return NextResponse.next();
}
```

## Stack Patterns by Variant

**If you need comprehensive security (CSRF + rate limiting + bot detection + WAF):**
- Use @arcjet/next once it reaches stable (currently alpha)
- Implements all security in middleware with single SDK
- Trade-off: More opinionated, newer library, less community examples

**If you need granular control and production stability:**
- Use @edge-csrf/nextjs + @upstash/ratelimit + next-secure-headers separately
- More configuration but battle-tested libraries
- Better for large-scale production apps today

**If you have existing Jest tests:**
- Keep Jest for now, add Vitest incrementally
- Don't rewrite all tests at once
- New tests in Vitest, migrate old tests over time

**If testing async Server Components:**
- Use Playwright E2E tests exclusively
- Vitest doesn't support async Server Components yet
- This is a React ecosystem limitation, not Vitest-specific

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Vitest ^3.0.0 | Next.js 15, 16 | Requires @vitejs/plugin-react ^4.3+ |
| Playwright ^1.50.0 | Next.js 15, 16 | Works with App Router and Pages Router |
| @upstash/ratelimit ^2.0.0 | Vercel Edge, Next.js Middleware | Requires @upstash/redis ^1.34+ |
| @arcjet/next ^1.0.0-alpha | Next.js 15, 16 | ESM only, alpha stability |
| @typescript-eslint/eslint-plugin ^8.0.0 | TypeScript ^5.6+ | Use with @typescript-eslint/parser same version |
| zod ^3.24.0 | TypeScript ^5.0+ | Zero peer dependencies |
| @total-typescript/ts-reset ^0.6.0 | TypeScript ^5.0+ | Import once in .d.ts file |

## Confidence Assessment

| Area | Level | Source | Notes |
|------|-------|--------|-------|
| Testing (Vitest) | HIGH | Official Next.js docs, verified with WebFetch | Next.js docs explicitly recommend Vitest as of 2025/2026 |
| Testing (Playwright) | HIGH | Official Next.js docs, verified with WebFetch | Official E2E testing recommendation |
| Rate Limiting (Upstash) | HIGH | Multiple sources, GitHub verified | Purpose-built for serverless, 3.6k+ GitHub stars |
| CSRF Protection | MEDIUM | WebSearch + npm docs | @edge-csrf/nextjs is specialized but less documented than alternatives |
| Type Safety (Zod) | HIGH | Multiple authoritative sources | De facto standard for runtime validation in TS ecosystem |
| Type Safety (ts-reset) | HIGH | Total TypeScript (Matt Pocock), verified docs | Well-known in TS community, 7k+ GitHub stars |
| Memory Profiling | MEDIUM | WebSearch + GitHub | Memlab is Meta-maintained but less widely adopted. Chrome DevTools is universal. |
| Security (Arcjet) | LOW | WebSearch only, alpha version | Still in alpha, not production-ready, but promising future option |

## Sources

### Official Documentation
- [Next.js Testing: Vitest](https://nextjs.org/docs/app/guides/testing/vitest) - HIGH confidence
- [Next.js Testing: Playwright](https://nextjs.org/docs/app/guides/testing/playwright) - HIGH confidence
- [Next.js Security Guide](https://nextjs.org/blog/security-nextjs-server-components-actions) - HIGH confidence
- [Zod Official Docs](https://zod.dev/) - HIGH confidence
- [TypeScript ESLint Shared Configs](https://typescript-eslint.io/users/configs/) - HIGH confidence

### Package Documentation
- [Upstash Rate Limiting Overview](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview) - HIGH confidence
- [Upstash Blog: Rate Limiting with Vercel Edge](https://upstash.com/blog/edge-rate-limiting) - HIGH confidence
- [@edge-csrf/nextjs npm](https://www.npmjs.com/package/@edge-csrf/nextjs) - MEDIUM confidence
- [@arcjet/next npm](https://www.npmjs.com/package/@arcjet/next) - MEDIUM confidence
- [Memlab GitHub](https://github.com/facebook/memlab) - MEDIUM confidence
- [MSW Official Docs](https://mswjs.io/) - HIGH confidence
- [ts-reset Official Docs](https://www.totaltypescript.com/ts-reset) - HIGH confidence

### Community & Comparisons
- [Vitest vs Jest Comparison (Better Stack)](https://betterstack.com/community/guides/scaling-nodejs/vitest-vs-jest/) - MEDIUM confidence
- [Vitest vs Jest 2026 Analysis (DEV Community)](https://dev.to/dataformathub/vitest-vs-jest-30-why-2026-is-the-year-of-browser-native-testing-2fgb) - MEDIUM confidence
- [React Testing Library Guide 2026](https://thinksys.com/qa-testing/react-testing-library-complete-guide-2023/) - MEDIUM confidence
- [Next.js Security Checklist (Arcjet Blog)](https://blog.arcjet.com/next-js-security-checklist/) - MEDIUM confidence
- [TypeScript Strict Mode Best Practices](https://betterstack.com/community/guides/scaling-nodejs/typescript-strict-option/) - MEDIUM confidence

---
*Stack research for: Next.js 16 Application Security & Testing Hardening*
*Researched: 2026-02-06*
*Researcher: GSD Project Researcher*
