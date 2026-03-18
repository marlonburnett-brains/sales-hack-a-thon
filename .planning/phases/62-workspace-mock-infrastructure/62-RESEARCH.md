# Phase 62: Workspace & Mock Infrastructure - Research

**Researched:** 2026-03-18
**Domain:** Turborepo workspace scaffolding, Playwright API mocking, Supabase auth bypass, fixture factories, deterministic screenshot capture
**Confidence:** HIGH

## Summary

Phase 62 scaffolds `apps/tutorials` as a new Turborepo workspace that enables deterministic screenshot capture of the existing Next.js 15 app (`apps/web`) with fully mocked backend data. The architecture requires a two-layer mocking strategy: (1) a standalone mock HTTP server replacing the agent service at `AGENT_SERVICE_URL`, and (2) Playwright `page.route()` helpers for any browser-initiated fetches to Next.js API routes.

The critical architectural insight is that Next.js Server Actions use an internal RPC protocol that **cannot be reliably intercepted** by Playwright's `page.route()`. However, Server Actions in this project call `api-client.ts` which uses standard `fetch()` to the agent service at `AGENT_SERVICE_URL`. By pointing `AGENT_SERVICE_URL` at a mock HTTP server during capture, all Server Action data flows are intercepted without touching the RPC layer. This is confirmed by code analysis: every data-fetching function in `api-client.ts` routes through `fetchAgent()` which fetches from `BASE_URL` (the env var).

Auth bypass requires crafting Supabase session cookies that satisfy the middleware's `supabase.auth.getSession()` / `supabase.auth.getUser()` checks. The simplest approach is to use a real Supabase project with a test user and programmatically sign in via the Supabase REST API, then persist the session state.

**Primary recommendation:** Use Express as a lightweight mock agent server (started before Playwright), Supabase REST API login for auth state, and Playwright's built-in `page.route()` for browser-side API mocking. No experimental Next.js features needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- AI generates tutorial scripts -- not human-authored. Claude analyzes the app's route structure, page components, and Server Actions to infer features and generate step-by-step tutorial scripts automatically
- Scripts stored as human-reviewable JSON files in the repo (not opaque/transient)
- Discovery method: Route crawl + component analysis
- Claude command supports both single tutorial and batch generation, plus discovery mode
- Narration style: Conversational guide
- Script format uses a hybrid approach: URL + optional action sequences for complex interactions
- AI generates all fixture data -- not hand-crafted
- Production-realistic data quality -- plausible company names, realistic deal amounts
- Single consistent fictional company across all tutorials
- Shared base fixtures + per-tutorial overrides
- Fixtures validated against Zod schemas from `packages/schemas` at generation time
- Fixture location: `apps/tutorials/fixtures/` with `shared/` subdirectory
- AI-generated slide mockup images for presentation thumbnails
- HITL workflow fixtures contain realistic AI-like content
- Viewport: 1920x1080 at 2x device pixel ratio (3840x2160 actual pixel captures)
- Final video output: 1080p -- 4K captures downscaled for crisp text
- Screenshot format: PNG
- Output directory: `apps/tutorials/output/` (gitignored)
- Naming convention: `tutorial-name/step-001.png`
- Sidebar: Always expanded
- Theme: App default
- Determinism waits: Network idle + CSS animations disabled + document.fonts.ready + skeleton/spinner detection
- Pilot: Getting Started (TUT-01) -- sign in, initial setup, navigating the UI
- Pilot scope: Screenshots only (TTS and Remotion are Phase 64-65)
- Pilot script: AI-generated from the start

### Claude's Discretion
- Pipeline orchestration model (staged commands vs single command with flags)
- Exact tutorial script JSON schema structure
- Fictional company industry selection
- Mock server implementation approach (Express standalone, MSW, or Next.js middleware interception)
- Auth bypass mechanism (cookie injection vs env var override)
- AI-generated slide mockup generation approach

