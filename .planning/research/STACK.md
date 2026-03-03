# Stack Research

**Domain:** Agentic Sales Orchestration Platform
**Researched:** 2026-03-03
**Confidence:** MEDIUM (WebSearch/WebFetch unavailable; training data cutoff August 2025; specific versions flagged where uncertain)

---

## Research Note

External network tools (WebSearch, WebFetch, npm CLI) were unavailable during this research session. All findings are drawn from training data (cutoff August 2025). Versions marked `[VERIFY]` should be confirmed against npmjs.com or official docs before pinning in package.json. The core stack is pre-decided in PROJECT.md — this document focuses on filling out the complete dependency graph, supporting libraries, and integration patterns.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Mastra AI | `^0.10` [VERIFY] | Agent orchestration, workflow steps, tool calling, HITL checkpoints | Pre-decided. Native Zod v4 support for structured outputs; workflow-first design maps directly to the transcript→brief→deck pipeline; built on Node.js/TypeScript with first-class MCP tool integration | MEDIUM — verify current semver on npmjs.com |
| Google Gemini API | `gemini-2.0-flash` or `gemini-2.5-flash` [VERIFY model ID] | LLM inference for transcript extraction, brief generation, copy generation | Pre-decided. 1M+ token context window handles long noisy transcripts; Flash tier provides cost-efficient inference at hackathon scale; function calling + structured output mode pairs with Zod schemas | MEDIUM — model ID naming may have updated post-Aug 2025 |
| Zod | `^4.0` | Schema validation for all structured data: SalesBrief, SlideJSON, BriefingOutput | Pre-decided. v4 is a ground-up rewrite with ~2x smaller bundle, better error messages, native `z.output<>` inference; Mastra natively integrates Zod for agent input/output validation | MEDIUM — v4 released May 2025; verify latest patch |
| Next.js | `^15.0` | Web frontend: multi-step seller/SME UI, HITL approval screens, transcript paste, briefing display | App Router with React Server Components reduces boilerplate for data-heavy pages; API routes serve as BFF layer to Mastra backend; strong TypeScript support; no separate backend needed for UI state | HIGH — Next.js 15 stable as of Oct 2024, confirmed training data |
| Node.js | `^20.x` LTS | Runtime for Mastra AI backend | Mastra requires Node.js; v20 LTS is actively maintained through 2026; v22 is viable but v20 has wider CI/CD support | HIGH |
| TypeScript | `^5.5` | Type safety across full stack | Mastra, Zod v4, and Next.js all have first-class TypeScript support; shared types between frontend and backend eliminate runtime mismatches | HIGH |

