---
phase: 01-monorepo-foundation
plan: "01"
subsystem: infra
tags: [pnpm, turborepo, nextjs, mastra, prisma, tailwind, t3-env, typescript, eslint, zod]

# Dependency graph
requires: []
provides:
  - pnpm workspace with apps/* and packages/* declarations
  - Turborepo task orchestration with persistent dev servers and db:generate dependency
  - packages/tsconfig with base, nextjs, and node (ES2022/bundler) configs
  - packages/eslint-config with @typescript-eslint v8 rules
  - packages/schemas placeholder (Phase 3 populates)
  - apps/web: Next.js 15 App Router with Tailwind v3.4 and T3 Env startup validation
  - apps/agent: Mastra skeleton with Prisma, Google API, and workspace deps
affects: [02-atlusai-ingestion, 03-zod-schemas, 04-forms, 05-hitl, 06-agent, 07-slides, 08-ui, 09-pre-call, 10-polish]

# Tech tracking
tech-stack:
  added:
    - pnpm 9.12.0 (workspace package manager)
    - turbo 2.8.12 (monorepo task orchestration)
    - next 15.5.12 (App Router web framework)
    - react 19 (UI runtime)
    - tailwindcss 3.4.17 (CSS utility framework)
    - @t3-oss/env-nextjs 0.13.10 (startup env validation)
    - @mastra/core 1.8.0 (agent orchestration framework)
    - @mastra/libsql 1.6.2 (LibSQL storage adapter for Mastra)
    - mastra 1.3.5 (Mastra CLI)
    - prisma 6.3.1 + @prisma/client (ORM for SQLite)
    - googleapis 144 + google-auth-library 9 (Google Slides/Drive API)
    - zod 4.3.6 (schema validation, shared across all packages)
    - @typescript-eslint 8.56.1 (TypeScript linting, eslint 9 compatible)
    - typescript 5.7.3 (type checker)
  patterns:
    - Shared tsconfig extends pattern (base.json → nextjs.json/node.json)
    - T3 Env validation pattern: createEnv throws on missing required vars at startup
    - turbo.json "tasks" key (not deprecated "pipeline") with persistent: true for dev
    - Workspace protocol for internal package linking (workspace:*)
    - Per-app .env files gitignored; .env.example documents required vars

key-files:
  created:
    - package.json (root workspace, turbo run scripts)
    - pnpm-workspace.yaml (apps/* and packages/* workspace declaration)
    - turbo.json (task orchestration, persistent dev, db:generate dependency)
    - .npmrc (shamefully-hoist=false, strict-peer-dependencies=false)
    - packages/tsconfig/base.json (strict, skipLibCheck, esModuleInterop)
    - packages/tsconfig/nextjs.json (ES2017, esnext module, bundler resolution, jsx preserve)
    - packages/tsconfig/node.json (ES2022, ES2022 module, bundler resolution — Mastra compatible)
    - packages/eslint-config/index.js (@typescript-eslint rules)
    - packages/schemas/index.ts (placeholder, Phase 3 populates)
    - apps/web/src/env.ts (T3 Env createEnv with AGENT_SERVICE_URL validation)
    - apps/web/tailwind.config.ts (Tailwind v3.4, content: src/**/*.{ts,tsx})
    - apps/web/postcss.config.mjs (tailwindcss + autoprefixer plugins)
    - apps/web/next.config.ts (imports src/env.ts for build-time validation)
    - apps/web/src/app/layout.tsx (root layout, globals.css, metadata)
    - apps/web/src/app/page.tsx (placeholder page)
    - apps/web/.env.example (AGENT_SERVICE_URL, NODE_ENV)
    - apps/agent/package.json (mastra dev/build, prisma db scripts)
    - apps/agent/tsconfig.json (extends @lumenalta/tsconfig/node.json)
    - apps/agent/.env.example (DATABASE_URL, GOOGLE_* vars)
    - pnpm-lock.yaml (lockfile from install)
  modified:
    - .gitignore (added apps/web/.env, apps/agent/.env, prisma DB files, service-account-key.json)