### Deferred Ideas (OUT OF SCOPE)
- CI integration for tutorial staleness detection (AUTO-01 in v2 requirements)
- Multi-language narration (LOC-01 in v2 requirements)
- Interactive web-based walkthroughs reusing script definitions (INTER-01 in v2 requirements)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Scaffold `apps/tutorials` as Turborepo workspace with Playwright deps | Workspace setup pattern, turbo.json task config, package.json structure |
| INFRA-02 | Define tutorial scripts in structured JSON format | JSON schema design with URL + action sequences, Zod validation |
| INFRA-03 | Mock agent server intercepting all server-side API calls | Express mock server replacing `AGENT_SERVICE_URL`, route catalog from `api-client.ts` |
| INFRA-04 | Shared `page.route()` helpers for browser-side API mocking | Playwright route interception patterns for `/api/*` routes |
| INFRA-05 | Bypass Google OAuth/Supabase auth via mocked session cookies | Supabase REST API login + storageState persistence pattern |
| INFRA-06 | Fixture factory functions with Zod schema validation | Factory pattern importing `@lumenalta/schemas`, shared fixtures structure |
| INFRA-07 | Run `pnpm --filter tutorials capture <tutorial-name>` | Turbo task definition, Playwright CLI integration, capture orchestration script |
| CAPT-01 | Per-step screenshot at each workflow point | Playwright `page.screenshot()` with step-driven capture loop |
| CAPT-02 | Disable CSS animations + wait for network idle for deterministic output | CSS injection, `waitForLoadState('networkidle')`, font ready, skeleton detection |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @playwright/test | 1.58.2 | Browser automation & screenshot capture | Already installed at root, proven in e2e-demo scripts |
| express | 4.x | Mock agent HTTP server | Lightweight, zero-config, perfect for fixture-serving mock server |
| zod | (from packages/schemas) | Fixture validation | Already used project-wide, schemas exist in `@lumenalta/schemas` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | latest | TypeScript execution for scripts | Running capture orchestration and mock server in TS |
| @supabase/supabase-js | (from apps/web) | Auth session creation for test user | Programmatic login to get real session cookies |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Express mock server | MSW (Mock Service Worker) | MSW intercepts at the network layer in Node.js, good for unit tests but adds complexity for a standalone mock server. Express is simpler: just start it, point AGENT_SERVICE_URL at it. MSW's benefit (no real HTTP) is unnecessary here -- we want a real HTTP server. |
| Express mock server | Next.js middleware interception | Would require modifying `apps/web` source code for testing, violates isolation principle. Mock server is external and requires zero changes to web app. |
| Supabase REST login | Fake JWT cookie injection | Supabase middleware validates tokens against the Supabase server (`getUser()`). Fake JWTs would fail validation unless we also mock Supabase's API. Using a real test user with real tokens is simpler and more reliable. |

**Installation (apps/tutorials/package.json):**
```bash
pnpm add express tsx
pnpm add -D @types/express
```

Note: `@playwright/test` is already a root dependency. `@lumenalta/schemas` is a workspace dependency.

## Architecture Patterns

### Recommended Project Structure
```
apps/tutorials/
  package.json              # Workspace package
  tsconfig.json             # TypeScript config
  playwright.config.ts      # Playwright config for capture runs
  scripts/
    capture.ts              # Orchestration: load script -> start mock -> run Playwright
    mock-server.ts           # Express mock agent server
    generate-script.ts       # AI script generation entry point (Claude command)
    generate-fixtures.ts     # AI fixture generation entry point
  src/
    helpers/
      auth.ts               # Supabase login + storageState management
      route-mocks.ts         # page.route() helper factories
      determinism.ts         # CSS animation disable, wait helpers
      screenshot.ts          # Screenshot capture with naming conventions
    types/
      tutorial-script.ts     # Tutorial script JSON schema (Zod + TypeScript)
  fixtures/
    shared/
      users.json             # Shared user data
      companies.json         # Shared company data
      deals.json             # Shared deal data
    getting-started/
      overrides.json         # Tutorial-specific fixture overrides
  scripts.json               # Tutorial script definitions (generated by AI)
  output/                    # gitignored -- screenshot output
    getting-started/
      step-001.png
      step-002.png
```

### Pattern 1: Mock Agent Server (Express)
**What:** A standalone Express server that serves fixture JSON for every agent API endpoint the web app calls.
**When to use:** Always -- started before Playwright runs, shut down after.
**Example:**
```typescript
// scripts/mock-server.ts
import express from "express";
import { loadFixtures } from "../fixtures/loader";

export function createMockServer(tutorialName: string, port = 4111) {
  const app = express();
  const fixtures = loadFixtures(tutorialName);

  app.use(express.json());

  // Skip auth validation -- mock server trusts all requests
  app.get("/companies", (_req, res) => res.json(fixtures.companies));
  app.get("/deals", (_req, res) => res.json(fixtures.deals));
  app.get("/deals/:id", (req, res) => res.json(fixtures.deals.find(d => d.id === req.params.id)));
  app.post("/companies", (req, res) => res.json(fixtures.newCompany));
  // ... all routes from api-client.ts

  return app.listen(port);
}
```