### Google Workspace Integration

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| googleapis (Node.js client) | `^144` [VERIFY] | Google Slides API, Google Docs API, Google Drive API via service account | Official Google client library; handles OAuth2/service account auth, retry logic, and typed responses; covers all three needed APIs in one package | HIGH — googleapis npm package is the canonical approach |
| google-auth-library | `^9` | Service account authentication for googleapis | Companion to googleapis; handles JWT signing and token refresh for service accounts; required when not using Application Default Credentials | HIGH |

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `@google/generative-ai` | `^0.21` [VERIFY] | Direct Gemini API SDK | Use this OR `ai` SDK (Vercel) — not both. Use this package when calling Gemini directly from Mastra tools/agents outside of Next.js | MEDIUM |
| `ai` (Vercel AI SDK) | `^4.0` [VERIFY] | Streaming AI responses in Next.js frontend | Use for streaming chat-like responses and `useChat`/`useCompletion` hooks in the React UI. Integrates with Gemini via provider adapters | MEDIUM — v4 was released; verify current version |
| `@mastra/google` or `@mastra/google-ai` [VERIFY package name] | latest | Mastra provider adapter for Gemini | If Mastra ships an official Gemini provider, use it instead of raw `@google/generative-ai` to get structured output enforcement automatically | LOW — package naming uncertain; verify on npmjs.com |
| `zod-to-json-schema` | `^3.23` [VERIFY for Zod v4 compat] | Convert Zod v4 schemas to JSON Schema for Gemini function declarations | Gemini function calling requires JSON Schema; this bridges Zod definitions to that format. Note: Zod v4 may change the API — check compatibility | MEDIUM |
| `@t3-oss/env-nextjs` | `^0.11` [VERIFY] | Type-safe environment variable validation with Zod | Validates all env vars at startup using Zod schemas; prevents runtime failures from missing API keys or Drive credentials | HIGH — pattern is well-established |
| `prisma` | `^6` [VERIFY] | ORM for brief/workflow state storage in PostgreSQL or SQLite | For persisting SalesBrief records, HITL approval status, workflow run state, and feedback loop data between sessions | HIGH — Prisma 6 released late 2024 |
| SQLite (via `better-sqlite3`) | `^9` | Local state DB for hackathon | Single-file database; zero-infrastructure for a hackathon; Prisma can switch to Postgres for production with no code changes | HIGH |
| `react-hook-form` | `^7.54` [VERIFY] | Form management for multi-step transcript input and briefing forms | Zod v4 integration via `@hookform/resolvers`; handles complex multi-step forms without re-renders; essential for the industry/subsector selector (62 options) | HIGH |
| `@hookform/resolvers` | `^3.10` [VERIFY] | Connects Zod v4 schemas to react-hook-form validation | Provides `zodResolver(schema)` adapter; ensures form validation matches server-side schema exactly, eliminating double-maintenance | HIGH |
| `tailwindcss` | `^4.0` [VERIFY — v4 was in beta as of Aug 2025] | Utility CSS for the seller/SME UI | Used widely in Next.js projects; v4 rewrites config in CSS; if v4 is stable in March 2026, use it; otherwise use v3.4 | LOW — v4 release status uncertain; default to v3.4 if unsure |
| `shadcn/ui` | latest (CLI-installed) | Component library for approval UI, status badges, review panels | Built on Radix UI primitives + Tailwind; not a package dep, installed as source via CLI; saves significant UI time during hackathon | HIGH |
| `lucide-react` | `^0.475` [VERIFY] | Icons for UI | Ships with shadcn/ui; consistent icon set | HIGH |
| `date-fns` | `^4.1` [VERIFY] | Date formatting for created-at timestamps, approval windows | Small, tree-shakable, no moment.js bloat | HIGH |
| `clsx` + `tailwind-merge` | `^2.6` / `^2.6` [VERIFY] | Conditional className utilities | Required by shadcn/ui patterns; cn() utility | HIGH |

### Development Tools

| Tool | Purpose | Notes | Confidence |
|------|---------|-------|------------|
| `tsx` | Run TypeScript scripts directly (content loading scripts, Mastra agent testing) | Faster than ts-node for one-off scripts; use for AtlusAI content ingestion scripts | HIGH |
| `vitest` | Unit testing for Zod schemas, agent tool functions, slide assembly logic | Same config as Vite; fast, native ESM, TypeScript-first | HIGH |
| `eslint` + `@typescript-eslint` | Linting | Next.js 15 ships with eslint 9 flat config support | HIGH |
| `prettier` | Code formatting | Consistent output across the team | HIGH |
| `dotenv` | Load .env files for local development | Next.js loads .env automatically; use dotenv only for standalone Mastra scripts | HIGH |

---

## Installation

```bash
# Core framework and runtime
npm install mastra @mastra/core

# LLM provider
npm install @google/generative-ai

# Google Workspace APIs
npm install googleapis google-auth-library

# Schema validation
npm install zod

# Schema interop
npm install zod-to-json-schema

# Next.js frontend
npx create-next-app@latest --typescript --tailwind --app --src-dir

# UI components (after Next.js setup)
npx shadcn@latest init
npx shadcn@latest add button card badge textarea select tabs dialog

# Forms
npm install react-hook-form @hookform/resolvers

# State persistence
npm install prisma @prisma/client better-sqlite3
npx prisma init

# Env validation
npm install @t3-oss/env-nextjs

# Vercel AI SDK (for streaming in UI)
npm install ai

# Utilities
npm install clsx tailwind-merge date-fns lucide-react

# Dev dependencies
npm install -D tsx vitest @vitest/ui eslint prettier @typescript-eslint/eslint-plugin
```

---

## Architecture Split: Monorepo vs Separate Services

**Recommendation: Monorepo with two apps**

```
/apps
  /web          — Next.js frontend (seller/SME UI, API routes as BFF)
  /agent        — Mastra AI backend (workflow engine, agent definitions, tools)
/packages
  /schemas      — Shared Zod v4 schemas (SalesBrief, BriefingOutput, SlideJSON)
  /google-client — Typed wrapper around googleapis for Slides/Docs/Drive
```

**Why:** Shared Zod schemas between the Mastra agent and the Next.js API routes eliminate the primary source of runtime errors (type drift between frontend form submission and backend processing). The agent app runs as a standalone Node.js process invoked by the Next.js API routes.