key-decisions:
  - "Used zod 4.x across all packages (mastra/core accepts ^3.25.0 || ^4.0.0, matching plan intent)"
  - "Updated @mastra/libsql to 1.6.2 from 0.2.0 specified in plan (0.2.0 never existed, latest stable)"
  - "Updated @typescript-eslint to 8.x for eslint 9 compatibility (plan referenced 7.x which is eslint 8 only)"
  - "Updated @t3-oss/env-nextjs to 0.13.10 from 0.11.1 specified in plan (current stable)"
  - "Next.js pinned to 15.x range (plan specified 15 App Router; Next 16 is available but out of spec)"

patterns-established:
  - "Turbo task pattern: dev task uses persistent: true to prevent server kill, cache: false for live reload"
  - "Env validation pattern: apps/web/src/env.ts imported by next.config.ts for build-time and startup validation"
  - "tsconfig extends chain: apps inherit from packages/tsconfig for consistent compiler settings"
  - "Workspace linking: internal packages use workspace:* protocol in package.json dependencies"

requirements-completed: []

# Metrics
duration: 6min
completed: 2026-03-03
---

# Phase 1 Plan 01: Monorepo Foundation Summary

**pnpm + Turborepo monorepo with Next.js 15 App Router, Mastra agent skeleton, Tailwind v3.4, and T3 Env startup validation for AGENT_SERVICE_URL**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-03T17:47:03Z
- **Completed:** 2026-03-03T17:52:53Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments

- Full pnpm workspace declared with `apps/*` and `packages/*` packages
- Turborepo task graph configured with `persistent: true` on dev task and `db:generate` dependency chain
- Shared TypeScript configs (base, nextjs, node) with ES2022/bundler for Mastra compatibility
- apps/web bootstrapped with Next.js 15 App Router, Tailwind v3.4, and T3 Env validating AGENT_SERVICE_URL
- apps/agent skeleton with Mastra, Prisma, and Google API dependencies linked
- pnpm install completed with all 6 workspace packages linked

## Task Commits

Each task was committed atomically:

1. **Task 1: Root monorepo scaffold** - `2f683b0` (chore)
2. **Task 2: Bootstrap apps/web and apps/agent** - `0408ade` (feat)

## Files Created/Modified