### Pattern 2: Auth Bypass via Supabase REST Login
**What:** Programmatically sign in a test user via Supabase's `signInWithPassword()` and persist the session as Playwright `storageState`.
**When to use:** Before any capture run. Session cached to file and reused across steps.
**Example:**
```typescript
// src/helpers/auth.ts
import { createClient } from "@supabase/supabase-js";

const STORAGE_STATE_PATH = "apps/tutorials/.auth/state.json";

export async function ensureAuthState(page: Page) {
  // Create Supabase client pointing at real project
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email: process.env.TUTORIAL_USER_EMAIL!,
    password: process.env.TUTORIAL_USER_PASSWORD!,
  });

  if (error) throw new Error(`Auth failed: ${error.message}`);

  // Inject session into browser storage
  // Supabase stores session in localStorage with key: sb-{ref}-auth-token
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  const storageKey = `sb-${ref}-auth-token`;

  await page.addInitScript((args) => {
    localStorage.setItem(args.key, JSON.stringify(args.session));
  }, { key: storageKey, session: data.session });
}
```

### Pattern 3: Deterministic Screenshot Capture
**What:** Disable all non-deterministic rendering before each screenshot.
**When to use:** Every step capture.
**Example:**
```typescript
// src/helpers/determinism.ts
export async function prepareForScreenshot(page: Page) {
  // Disable CSS animations and transitions
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `
  });

  // Wait for network idle
  await page.waitForLoadState("networkidle");

  // Wait for fonts
  await page.evaluate(() => document.fonts.ready);

  // Wait for skeletons/spinners to disappear
  await page.waitForFunction(() => {
    const skeletons = document.querySelectorAll(
      '[class*="skeleton"], [class*="Skeleton"], [class*="spinner"], [class*="Spinner"], [class*="loading"], [role="progressbar"]'
    );
    return skeletons.length === 0;
  }, { timeout: 10000 }).catch(() => {/* timeout ok */});
}
```

### Pattern 4: page.route() Helpers for Browser-Side Mocks
**What:** Factory functions that set up Playwright route interception for browser-initiated API calls.
**When to use:** For any `/api/*` routes the browser calls directly (polling, streaming).
**Example:**
```typescript
// src/helpers/route-mocks.ts
export async function mockBrowserAPIs(page: Page, fixtures: FixtureSet) {
  // Mock workflow status polling (browser -> /api/workflows/status)
  await page.route("**/api/workflows/status*", async (route) => {
    const url = new URL(route.request().url());
    const runId = url.searchParams.get("runId");
    const response = fixtures.workflowStatuses?.[runId!] ?? { status: "completed" };
    await route.fulfill({ json: response });
  });

  // Mock generation logs
  await page.route("**/api/generation-logs*", async (route) => {
    await route.fulfill({ json: fixtures.generationLogs ?? [] });
  });

  // Mock presentation thumbnails
  await page.route("**/api/presentations/*/thumbnails", async (route) => {
    await route.fulfill({ json: fixtures.thumbnails ?? [] });
  });
}
```

### Pattern 5: Tutorial Script JSON Schema
**What:** Structured format for defining tutorial steps.
**When to use:** All tutorials -- AI generates these, capture engine consumes them.
**Example:**
```typescript
// src/types/tutorial-script.ts
import { z } from "zod";

const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("click"), selector: z.string() }),
  z.object({ type: z.literal("fill"), selector: z.string(), value: z.string() }),
  z.object({ type: z.literal("select"), selector: z.string(), value: z.string() }),
  z.object({ type: z.literal("wait"), selector: z.string() }),
  z.object({ type: z.literal("hover"), selector: z.string() }),
]);