**Tooling:** Use `npm workspaces` (not Turborepo for a hackathon — one less config surface).

---

## Alternatives Considered

| Recommended | Alternative | Why Not | When Alternative Makes Sense |
|-------------|-------------|---------|-------------------------------|
| Mastra AI | LangChain.js | LangChain JS is verbose and has inconsistent TypeScript types; Mastra is purpose-built for Node.js with Zod-native structured outputs | If team has deep LangChain Python experience and needs Python |
| Mastra AI | LlamaIndex.ts | LlamaIndex is RAG-first, not workflow-first; pipeline model doesn't fit HITL checkpoint requirements | When the primary need is document QA, not multi-step agentic workflows |
| Gemini Flash | GPT-4o | OpenAI not in the project spec; GPT-4o context window (128K) is smaller than Gemini's 1M; cost is higher | If Gemini structured output quality proves insufficient for brief extraction |
| Gemini Flash | Claude 3.5 Sonnet | Not in project spec; Anthropic API adds another vendor dependency | If Gemini hallucination rate on brief extraction is unacceptable in testing |
| Next.js (App Router) | Remix | Remix has better form handling but smaller ecosystem; Next.js App Router is the standard for Vercel-deployed TypeScript apps in 2026 | If the team is Remix-native and server-side form mutations are a primary concern |
| Next.js (App Router) | SvelteKit | Better performance but different language; TypeScript support is good but ecosystem is smaller | Greenfield personal projects, not team hackathons |
| Prisma + SQLite | Supabase | Supabase requires a running Postgres instance; adds infrastructure complexity during a hackathon | When the project moves to production and multi-user concurrent access is needed |
| Prisma + SQLite | Drizzle ORM | Drizzle is lighter but less mature tooling; Prisma's migration workflow is safer for a tight timeline | Greenfield apps with a team already familiar with Drizzle |
| shadcn/ui | Chakra UI / MUI | shadcn/ui installs as source (no version lock-in), works best with Tailwind, and is the standard for new TypeScript React projects in 2025-2026 | When an existing component library is already in place |
| tailwindcss v3.4 (safe default) | tailwindcss v4 | v4 was in beta as of Aug 2025; may be stable by March 2026 but introduces a CSS-first config model that requires migration work | After confirming v4 is stable and the team is comfortable with the new config |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `langchain` (npm) | Unstable TypeScript types, heavy abstractions that fight Zod v4 integration, poor structured output enforcement compared to Mastra | Mastra AI |
| `openai` SDK for Gemini calls | OpenAI-compatible endpoint exists for Gemini but types won't match; structured output behavior differs subtly | `@google/generative-ai` official SDK |
| `moment.js` | 300KB+ bundle, deprecated in favor of modern alternatives | `date-fns` |
| `axios` | Adds bundle weight; Node.js 18+ has native `fetch`; googleapis uses it internally but app code should not add it | Native `fetch` or `undici` for non-googleapis HTTP |
| Zod v3 | Pre-decided as Zod v4; v3 and v4 have incompatible internals; mixing them via `zod-to-json-schema` or resolver libs will cause silent type errors | Zod v4 only; audit all dependencies that peer-depend on zod |
| `react-query` / TanStack Query | Unnecessary complexity for a hackathon UI that is primarily form-driven and step-sequential, not data-grid or cache-heavy | Next.js Server Actions + `useFormState` for mutations; SWR for simple polling |
| Class-based React components | Legacy pattern; no support for hooks; incompatible with React 19 concurrent features | Functional components with hooks |
| `pages/` router in Next.js | Legacy Next.js routing; App Router is the current standard and enables Server Components which are useful for the approval review pages | App Router (`app/` directory) |
| Google Apps Script | Not a Node.js integration; authentication is OAuth-only (no service account in Apps Script); cannot be called from a Mastra workflow | `googleapis` Node.js client with service account |
| Direct `fs` writes for Google output | Slides must live in shared Lumenalta Drive, not local files | Google Slides API via service account |

---

## Stack Patterns by Variant

**If running Mastra agent and Next.js in the same process (simpler hackathon setup):**
- Import Mastra workflow functions directly into Next.js API routes
- No separate port or network call needed
- Trade-off: Mastra's long-running workflows can block Next.js serverless function timeouts — use background job pattern with status polling instead

