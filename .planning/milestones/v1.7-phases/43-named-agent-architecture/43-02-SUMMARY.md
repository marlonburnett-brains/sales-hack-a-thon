---
phase: 43-named-agent-architecture
plan: "02"
subsystem: api
tags: [agent, mastra, prisma, prompt-versioning, cache]
requires:
  - phase: 43-named-agent-architecture
    provides: shared agent catalog defaults, AgentConfig models, and published seed data
provides:
  - Deterministic Prisma-backed prompt resolution for published and pinned named-agent versions
  - Published-version prompt cache helpers with explicit invalidation semantics
  - Registered Mastra named-agent roster plus a shared execution seam that returns prompt version metadata
affects: [43-03, 43-04, 43-05, agent, mastra, workflows]
tech-stack:
  added: []
  patterns:
    - Resolve runtime instructions from Prisma published versions, not inline prompt strings or editor storage
    - Cache compiled prompt instructions by immutable published version id instead of by agent id alone
    - Return prompt version metadata with named-agent execution so downstream workflows can pin versions
key-files:
  created:
    - apps/agent/src/lib/agent-prompt-cache.ts
    - apps/agent/src/lib/agent-config.ts
    - apps/agent/src/lib/agent-executor.ts
    - apps/agent/src/lib/__tests__/agent-config.test.ts
    - apps/agent/src/mastra/agents/build-agent.ts
    - apps/agent/src/mastra/agents/index.ts
    - apps/agent/src/mastra/__tests__/agent-registry.test.ts
    - .planning/phases/43-named-agent-architecture/43-02-SUMMARY.md
  modified:
    - apps/agent/src/mastra/index.ts
key-decisions:
  - "Kept Prisma published rows as the only runtime prompt source and had Mastra agents load compiled instructions asynchronously from that resolver."
  - "Used immutable version-id cache keys plus explicit invalidation helpers so future publishes cannot serve stale instructions."
patterns-established:
  - "Named-agent runtime helpers should expose both the generated output and the resolved prompt version metadata."
  - "Mastra agent registration should be derived directly from the shared catalog to avoid registry drift."
requirements-completed: [AGENT-02]
duration: 4 min
completed: 2026-03-08
---

# Phase 43 Plan 02: Prisma-backed prompt resolver, version-safe cache, and Mastra registry Summary

**Prisma-published named-agent prompts now resolve through a deterministic version-safe cache and power a registered Mastra roster with version-aware execution metadata.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-08T19:53:49Z
- **Completed:** 2026-03-08T19:57:38Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Added a shared prompt resolver that loads published or pinned agent prompt versions from Prisma and compiles baseline plus role instructions consistently.
- Added a published-version cache layer with explicit invalidation helpers so future prompt publishes can refresh safely without stale agent text reuse.
- Registered the full named Mastra roster from the shared catalog and added a reusable execution seam that returns prompt version metadata for downstream workflow pinning.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement the prompt resolver and published-version cache** - `6008cb6` (feat)
2. **Task 2: Register the named Mastra roster and expose a shared execution seam** - `b5051ef` (feat)

**Plan metadata:** pending final `docs(43-02)` metadata commit at summary creation time.

## Files Created/Modified
- `apps/agent/src/lib/agent-prompt-cache.ts` - caches compiled prompt instructions by immutable agent/version identity and exposes invalidation helpers
- `apps/agent/src/lib/agent-config.ts` - resolves published or pinned prompt configs from Prisma into compiled runtime instruction payloads
- `apps/agent/src/lib/agent-executor.ts` - exposes the shared named-agent execution seam and returns prompt version metadata with model output
- `apps/agent/src/lib/__tests__/agent-config.test.ts` - proves published lookup, version-safe cache behavior, and pinned version resolution
- `apps/agent/src/mastra/agents/build-agent.ts` - builds Mastra agents whose instructions load asynchronously from the Prisma-backed resolver
- `apps/agent/src/mastra/agents/index.ts` - derives the registered Mastra roster directly from the shared agent catalog
- `apps/agent/src/mastra/index.ts` - wires the named roster into the existing Mastra instance without changing workflows or storage setup
- `apps/agent/src/mastra/__tests__/agent-registry.test.ts` - verifies roster completeness, async prompt loading, and version-aware execution metadata

## Decisions Made
- Kept Prisma `AgentConfig` and `AgentConfigVersion` rows as the only runtime prompt source of truth, with Mastra acting as the execution wrapper.
- Used published version ids in cache keys so prompt publishes invalidate precisely by immutable version identity instead of by agent id.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `.claude/get-shit-done` state automation could not advance the current plan because this repository's `STATE.md` uses `Phase: X of Y` / `Plan: X of Y` lines instead of the `Current Plan` / `Total Plans in Phase` fields expected by the helper. STATE was updated manually after the attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ready for `43-03-PLAN.md`, which can migrate callsites onto the shared resolver and execution seam while pinning prompt versions in workflow state.
- The Mastra runtime now has a single named-agent registry entrypoint, so downstream migrations can reuse one canonical lookup path instead of adding new wrappers.

## Self-Check: PASSED
- Verified `.planning/phases/43-named-agent-architecture/43-02-SUMMARY.md` exists.
- Verified commits `6008cb6` and `b5051ef` exist in git history.

---
*Phase: 43-named-agent-architecture*
*Completed: 2026-03-08*