const StepSchema = z.object({
  id: z.string(),                         // e.g., "step-001"
  url: z.string(),                         // e.g., "/deals"
  narration: z.string(),                   // Conversational narration text
  actions: z.array(ActionSchema).optional(), // Actions before screenshot
  waitFor: z.string().optional(),          // Selector to wait for before capture
  zoomTarget: z.object({                   // For future zoom/pan effects (Phase 66)
    selector: z.string(),
    scale: z.number().default(1.5),
  }).optional(),
  mockOverrides: z.record(z.string(), z.unknown()).optional(), // Step-specific fixture overrides
});

export const TutorialScriptSchema = z.object({
  id: z.string(),                          // e.g., "getting-started"
  title: z.string(),                       // e.g., "Getting Started with AtlusDeck"
  description: z.string(),
  steps: z.array(StepSchema).min(1),
  fixtures: z.string().optional(),         // Fixture set name if not default
});

export type TutorialScript = z.infer<typeof TutorialScriptSchema>;
export type TutorialStep = z.infer<typeof StepSchema>;
export type TutorialAction = z.infer<typeof ActionSchema>;
```

### Anti-Patterns to Avoid
- **Modifying `apps/web` for testing:** Never add test-only code to the production app. All mocking is external (mock server + Playwright route interception).
- **Using Next.js experimental testProxy:** The feature is unstable (GitHub issues report failures), adds MSW dependency, and requires modifying `next.config.ts`. The mock agent server approach is simpler and fully works.
- **Intercepting Server Actions via page.route():** Server Actions use Next.js internal RPC -- intercepting the POST request breaks the protocol and returns `undefined`. Instead, mock the upstream service the Server Actions call.
- **Using `prisma db push` or `prisma migrate reset`:** Project rules explicitly forbid this. Fixtures are JSON files, not database state.
- **Hard-coding fixture data:** All fixtures should be AI-generated and Zod-validated. Hand-crafted fixtures drift from real schemas.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP mock server | Custom Node.js http.createServer | Express with json middleware | Routing, body parsing, error handling -- all solved |
| Auth session tokens | Manual JWT construction | Supabase `signInWithPassword()` | Real tokens pass real middleware validation |
| CSS animation disabling | Per-element style overrides | Global `*` selector with `!important` | Catches all animations including pseudo-elements |
| Screenshot naming | Custom path construction | Template with `path.join()` + zero-padding | `step-001.png` format with `String.prototype.padStart()` |
| Zod schema validation | Manual type checking | Import schemas from `@lumenalta/schemas` | Single source of truth, catches drift |
| Tutorial script parsing | Manual JSON parsing | Zod schema with `safeParse()` | Type-safe, descriptive error messages on invalid scripts |

**Key insight:** The project already has `@lumenalta/schemas` with Zod schemas for all API response shapes. Fixture factories must import and validate against these schemas -- this is the primary defense against stale fixture data.

## Common Pitfalls

### Pitfall 1: Server Action Mocking Confusion
**What goes wrong:** Developers try to intercept Server Action POST requests with `page.route()` and get `undefined` responses or broken RPC connections.
**Why it happens:** Server Actions use Next.js internal RSC/RPC protocol, not standard HTTP request/response. The `next-action` header signals an RPC call.
**How to avoid:** Mock the agent service URL, not the Server Actions themselves. Server Actions call `api-client.ts` -> `fetchAgent()` -> `AGENT_SERVICE_URL`. Point that URL at the mock server.
**Warning signs:** Seeing `next-action` header in route interceptions, getting `undefined` from intercepted Server Actions.

### Pitfall 2: Supabase Middleware Auth Check Modes
**What goes wrong:** Auth bypass works on some pages but not others, or works on client-side navigation but not initial loads.
**Why it happens:** The middleware uses two different auth check paths: `getSession()` (fast, cookie-only, for RSC requests) and `getUser()` (full server validation, for page loads). A mock session must satisfy both.
**How to avoid:** Use a real Supabase test user with real credentials. The token is valid against the real Supabase server, satisfying both `getSession()` and `getUser()`.
**Warning signs:** Redirects to `/login` on page refresh but not on client navigation.

### Pitfall 3: Google Token Status Check in Middleware
**What goes wrong:** Middleware tries to call the agent service at `/tokens/check/:userId` to set `google-token-status` cookie. If mock server doesn't handle this, it causes 3-second timeouts on every page load.
**Why it happens:** Middleware lines 87-138 check Google token status for authenticated users on full page loads.
**How to avoid:** Mock server must handle `GET /tokens/check/:userId` and return `{ hasToken: true }`. This prevents timeout delays and avoids the "missing" token banner.
**Warning signs:** Slow page loads (3+ seconds), Google re-auth banners appearing in screenshots.

### Pitfall 4: Non-Deterministic Screenshots
**What goes wrong:** Screenshots differ between runs due to animations, loading states, or font rendering.
**Why it happens:** CSS transitions, skeleton screens, font loading races, and image lazy-loading all introduce visual non-determinism.
**How to avoid:** Apply CSS animation disable before navigation, wait for `networkidle` + `document.fonts.ready`, detect and wait for skeleton/spinner removal, and disable image lazy-loading.
**Warning signs:** Diff-ing consecutive captures shows pixel differences in text rendering or animation frames.

### Pitfall 5: Turborepo Task Dependencies
**What goes wrong:** `pnpm --filter tutorials capture` fails because the web app isn't running.
**Why it happens:** The capture task depends on `apps/web` dev server running, but Turborepo doesn't know this.
**How to avoid:** The capture script should start the web dev server itself (or verify it's running), not depend on Turborepo's task graph for this. Use `webServer` config in `playwright.config.ts` to auto-start the Next.js dev server.
**Warning signs:** Connection refused errors when Playwright tries to navigate.

### Pitfall 6: `AGENT_SERVICE_URL` Must Be Set Before Next.js Starts
**What goes wrong:** Next.js reads `AGENT_SERVICE_URL` at module load time via `env.ts` (t3-oss/env-nextjs). Setting it after the server starts has no effect.
**Why it happens:** The env validation runs at import time, and `BASE_URL` in `api-client.ts` is a module-level constant.
**How to avoid:** Set `AGENT_SERVICE_URL=http://localhost:MOCK_PORT` in the environment BEFORE starting the Next.js dev server. Use Playwright's `webServer` config with environment variables.
**Warning signs:** Requests still going to `localhost:4111` instead of mock server port.

