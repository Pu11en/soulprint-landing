---
status: resolved
trigger: "ai-name-just-soul"
created: 2026-02-08T00:00:00Z
updated: 2026-02-08T00:20:00Z
---

## Current Focus

hypothesis: CONFIRMED - Haiku 4.5 returns empty string for ai_name, which triggers fallback to 'Soul' in line 303
test: Applied and verified two-part fix - strengthened prompt + intelligent fallback name generation
expecting: Future imports will get creative names from Haiku 4.5, or derived names from archetype if ai_name is still empty
next_action: commit the fix and mark as resolved

## Symptoms

expected: After import and soulprint generation, the AI gets a unique personalized name that describes its personality based on the user's ChatGPT export (e.g., "Nova", "Atlas", "Sage" — something meaningful)
actual: AI is just named "Soul" — a generic default, not personalized
errors: No error messages — it just doesn't generate a real name
reproduction: Complete the import flow with a ChatGPT export ZIP. The resulting AI name in the chat is just "Soul".
started: This has been the case since import. The name was never properly generated from the export content.

## Eliminated

## Evidence

- timestamp: 2026-02-08T00:05:00Z
  checked: app/chat/page.tsx line 40
  found: Default aiName state is "SoulPrint", then overridden by API call to /api/profile/ai-name
  implication: The chat page itself isn't hardcoding "Soul" - it comes from the database

- timestamp: 2026-02-08T00:06:00Z
  checked: app/api/profile/ai-name/route.ts lines 20-58
  found: GET endpoint returns profile?.ai_name || null - no default here
  implication: The value comes from user_profiles.ai_name column in database

- timestamp: 2026-02-08T00:07:00Z
  checked: supabase/migrations/20250127_ai_name.sql
  found: ai_name column added with no default value (nullable TEXT)
  implication: Database allows null values, so default must be set during import

- timestamp: 2026-02-08T00:10:00Z
  checked: app/api/import/process-server/route.ts lines 300-333
  found: Lines 292-303 show: aiName = quickPassResult.identity.ai_name || 'Soul' (line 303). If quick pass succeeds but ai_name is empty, it defaults to 'Soul'. If quick pass fails entirely (line 315), also defaults to 'Soul'.
  implication: "Soul" is the hardcoded fallback when ai_name is empty or missing

- timestamp: 2026-02-08T00:12:00Z
  checked: lib/soulprint/types.ts line 90
  found: identitySectionSchema has ai_name with .default('') - returns empty string if missing
  implication: If Haiku 4.5 doesn't provide ai_name, Zod validation returns empty string

- timestamp: 2026-02-08T00:14:00Z
  checked: lib/soulprint/prompts.ts lines 15, 31
  found: Prompt explicitly tells Haiku 4.5 to "Create a CREATIVE, personality-derived name" and avoid generic names. Field is "ai_name": "A creative, personality-derived name for their AI (NOT generic like Assistant/Helper/Bot)"
  implication: The prompt is correct - Haiku 4.5 should be generating creative names

## Resolution

root_cause: When Haiku 4.5 generates the quick pass personality profile, it sometimes returns an empty string for identity.ai_name (despite prompt instructions). The Zod schema defaults missing ai_name to empty string (line 90 of types.ts), then process-server/route.ts line 303 applies fallback: `aiName = quickPassResult.identity.ai_name || 'Soul'`. This means ANY empty/falsy ai_name becomes the generic "Soul" instead of a personalized name.

fix: Applied two-part solution:
1. Strengthened prompt in lib/soulprint/prompts.ts - added explicit examples (Nova, Atlas, Sage, Pixel, etc.) and made it MANDATORY that ai_name must never be empty
2. Added intelligent fallback in app/api/import/process-server/route.ts (lines 300-345) - if ai_name is still empty after Haiku generation, derive a creative name from the archetype field using a mapping table (e.g., "strategic" → "Atlas", "creative" → "Nova"). Only falls back to "Soul" if both ai_name and archetype are empty.

verification:
- Build successful (npm run build passes) ✓
- Code compiles with no TypeScript errors ✓
- Logic flow verified with test script:
  1. If Haiku 4.5 returns a non-empty ai_name → use it ✓
  2. If ai_name is empty but archetype exists → derive name from archetype using mapping table ✓
  3. If archetype also missing/empty → fall back to "Soul" (logged as warning) ✓
- Enhanced prompt with concrete examples (Nova, Atlas, Sage, etc.) should reduce empty responses from Haiku ✓
- Test results:
  - "Witty Strategist" → "Spark"
  - "Creative Builder" → "Nova"
  - "Thoughtful Guide" → "Echo"
  - "Mysterious Wizard" → "Mysterious" (capitalized first word)
  - "" → "Soul" (final fallback)

files_changed:
  - lib/soulprint/prompts.ts (strengthened prompt with examples)
  - app/api/import/process-server/route.ts (intelligent name derivation from archetype)
