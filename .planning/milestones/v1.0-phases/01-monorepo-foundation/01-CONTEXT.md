# Phase 1: Monorepo Foundation - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Scaffold the monorepo, configure Mastra + Prisma + SQLite, validate Google service account auth, and spike the Google Slides API to de-risk placeholder ID and batchUpdate ordering pitfalls before any production code depends on them.

Creating, provisioning, or populating any content (AtlusAI ingestion, Zod schemas, UI forms) is out of scope — this phase delivers working infrastructure only.

</domain>

<decisions>
## Implementation Decisions

### Package manager
- pnpm — workspace-native, strict dependency isolation, fast installs
- pnpm workspaces protocol for linking apps/packages within the monorepo

### Monorepo tooling
- Turborepo for task orchestration — task graph caching, parallel execution
- Single `turbo dev` command from repo root starts both apps/web and apps/agent
- turbo.json defines `dev`, `build`, `lint` pipelines with correct dependency ordering

### App Router
- Next.js App Router (not Pages Router)
- All UI work in phases 4, 5, 8, 9, 10 will use Server Components, layouts, and the App Router data patterns

### Environment variables
- Per-app .env files: `apps/web/.env` and `apps/agent/.env`
- Both .env files listed in .gitignore
- Env var validation runs at startup and rejects with a clear error if any required variable is missing

### Tailwind CSS
- Tailwind v3.4 (not v4) — stable, full shadcn/ui compatibility

### Google Slides API spike
- Spike must copy a real Lumenalta branded template (not a throwaway file) and insert text using live placeholder IDs read from the API response — not hardcoded
- Spike success = placeholder IDs resolved dynamically + batchUpdate executes without error
- **Credential provisioning is a prerequisite:** Neither service account credentials nor the Lumenalta template ID are available yet — Phase 1 plan must include credential setup as an explicit step before the spike can run
- Drive folder targeting: spike writes to the designated shared Lumenalta Drive folder (to be configured once credentials are provisioned)

### Claude's Discretion
- TypeScript configuration: shared base tsconfig + per-app extends pattern
- ESLint config: shared config in packages/eslint-config or root .eslintrc
- Mastra agent service: startup port, dev server command, how apps/agent is invoked
- SQLite file location within apps/agent (e.g., apps/agent/prisma/dev.db)
- Prisma schema initial structure (minimal — just enough for workflow state)
- Specific Turborepo pipeline configuration details

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — Phase 1 establishes the patterns all subsequent phases follow

### Integration Points
- apps/web (Next.js App Router) → apps/agent (Mastra service) via HTTP API
- apps/agent → Google Drive/Slides API via service account credentials
- apps/agent → Prisma/SQLite for durable workflow state
- packages/schemas → shared by both apps (Phase 3 populates this)

</code_context>

<specifics>
## Specific Ideas

- No specific UI or interaction references for this phase — it's infrastructure only
- The Slides API spike is the highest-risk item in Phase 1; placeholder ID resolution is the specific pitfall to validate

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-monorepo-foundation*
*Context gathered: 2026-03-03*