- `package.json` - Root workspace with turbo run dev/build/lint scripts
- `pnpm-workspace.yaml` - Workspace package declarations (apps/*, packages/*)
- `turbo.json` - Task orchestration with persistent dev and db:generate dependsOn
- `.npmrc` - shamefully-hoist=false, strict-peer-dependencies=false
- `.gitignore` - Added env files, prisma DBs, service-account-key.json
- `packages/tsconfig/base.json` - Strict TypeScript base with declaration: true
- `packages/tsconfig/nextjs.json` - Next.js config (ES2017, bundler, jsx preserve, noEmit)
- `packages/tsconfig/node.json` - Mastra-compatible config (ES2022, bundler, noEmit false)
- `packages/eslint-config/index.js` - @typescript-eslint v8 rules
- `packages/schemas/index.ts` - Placeholder for Phase 3 Zod schemas
- `apps/web/src/env.ts` - T3 Env createEnv with AGENT_SERVICE_URL: z.string().url()
- `apps/web/next.config.ts` - Imports src/env.ts for build-time validation
- `apps/web/tailwind.config.ts` - Tailwind v3.4 with content: src/**/*.{ts,tsx}
- `apps/web/postcss.config.mjs` - tailwindcss + autoprefixer plugins
- `apps/web/src/app/layout.tsx` - Root App Router layout with globals.css and metadata
- `apps/web/src/app/page.tsx` - Placeholder page
- `apps/agent/package.json` - Mastra + Prisma + Google API deps with db:* scripts
- `apps/agent/tsconfig.json` - Extends @lumenalta/tsconfig/node.json
- `pnpm-lock.yaml` - Generated lockfile

## Decisions Made

- **zod 4.x used across all packages**: Plan specified `zod 4.x`; @mastra/core 1.8.0 peer dep is `^3.25.0 || ^4.0.0` so zod 4 is valid. `@ai-sdk/ui-utils` (transitive dep of mastra) still expects 3.x but `strict-peer-dependencies=false` suppresses the error.
- **@mastra/libsql corrected to 1.6.2**: Plan specified `^0.2.0` but that version never existed on npm; latest stable is 1.6.2.
- **@typescript-eslint updated to 8.x**: Plan referenced 7.x but @typescript-eslint 7.x only supports eslint 8. Since npm installs eslint 9 by default, 8.x was required.
- **@t3-oss/env-nextjs updated to 0.13.10**: Plan listed 0.11.1 but 0.13.10 is current stable.
- **Next.js pinned to 15.x range**: Plan specified "Next.js 15 App Router"; Next 16 is now available but staying within the specified major.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed @mastra/libsql version**
- **Found during:** Task 2 (pnpm install)
- **Issue:** Plan specified `@mastra/libsql@^0.2.0` which never existed on npm; install failed immediately
- **Fix:** Updated to `^1.6.2` (latest stable, consistent with @mastra/core 1.8.0)
- **Files modified:** apps/agent/package.json
- **Verification:** pnpm install completed without errors

**2. [Rule 3 - Blocking] Fixed @typescript-eslint version for eslint 9 compatibility**
- **Found during:** Task 2 (pnpm install peer dep warnings)
- **Issue:** Plan's `@typescript-eslint@^7.x` only supports eslint `^8.56.0`, but eslint 9 is installed
- **Fix:** Updated to `@typescript-eslint@^8.56.1` which supports eslint `^8.0.0 || ^9.0.0`
- **Files modified:** packages/eslint-config/package.json
- **Verification:** pnpm install shows no eslint-config peer dep warnings

**3. [Rule 3 - Blocking] Updated @t3-oss/env-nextjs to 0.13.10**
- **Found during:** Task 2 (version research before install)
- **Issue:** Plan specified 0.11.1 but current stable is 0.13.10; older version may have zod 4 incompatibilities
- **Fix:** Updated to ^0.13.10 (peer dep: `zod: "^3.24.0 || ^4.0.0"`)
- **Files modified:** apps/web/package.json

---

**Total deviations:** 3 auto-fixed (all Rule 3 - blocking version mismatches)
**Impact on plan:** All auto-fixes needed for install to succeed; no scope creep. Version differences are in the range expected for a plan written months before execution.

## Issues Encountered

- `@ai-sdk/ui-utils` (transitive dep of @mastra/core) has an unmet peer dep warning for `zod@^3.23.8` since we install zod 4. This is a warning only (not an error) due to `strict-peer-dependencies=false`. The warning will not cause runtime failures because @mastra/core itself accepts zod 4.

## User Setup Required

None - no external service configuration required for this infrastructure plan. Credentials (Google service account, Drive folder ID) are required for Phase 1 plan 02 (Mastra setup) and will be documented there.

## Next Phase Readiness

- Monorepo infrastructure complete; all subsequent phases can build on this foundation
- `pnpm dev` from root will start both apps when env vars are configured
- apps/web will reject startup without AGENT_SERVICE_URL (T3 Env validation)
- apps/agent env.example documents all required Google/DB vars for Phase 1 plan 03 (credentials spike)
- packages/schemas is linked as workspace dep in both apps; ready for Phase 3 population

## Self-Check: PASSED

All 18 created/modified files found on disk. Both task commits (2f683b0, 0408ade) verified in git history.

---
*Phase: 01-monorepo-foundation*
*Completed: 2026-03-03*