## Code Examples

### Playwright Config for Tutorial Capture
```typescript
// apps/tutorials/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./capture",
  outputDir: "./output",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    screenshot: "off", // We take manual screenshots
    video: "off",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "capture",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm --filter web dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    env: {
      AGENT_SERVICE_URL: "http://localhost:4112", // Mock server port
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
  },
});
```

### Mock Agent Server Route Catalog
Based on analysis of `api-client.ts`, the mock server must handle these routes:

```typescript
// Core routes (from api-client.ts analysis)
// Companies
GET  /companies
POST /companies

// Deals
GET  /deals
GET  /deals?ownerId=...&status=...
GET  /deals/:id
POST /deals
PATCH /deals/:id/status
PATCH /deals/:id/assign

// Users
GET  /users

// Interactions
GET  /deals/:dealId/interactions

// Workflows
POST /workflows/touch-1/start
POST /workflows/touch-2/start
POST /workflows/touch-3/start
POST /workflows/touch-4/start
GET  /workflows/touch-1/:runId/status
GET  /workflows/touch-2/:runId/status
GET  /workflows/touch-3/:runId/status
GET  /workflows/touch-4/:runId/status

// Templates & Slides
GET  /templates
POST /templates/register
GET  /slides
GET  /slides/:id

// Settings
GET  /settings/drive
POST /settings/drive

// Agent prompts
GET  /agent-prompts
GET  /agent-prompts/:agentId
PUT  /agent-prompts/:agentId

// Token check (used by middleware!)
GET  /tokens/check/:userId

// Deck structures
GET  /deck-structures/:touchType

// Pre-call briefing
POST /pre-call-briefing
GET  /pre-call-briefing/:dealId

// Deal chat
POST /deals/:dealId/chat
GET  /deals/:dealId/chat/bindings
POST /deals/:dealId/chat/bindings

// Discovery (AtlusAI)
GET  /discovery/search
POST /discovery/ingest

// Generation logs
GET  /generation-logs
```

