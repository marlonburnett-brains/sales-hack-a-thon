# Phase 62: Workspace & Mock Infrastructure - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Scaffold `apps/tutorials` workspace with mock agent server, page.route() helpers, auth bypass, fixture factories, and deterministic screenshot capture. Developer can run Playwright against the real Next.js app with fully mocked backend and capture deterministic screenshots. Pilot tutorial (Getting Started) validates the infrastructure end-to-end with AI-generated script and screenshots.

</domain>

<decisions>
## Implementation Decisions

### Tutorial Script Generation
- AI generates tutorial scripts — not human-authored. Claude analyzes the app's route structure, page components, and Server Actions to infer features and generate step-by-step tutorial scripts automatically
- Scripts stored as human-reviewable JSON files in the repo (not opaque/transient)
- Discovery method: Route crawl + component analysis — AI reads route structure, page components, and Server Actions to determine what tutorials to create
- Claude command supports both single tutorial (`/tutorials:generate getting-started`) and batch (`--all` flag) generation, plus a discovery mode for finding new tutorials needed
- Narration style: Conversational guide — friendly, approachable tone ("Now let's create a new deal. You'll want to enter the company name here.")
- Script format uses a hybrid approach: URL + optional action sequences for complex interactions (Claude's discretion on exact schema)

### Fixture Data Strategy
- AI generates all fixture data — not hand-crafted
- Production-realistic data quality — plausible company names, realistic deal amounts, content that looks like real product usage
- Single consistent fictional company across all tutorials — viewers follow one story arc (Claude picks the industry)
- Shared base fixtures (users, companies, deals) + per-tutorial overrides for specific data needs
- Fixtures validated against Zod schemas from `packages/schemas` at generation time — stale fixtures caught immediately
- Fixture location: `apps/tutorials/fixtures/` with `shared/` subdirectory for common data
- AI-generated slide mockup images for presentation thumbnails (not placeholders, not real Drive screenshots)
- HITL workflow fixtures contain realistic AI-like content (proposal text, talk track bullets, FAQ) — not lorem ipsum

### Capture Configuration
- Viewport: 1920x1080 at 2x device pixel ratio (3840x2160 actual pixel captures)
- Final video output: 1080p (1920x1080) — 4K captures downscaled for crisp text
- Screenshot format: PNG (lossless quality for text sharpness)
- Output directory: `apps/tutorials/output/` (gitignored, regenerated on demand)
- Naming convention: `tutorial-name/step-001.png` — subdirectories per tutorial, zero-padded step numbers
- Sidebar: Always expanded for navigation context
- Theme: App default (no special theme forcing)
- Determinism waits: Network idle + CSS animations disabled + `document.fonts.ready` + skeleton/spinner detection — maximum determinism

### Pilot Tutorial
- Pilot: Getting Started (TUT-01) — sign in, initial setup, navigating the UI
- Pilot scope: Screenshots only (TTS and Remotion are Phase 64-65)
- Pilot script: AI-generated from the start — no manual bootstrap

### Claude's Discretion
- Pipeline orchestration model (staged commands vs single command with flags) — local TTS dependency makes this nuanced
- Exact tutorial script JSON schema structure
- Fictional company industry selection
- Mock server implementation approach (Express standalone, MSW, or Next.js middleware interception)
- Auth bypass mechanism (cookie injection vs env var override)
- AI-generated slide mockup generation approach

</decisions>

<specifics>
## Specific Ideas

- "User won't script any tutorials, AI should do it" — the entire tutorial authoring pipeline is AI-driven
- Could create a Claude command and optionally a companion skill to regenerate all tutorials, one specific, or re-discover the entire app for capturing new features / new needed tutorials and/or updating all to latest UX/UI
- Note: REQUIREMENTS.md currently lists "AI-generated tutorial scripts" as out of scope — this decision overrides that for v1.9. The AI generates the scripts, fixtures, and narration text; humans review and can edit the JSON output

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@playwright/test` already installed at root — no new browser automation dependency needed
- `e2e-demo.ts` and `e2e-demo-healthcare.ts` show existing Playwright patterns (page navigation, text detection, element waiting)
- `apps/web/src/__test-utils__/` has Next.js mocking helpers (`next-mocks.ts`) — patterns may inform Server Action mocking
- `packages/schemas` contains Zod schemas for all API response shapes — fixture factories can import and validate against these

### Established Patterns
- Server Actions in `apps/web/src/lib/actions/` (13 files) — these use Next.js RPC, NOT fetch. Need mock server interception, not page.route()
- API routes in `apps/web/src/app/api/` (9 routes) — these ARE fetch-based, mockable via page.route()
- Auth: Supabase SSR with cookie-based sessions, middleware guards all routes except `/login` and `/auth/**`
- Monorepo: `pnpm-workspace.yaml` uses `apps/*` pattern — new `apps/tutorials` auto-discovered

### Integration Points
- Turborepo tasks in `turbo.json` — will need `capture`, `generate` tasks for tutorials workspace
- Agent routes registered in `apps/agent/src/mastra/index.ts` — mock server needs to replicate these endpoints
- Supabase Auth middleware in `apps/web/src/middleware.ts` — auth bypass needs to satisfy this middleware's session checks

</code_context>

<deferred>
## Deferred Ideas

- CI integration for tutorial staleness detection (AUTO-01 in v2 requirements)
- Multi-language narration (LOC-01 in v2 requirements)
- Interactive web-based walkthroughs reusing script definitions (INTER-01 in v2 requirements)

</deferred>

---

*Phase: 62-workspace-mock-infrastructure*
*Context gathered: 2026-03-18*