**If Mastra workflows need to be long-running (>30s for full deck generation):**
- Run Mastra agent as a separate Node.js process or use Mastra's built-in workflow execution engine with durable state
- Next.js API route kicks off the workflow and returns a `workflowRunId`
- Frontend polls `/api/workflow/[runId]/status` every 3 seconds
- Mastra workflow updates database state at each step; polling reads from DB

**If AtlusAI MCP tool requires specific Node.js MCP client:**
- Use `@modelcontextprotocol/sdk` Node.js client (official MCP SDK)
- Mastra has native MCP tool support — prefer Mastra's `MCPClient` abstraction over raw SDK if available

**If Zod v4 breaks a dependency that peer-depends on Zod v3:**
- Zod v4 ships a `zod/v3` compatibility shim that re-exports v3 API
- Import: `import { z } from "zod/v3"` in the affected dependency's peer resolution
- Do NOT downgrade your own schemas to Zod v3

---

## Version Compatibility

| Package | Compatible With | Notes | Confidence |
|---------|-----------------|-------|------------|
| Zod v4 (`zod@^4`) | `@hookform/resolvers@^3.9+` | Resolvers v3.9 added Zod v4 support; earlier versions will fail silently | MEDIUM |
| Zod v4 (`zod@^4`) | `zod-to-json-schema@^3.23+` | Earlier versions of zod-to-json-schema only support v3 schema; verify current compat | LOW — verify before pinning |
| Mastra | Node.js `^20` or `^22` | Mastra uses modern ESM; Node 18 may work but is approaching EOL | MEDIUM |
| Next.js 15 | React 19 | Next.js 15 ships with React 19 RC by default in new projects; RC is stable enough for a hackathon | HIGH |
| googleapis `^144` | google-auth-library `^9` | These are co-maintained by Google; major versions should be kept in sync as recommended in googleapis README | HIGH |
| tailwindcss v4 | shadcn/ui | shadcn/ui added Tailwind v4 support in early 2025; verify shadcn CLI installs v4-compatible config | LOW — verify if using tailwind v4 |

---

## Key Zod v4 Migration Notes

Zod v4 (released May 2025) is a ground-up rewrite. Key differences from v3 that affect this project:

1. **Import path unchanged:** `import { z } from "zod"` — no path change required
2. **`z.object` strict mode changed:** `z.object({}).strict()` now throws on unknown keys by default in some contexts — verify behavior for SalesBrief schema
3. **Error handling:** `z.ZodError` format changed; `error.issues` replaces `error.errors` in v4
4. **Metadata:** v4 adds `z.meta()` for attaching documentation to schemas — use this for all shared schemas to improve LLM prompt generation
5. **Performance:** v4 parses ~14x faster than v3 for complex schemas — beneficial for high-frequency transcript validation
6. **`zod-to-json-schema` compatibility:** Must use a v4-compatible release; check npm for `zod-to-json-schema@^3.23` or later

**Confidence:** MEDIUM — based on Zod v4 beta release notes from May 2025 training data; some API details may have shifted in the stable release.

---

## Environment Variables Required

```bash
# Gemini API
GEMINI_API_KEY=

# Google Service Account (JSON key — keep out of git)
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_DRIVE_FOLDER_ID=       # Shared Lumenalta Drive folder

# AtlusAI MCP connection
ATLUS_AI_MCP_URL=
ATLUS_AI_API_KEY=

# Database
DATABASE_URL=file:./dev.db    # SQLite for local; swap to postgres:// for prod

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

All of these should be validated at startup using `@t3-oss/env-nextjs` with Zod v4 schemas. Missing vars should throw at build time, not runtime.

---

## Sources

- PROJECT.md — pre-decided stack constraints (Mastra, Gemini, Zod v4, Google Workspace API, service account)
- Training data (cutoff August 2025) — Mastra AI architecture, Zod v4 release notes, Next.js 15 GA, googleapis patterns
- Training data — Gemini 2.0 Flash context window capabilities, structured output mode
- [UNVERIFIED] — Specific semver versions for mastra, @google/generative-ai, zod-to-json-schema require npmjs.com verification

**Items requiring external verification before project start:**
1. `mastra` / `@mastra/core` current semver — check npmjs.com
2. Official Mastra Gemini provider package name — check mastra.ai/docs or npm
3. `gemini-2.5-flash` model ID string — check Google AI Studio docs (may have new naming post-Aug 2025)
4. `zod-to-json-schema` compatibility with Zod v4 stable — check package readme
5. tailwindcss v4 stability — check tailwindcss.com/blog

---

*Stack research for: Lumenalta Agentic Sales Orchestration Platform*
*Researched: 2026-03-03*