### Fixture Factory Pattern
```typescript
// apps/tutorials/fixtures/factories.ts
import { z } from "zod";
import type { Deal, Company } from "@lumenalta/schemas"; // or from api-client types

// Base factory with Zod validation
function createFactory<T>(schema: z.ZodType<T>) {
  return (overrides: Partial<T> = {}): T => {
    const data = { ...defaults, ...overrides };
    return schema.parse(data); // Throws if invalid
  };
}

// Shared fictional company
export const TUTORIAL_COMPANY = {
  id: "comp-tutorial-001",
  name: "Meridian Dynamics",
  industry: "Technology Consulting",
  logoUrl: null,
  createdAt: "2026-01-15T10:00:00Z",
  updatedAt: "2026-01-15T10:00:00Z",
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MSW for all mocking | page.route() (browser) + standalone mock server (server-side) | 2024-2025 | Simpler setup, no MSW dependency, works with all Next.js versions |
| Playwright storageState auth | Supabase REST login + localStorage injection | 2025 | Works with Supabase SSR cookie-based sessions |
| Next.js experimental testProxy | External mock server at AGENT_SERVICE_URL | 2025-2026 | Experimental feature has known issues (GitHub #77449), external mock is stable |
| Pixel-perfect screenshot comparison | Deterministic capture (disable animations, wait for idle) | Ongoing | Focus on consistent capture, not comparison |

**Deprecated/outdated:**
- Next.js `experimental.testProxy`: Still marked experimental, has breaking issues. Do not use.
- Playwright `page.route()` for Server Actions: Fundamentally incompatible with Next.js RPC protocol.

## Open Questions

1. **Test User Credentials**
   - What we know: Need a Supabase user with `signInWithPassword()` support (email+password auth)
   - What's unclear: Whether the project has password auth enabled (currently uses Google OAuth)
   - Recommendation: Create a test user in Supabase dashboard with password auth, or use Supabase Admin API to create one. Store credentials in `.env` (gitignored). Alternative: If password auth is not enabled, could use Supabase Admin API to generate a session directly.

2. **Mock Server Port Conflict**
   - What we know: Agent service runs on 4111, mock should use a different port
   - What's unclear: Whether dev workflow ever needs both real agent and mock server simultaneously
   - Recommendation: Use port 4112 for mock server. Playwright config sets `AGENT_SERVICE_URL=http://localhost:4112` for the Next.js dev server.

3. **Fixture Data Volume**
   - What we know: Need deals, companies, users, templates, slides, interactions, workflows -- substantial surface area
   - What's unclear: Exactly which endpoints the Getting Started tutorial touches
   - Recommendation: Start with minimal fixtures for pilot tutorial, expand as more tutorials are added. AI generates all fixture data.

## Sources

### Primary (HIGH confidence)
- `apps/web/src/lib/api-client.ts` - Full route catalog analysis, confirms all data flows through `fetchAgent()` to `AGENT_SERVICE_URL`
- `apps/web/src/middleware.ts` - Auth guard logic, Google token check, RSC vs full-load paths
- `apps/web/src/env.ts` - Environment variable requirements and validation
- `apps/web/src/lib/supabase/server.ts` - Supabase SSR session handling
- [Playwright Mock APIs docs](https://playwright.dev/docs/mock) - page.route() API reference
- [Playwright Authentication docs](https://playwright.dev/docs/auth) - storageState and session management

### Secondary (MEDIUM confidence)
- [Next.js Server Actions mocking discussion](https://github.com/vercel/next.js/discussions/67136) - Confirms Server Actions cannot be reliably intercepted via page.route()
- [Max Schmitt - Next.js SSR request mocking](https://maxschmitt.me/posts/nextjs-ssr-request-mocking-playwright) - playwright-ssr approach (not recommended but informs understanding)
- [Next.js experimental testProxy README](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/README.md) - Experimental feature documentation
- [Supabase Playwright login patterns](https://mokkapps.de/blog/login-at-supabase-via-rest-api-in-playwright-e2e-test) - REST API auth approach

### Tertiary (LOW confidence)
- [Next.js testProxy issues](https://github.com/vercel/next.js/issues/77449) - Bug reports suggesting instability

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Express, Playwright, Zod all verified against project dependencies and codebase analysis
- Architecture: HIGH - Two-layer mocking strategy derived from code analysis of api-client.ts and middleware.ts
- Pitfalls: HIGH - Server Action interception limitation confirmed by multiple sources and Next.js discussion
- Auth bypass: MEDIUM - Supabase REST login approach well-documented, but project may need password auth enabled
- Tutorial script schema: MEDIUM - Claude's discretion area, schema design is well-informed but final shape may evolve

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable domain, no fast-moving dependencies)
