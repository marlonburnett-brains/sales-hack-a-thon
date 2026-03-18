# Deferred Items

## 2026-03-09

- `cd apps/agent && npx tsc --noEmit` fails due to numerous pre-existing agent/schema type errors outside Phase 52 Plan 01 scope (for example `src/lib/db.ts`, `src/lib/agent-executor.ts`, `src/mastra/index.ts`, and `packages/schemas/index.ts`).
- Per execution scope boundary, these unrelated baseline issues were not modified here. Plan 52-01 verification relied on the targeted Vitest suite for the new assembler module.
- Plan 52-02 hit the same baseline `npx tsc --noEmit` failures while targeted multi-source assembler tests passed. The errors remain outside `src/generation/multi-source-assembler.ts` and its test file, so repo-wide type debt was deferred again instead of expanded into unrelated cleanup.
