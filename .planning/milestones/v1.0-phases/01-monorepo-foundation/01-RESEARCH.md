# Phase 1: Monorepo Foundation - Research

**Researched:** 2026-03-03
**Domain:** Monorepo tooling (pnpm + Turborepo), Next.js App Router, Mastra agent service, Prisma + SQLite, Google Slides/Drive API, env var validation
**Confidence:** HIGH (all major areas verified via official docs or current sources)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Package manager:** pnpm workspaces — workspace-native, strict dependency isolation, fast installs; pnpm workspaces protocol for linking apps/packages within the monorepo
- **Monorepo tooling:** Turborepo for task orchestration — task graph caching, parallel execution; single `turbo dev` command from repo root starts both apps/web and apps/agent; turbo.json defines `dev`, `build`, `lint` pipelines with correct dependency ordering
- **App Router:** Next.js App Router (not Pages Router); all UI work in phases 4, 5, 8, 9, 10 uses Server Components, layouts, and App Router data patterns
- **Environment variables:** Per-app .env files (`apps/web/.env` and `apps/agent/.env`); both .env files listed in .gitignore; env var validation runs at startup and rejects with a clear error if any required variable is missing
- **Tailwind CSS:** Tailwind v3.4 (not v4) — stable, full shadcn/ui compatibility
- **Google Slides API spike:** Must copy a real Lumenalta branded template (not a throwaway file) and insert text using live placeholder IDs read from the API response — not hardcoded; spike success = placeholder IDs resolved dynamically + batchUpdate executes without error; **credential provisioning is a prerequisite** — neither service account credentials nor the Lumenalta template ID are available yet — Phase 1 plan must include credential setup as an explicit step before the spike can run; Drive folder targeting: spike writes to the designated shared Lumenalta Drive folder (to be configured once credentials are provisioned)

### Claude's Discretion
- TypeScript configuration: shared base tsconfig + per-app extends pattern
- ESLint config: shared config in packages/eslint-config or root .eslintrc
- Mastra agent service: startup port, dev server command, how apps/agent is invoked
- SQLite file location within apps/agent (e.g., apps/agent/prisma/dev.db)
- Prisma schema initial structure (minimal — just enough for workflow state)
- Specific Turborepo pipeline configuration details

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 1 establishes the complete monorepo infrastructure for a two-app system: a Next.js 15 web app (`apps/web`) and a Mastra AI agent service (`apps/agent`). The foundation uses pnpm workspaces for dependency management and Turborepo for task orchestration — these are the current standard for TypeScript monorepos in 2026 and have excellent official documentation and tooling support.

The most significant technical risk in this phase is the Google Slides API spike. Two patterns exist for inserting text: `replaceAllText` (find-and-replace across the whole presentation using `{{token}}` markers — simpler, recommended by Google) and `insertText` with specific `objectId` values (requires reading live placeholder IDs from `presentations.get` or `presentations.pages.get`). The CONTEXT.md requires reading live placeholder IDs, which means the spike must call `presentations.get`, extract `pageElements[].objectId` values, then use those in `insertText` batchUpdate requests. This is fully achievable but requires a working service account and a template presentation to test against.

The second architectural clarification: Mastra has its own built-in storage layer (`@mastra/libsql`) that handles workflow state, agent memory, and snapshots internally. Prisma + SQLite in `apps/agent` serves a different purpose: application-level persistence for durable job records (briefing requests, transcript processing jobs, approval states). Both databases can coexist in `apps/agent` without conflict.

**Primary recommendation:** Scaffold the full monorepo structure first, then tackle credential provisioning and the Slides API spike as a gated step — nothing else in the phase is blocked except the spike.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pnpm | 9.x | Package manager + workspace protocol | Fastest installs, strict isolation, native workspace support |
| turbo | latest (2.x) | Task orchestration, caching, parallel dev | Vercel-maintained, best-in-class for pnpm monorepos |
| next | 15.x | Web app framework | Current stable; App Router is mature |
| @mastra/core | latest (1.8+) | AI agent framework | The locked agent service choice |
| @mastra/libsql | latest | Mastra's internal storage (workflow state, memory) | Mastra's default storage primitive; LibSQL = SQLite-compatible |
| prisma | 5.x | App-level ORM (briefing/job records) | Standard TypeScript ORM; excellent SQLite support |
| @prisma/client | 5.x | Generated Prisma client | Auto-generated from schema |
| typescript | 5.x | Type safety | Lockstep with Next.js and Mastra requirements |
| zod | 4.x | Schema validation | Required by Mastra; also used for env validation |
| @t3-oss/env-nextjs | 0.13.x | Env var validation for web app | Standard T3 pattern; throws at startup on missing vars |
| tailwindcss | 3.4.x | CSS framework | Locked at v3.4 for shadcn/ui compat |
| googleapis | 144.x | Google Slides + Drive API client | Official Google Node.js client |
| google-auth-library | 9.x | Service account auth for Google APIs | Included in googleapis; supports keyFile and env var auth |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @t3-oss/env-core | 0.13.x | Env validation for non-Next.js apps (apps/agent) | Use for Mastra service env validation |
| postcss | latest | Tailwind CSS processing in Next.js | Required for Tailwind v3 in Next.js |
| @types/node | 20.x | Node.js type definitions | Required by Mastra tsconfig |
| eslint | 8.x | Linting | Standard; pin to v8 for widest plugin compat |
| @typescript-eslint/parser | 7.x | TypeScript linting | Pairs with eslint for TS projects |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @t3-oss/env-nextjs | Manual Zod validation at startup | T3 Env is more ergonomic, handles server/client split, throws clear errors |
| @mastra/libsql (default) | Custom Prisma workflow tables | Mastra's built-in storage is simpler; Prisma is still needed for app-level records |
| Tailwind v3.4 | Tailwind v4 | v4 API is breaking change; shadcn/ui requires v3.4; locked decision |

**Installation (root + workspace setup):**
```bash
# Root init
pnpm init
pnpm add -D turbo

# Create workspace apps
mkdir -p apps/web apps/agent packages/schemas packages/eslint-config packages/tsconfig

# apps/web
cd apps/web && pnpm create next-app@latest . --typescript --tailwind --eslint --app --use-pnpm

# apps/agent
cd apps/agent
pnpm add @mastra/core@latest @mastra/libsql@latest zod@^4
pnpm add -D typescript @types/node mastra@latest

# apps/agent prisma (app-level records)
pnpm add prisma @prisma/client
pnpm exec prisma init --datasource-provider sqlite

# env validation
cd apps/web && pnpm add @t3-oss/env-nextjs zod
cd apps/agent && pnpm add @t3-oss/env-core zod

# Google APIs
cd apps/agent && pnpm add googleapis google-auth-library
```

---

## Architecture Patterns

### Recommended Project Structure
```
lumenalta-hackathon/
├── apps/
│   ├── web/                    # Next.js 15 App Router
│   │   ├── src/app/            # App Router pages and layouts
│   │   ├── src/env.ts          # T3 Env validation (web)
│   │   ├── .env                # Web env vars (gitignored)
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts  # Tailwind v3.4
│   │   ├── postcss.config.mjs
│   │   └── package.json
│   └── agent/                  # Mastra agent service
│       ├── src/
│       │   ├── mastra/         # Mastra agents, workflows, tools
│       │   │   ├── index.ts    # Mastra instance with storage config
│       │   │   ├── agents/
│       │   │   └── tools/
│       │   └── env.ts          # T3 Env validation (agent)
│       ├── prisma/
│       │   ├── schema.prisma   # App-level models (jobs, briefings)
│       │   ├── migrations/
│       │   └── dev.db          # SQLite file (gitignored)
│       ├── .env                # Agent env vars (gitignored)
│       └── package.json
├── packages/
│   ├── schemas/                # Shared Zod schemas (Phase 3 populates)
│   ├── tsconfig/               # Shared base tsconfig
│   │   ├── base.json
│   │   ├── nextjs.json
│   │   └── node.json
│   └── eslint-config/          # Shared ESLint config
│       └── index.js
├── pnpm-workspace.yaml
├── turbo.json
├── package.json                # Root scripts: dev, build, lint
└── .gitignore
```

### Pattern 1: pnpm Workspace Configuration
**What:** Declares which directories are workspace packages
**When to use:** Always — root of every pnpm monorepo

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// Root package.json
{
  "name": "lumenalta-hackathon",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "db:generate": "turbo run db:generate",
    "db:migrate": "turbo run db:migrate"
  },
  "devDependencies": {
    "turbo": "latest"
  }
}
```

### Pattern 2: Turborepo Pipeline (turbo.json)
**What:** Defines task dependency graph and caching behavior
**When to use:** Controls execution order — `dev` must come after `db:generate`

```json
// turbo.json
{
  "$schema": "https://turborepo.dev/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build", "^db:generate"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "dependsOn": ["^db:generate"],
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    }
  }
}
```

**Key insight:** The `^` prefix in `dependsOn` means "run this task in upstream dependencies first." `"^db:generate"` ensures Prisma generates types before `dev` or `build` starts. `persistent: true` on `dev` keeps both servers running.

### Pattern 3: Mastra Service Setup
**What:** Mastra instance with LibSQL storage for workflow state and agent memory
**When to use:** The core of apps/agent — all agents and workflows attach to this instance

```typescript
// apps/agent/src/mastra/index.ts
// Source: https://mastra.ai/en/reference/storage/libsql
import { Mastra } from '@mastra/core'
import { LibSQLStore } from '@mastra/libsql'

export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: 'file:./prisma/mastra.db',  // Keep Mastra db alongside Prisma db
  }),
  server: {
    port: 4111,  // Default port — expose in .env for flexibility
  },
})
```

```json
// apps/agent/package.json scripts
{
  "scripts": {
    "dev": "mastra dev",
    "build": "mastra build",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev"
  }
}
```

### Pattern 4: Prisma Schema (App-Level Records)
**What:** Minimal schema for workflow job records — Mastra handles its own state separately
**When to use:** Track briefing requests, transcript jobs, approval states at the application layer

```prisma
// apps/agent/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// Minimal for Phase 1 — expanded in later phases
model WorkflowJob {
  id          String   @id @default(cuid())
  type        String   // "briefing" | "transcript" | "asset_gen"
  status      String   @default("pending")  // "pending" | "running" | "done" | "failed"
  payload     String   // JSON blob
  result      String?  // JSON blob
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

```
# apps/agent/.env
DATABASE_URL="file:./prisma/dev.db"
```

### Pattern 5: Env Var Validation
**What:** T3 Env validates all required variables at startup, throwing clear errors if any are missing
**When to use:** Both apps must validate before serving any requests

```typescript
// apps/web/src/env.ts
// Source: https://env.t3.gg/docs/nextjs
import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    AGENT_SERVICE_URL: z.string().url(),
    NODE_ENV: z.enum(['development', 'production', 'test']),
  },
  client: {
    // NEXT_PUBLIC_* vars go here
  },
  runtimeEnv: {
    AGENT_SERVICE_URL: process.env.AGENT_SERVICE_URL,
    NODE_ENV: process.env.NODE_ENV,
  },
})
```

```typescript
// apps/agent/src/env.ts
import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    GOOGLE_SERVICE_ACCOUNT_KEY: z.string().min(1),  // JSON string of credentials
    GOOGLE_DRIVE_FOLDER_ID: z.string().min(1),
    GOOGLE_TEMPLATE_PRESENTATION_ID: z.string().min(1),
    NODE_ENV: z.enum(['development', 'production', 'test']),
  },
  runtimeEnv: process.env,
})
```

```typescript
// apps/web/next.config.ts
// Import env here to trigger validation at build time
import './src/env'
import type { NextConfig } from 'next'

const config: NextConfig = {
  // ...
}
export default config
```

### Pattern 6: Shared TypeScript Configuration
**What:** Base tsconfig extended per app — avoids duplicating compiler options
**When to use:** Standard in any multi-app monorepo

```json
// packages/tsconfig/base.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true
  }
}
```

```json
// packages/tsconfig/node.json (for apps/agent)
{
  "extends": "./base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "noEmit": false,
    "outDir": "dist"
  }
}
```

**Critical:** Mastra requires `"module": "ES2022"` and `"moduleResolution": "bundler"`. Using `CommonJS` or `node` will cause resolution errors.

```json
// packages/tsconfig/nextjs.json (for apps/web)
{
  "extends": "./base.json",
  "compilerOptions": {
    "target": "ES2017",
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "noEmit": true,
    "incremental": true,
    "plugins": [{ "name": "next" }]
  }
}
```

### Pattern 7: Google Slides API Spike
**What:** De-risk the two-step pattern: Drive API copy + Slides API batchUpdate with live placeholder IDs
**When to use:** Spike script only — confirms the critical path before any production code is written

#### Step 1 — Authenticate with Service Account
```typescript
// apps/agent/src/spike/slides-spike.ts
// Source: Official googleapis library
import { google } from 'googleapis'
import { env } from '../env'

// Option A: Credentials from JSON file (local dev)
const auth = new google.auth.GoogleAuth({
  keyFile: './service-account-key.json',
  scopes: [
    'https://www.googleapis.com/auth/presentations',
    'https://www.googleapis.com/auth/drive',
  ],
})

// Option B: Credentials from env var (recommended — no file in repo)
const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY)
const authFromEnv = new google.auth.GoogleAuth({
  credentials,
  scopes: [
    'https://www.googleapis.com/auth/presentations',
    'https://www.googleapis.com/auth/drive',
  ],
})
```

#### Step 2 — Copy Template to Shared Drive Folder
```typescript
// Source: https://developers.google.com/workspace/slides/api/guides/presentations
const driveClient = google.drive({ version: 'v3', auth })

const copyResponse = await driveClient.files.copy({
  fileId: env.GOOGLE_TEMPLATE_PRESENTATION_ID,
  requestBody: {
    name: 'Spike Test Presentation',
    parents: [env.GOOGLE_DRIVE_FOLDER_ID],
  },
})
const newPresentationId = copyResponse.data.id
```

#### Step 3 — Read Live Placeholder IDs from API Response
```typescript
// Source: https://developers.google.com/workspace/slides/api/samples/reading
const slidesClient = google.slides({ version: 'v1', auth })

// Get the full presentation to read slide and element IDs
const presentation = await slidesClient.presentations.get({
  presentationId: newPresentationId,
})

// Read slide IDs and their page elements
for (const slide of presentation.data.slides ?? []) {
  console.log('Slide objectId:', slide.objectId)
  for (const element of slide.pageElements ?? []) {
    console.log('  Element objectId:', element.objectId)
    // Check if it's a shape with placeholder info
    if (element.shape?.placeholder) {
      console.log('  Placeholder type:', element.shape.placeholder.type)
      console.log('  Placeholder index:', element.shape.placeholder.idx)
    }
    // Read current text content
    if (element.shape?.text?.textElements) {
      const textContent = element.shape.text.textElements
        .map((te) => te.textRun?.content ?? '')
        .join('')
      console.log('  Current text:', textContent.trim())
    }
  }
}
```

#### Step 4 — Insert Text Using Live Object IDs
```typescript
// Source: https://developers.google.com/workspace/slides/api/guides/merge
// Strategy: Use replaceAllText for {{token}} style replacements (recommended by Google)
// OR use insertText with specific objectId for targeted placement

// Strategy A — replaceAllText (simpler, works across whole presentation)
const replaceRequests = [
  {
    replaceAllText: {
      containsText: { text: '{{company-name}}', matchCase: true },
      replaceText: 'Acme Corp',
    },
  },
]

// Strategy B — insertText with live objectId (required by spike spec)
// Assumes firstSlideElementId was read from presentations.get above
const insertRequests = [
  {
    insertText: {
      objectId: firstSlideElementId,  // Dynamic from API response, not hardcoded
      text: 'Inserted by spike',
      insertionIndex: 0,
    },
  },
]

await slidesClient.presentations.batchUpdate({
  presentationId: newPresentationId,
  requestBody: { requests: insertRequests },
})

console.log('Spike complete — batchUpdate executed without error')
console.log('View at: https://docs.google.com/presentation/d/' + newPresentationId)
```

### Anti-Patterns to Avoid
- **Hardcoding placeholder IDs in the spike:** The spike's entire purpose is proving they can be read dynamically. Hardcoding defeats the point.
- **Committing service account JSON to the repo:** Store as environment variable (JSON string) or use Google Cloud Secret Manager. Never check in credentials.
- **Using `"pipeline"` key in turbo.json:** Deprecated — current Turborepo uses `"tasks"`.
- **Omitting `"persistent": true` on dev tasks in turbo.json:** Without it, Turborepo will try to terminate `mastra dev` when it considers the task complete.
- **Running `prisma generate` without a turbo dependency:** New developers will hit type errors if `db:generate` doesn't run before `dev`. The `"dependsOn": ["^db:generate"]` in turbo.json prevents this.
- **Forgetting to share the Drive folder with the service account:** The service account's `client_email` must be added as an editor on the shared Drive folder. Files copied there will be invisible to users unless this step is done.
- **Using Drive API v2 `files.copy` vs v3:** The official merge guide uses Drive API v2; the Node.js googleapis client supports both. Use v3 for consistency.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Env var validation | Custom startup check function | `@t3-oss/env-nextjs` / `@t3-oss/env-core` | T3 Env handles server/client split, throws clear error messages, integrates with Next.js build |
| Task ordering in monorepo | Shell scripts with `&&` chains | Turborepo `dependsOn` | Turbo provides parallelism, caching, correct topological ordering |
| Workflow state persistence | Custom SQLite tables for Mastra state | `@mastra/libsql` + LibSQLStore | Mastra manages its own schema for workflow snapshots, message history, and traces |
| Workspace linking | Symlinks or `npm link` | pnpm workspace protocol (`workspace:*`) | pnpm resolves workspace packages natively without manual linking |
| TypeScript path aliases | Manual `tsconfig.paths` + webpack aliases | pnpm workspace imports + turbo | Native imports via `@repo/schemas` work out of the box |
| Google Drive copy | Custom file duplication logic | `driveClient.files.copy()` | Single API call; handles permissions, metadata, and parent folder correctly |

**Key insight:** The Google Slides ecosystem has two insertion strategies. `replaceAllText` is what Google recommends for template merging (simpler, more maintainable). Reading live `objectId` values and using `insertText` is more powerful but requires parsing the presentations.get response tree. The spike must demonstrate the latter to satisfy the success criterion.

---

## Common Pitfalls

### Pitfall 1: Service Account Cannot See the Drive Folder
**What goes wrong:** The spike authenticates successfully (200 from auth check) but `files.copy` fails with a 404 or the new file disappears after creation.
**Why it happens:** The service account is a separate Google identity. It can only access Drive files/folders explicitly shared with its `client_email`.
**How to avoid:** After creating/identifying the shared Lumenalta Drive folder, open sharing settings and add the service account's `client_email` as an Editor. Include this as an explicit step in the plan.
**Warning signs:** Copy succeeds but returns a presentation that doesn't appear in the team's Drive view.

### Pitfall 2: Prisma Generate Not Running Before Dev
**What goes wrong:** Developer clones repo, runs `pnpm dev`, and immediately hits TypeScript errors about missing Prisma types.
**Why it happens:** Prisma generates TypeScript types from the schema at build time. If generate hasn't run, `@prisma/client` has no types.
**How to avoid:** In turbo.json, `dev` task must `"dependsOn": ["^db:generate"]`. The `db:generate` task must be defined in `apps/agent/package.json` scripts. Turbo runs it automatically before starting dev servers.
**Warning signs:** `Cannot find module '@prisma/client'` or `Object literal may only specify known properties`.

### Pitfall 3: Mastra tsconfig Incompatibility
**What goes wrong:** `mastra dev` fails with module resolution errors or imports from `@mastra/core` don't resolve.
**Why it happens:** Mastra requires `"module": "ES2022"` and `"moduleResolution": "bundler"`. Using `"CommonJS"` or `"node16"` breaks Mastra's internal imports.
**How to avoid:** The `packages/tsconfig/node.json` extended by `apps/agent` must set these exactly. Do not inherit a CommonJS base config.
**Warning signs:** `SyntaxError: Cannot use import statement` or `ERR_REQUIRE_ESM` when running Mastra.

### Pitfall 4: Turborepo `persistent` Missing on Dev Tasks
**What goes wrong:** `turbo dev` starts both servers, then immediately kills them.
**Why it happens:** Turborepo expects tasks to complete; it kills long-running processes unless `"persistent": true` is set. Dev servers never exit, so Turbo treats them as hung.
**How to avoid:** The `dev` task in turbo.json must have `"persistent": true` and `"cache": false`.
**Warning signs:** Both servers start and immediately terminate with no error.

### Pitfall 5: replaceAllText vs. insertText Confusion in Spike
**What goes wrong:** Spike appears to work but inserts text without reading live objectIds — doesn't satisfy the success criterion.
**Why it happens:** `replaceAllText` is easier and finds tokens anywhere in the presentation without needing object IDs. The spike could pass superficially while failing the "live placeholder IDs" requirement.
**How to avoid:** The spike must explicitly call `presentations.get`, log the `objectId` values it finds, and use at least one of those live IDs in an `insertText` request.
**Warning signs:** Spike script doesn't call `presentations.get` at all.

### Pitfall 6: Google Drive API v2 vs v3 in googleapis
**What goes wrong:** Code follows Google's merge guide (which uses Drive API v2) but the googleapis client behaves differently.
**Why it happens:** The merge guide uses `driveService.files.copy({ fileId: ..., requestBody: ... })` with Drive v2. In Drive v3, the field is `body` not `requestBody` in older client versions, and the `parents` field handling differs.
**How to avoid:** Use `google.drive({ version: 'v3', auth })` consistently. With googleapis v3 Node.js client, `requestBody` is the correct field name for the copy metadata.
**Warning signs:** Copy succeeds but file ends up in service account's root Drive, not the shared folder.

### Pitfall 7: Env File Location in Monorepo
**What goes wrong:** Env vars are not picked up because they're in the wrong location.
**Why it happens:** Turborepo runs apps from their own directory. `apps/web/.env` is loaded by Next.js; `apps/agent/.env` is loaded by Mastra's dev server. A root `.env` is NOT automatically loaded into either app.
**How to avoid:** Create per-app `.env` files. Add both to `.gitignore`. Document the required variables clearly in `.env.example` files.
**Warning signs:** Process exits with "Missing required env var" even though the variable is in a root `.env`.

---

## Code Examples

### Complete Service Account Auth Pattern
```typescript
// apps/agent/src/lib/google-auth.ts
// Source: https://github.com/googleapis/google-api-nodejs-client
import { google } from 'googleapis'
import { env } from '../env'

function getGoogleAuth() {
  const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY)
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/presentations',
      'https://www.googleapis.com/auth/drive',
    ],
  })
}

export function getSlidesClient() {
  return google.slides({ version: 'v1', auth: getGoogleAuth() })
}

export function getDriveClient() {
  return google.drive({ version: 'v3', auth: getGoogleAuth() })
}
```

### pnpm Workspace Package Reference Pattern
```json
// apps/agent/package.json — referencing shared schemas
{
  "dependencies": {
    "@lumenalta/schemas": "workspace:*"
  }
}
```

### Minimal Prisma Migration Command
```bash
# Run from apps/agent directory (or via turbo filter)
pnpm exec prisma migrate dev --name init
pnpm exec prisma generate
```

### Turborepo Filter: Run Only One App
```bash
# Start only the agent service
turbo dev --filter=agent

# Start only the web app
turbo dev --filter=web
```

### Verify Google Auth Without Full Spike
```typescript
// Quick auth validation before running the full spike
const auth = getGoogleAuth()
const client = await auth.getClient()
const token = await client.getAccessToken()
console.log('Auth successful — token obtained:', !!token.token)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `"pipeline"` key in turbo.json | `"tasks"` key | Turborepo 2.0 (2024) | Old `pipeline` key causes deprecation warnings; use `tasks` |
| Tailwind v4 alpha | Tailwind v3.4 (locked) | v4 released 2025 but breaking | shadcn/ui requires v3.4; v4 has different config format |
| Manual env checking | `@t3-oss/env-nextjs` | 2023, stable 2024 | Standard in T3/Next.js ecosystem; clear error messages |
| Mastra custom storage | `@mastra/libsql` default | Feb 2025 | Mastra now ships with LibSQL as default; no custom storage setup needed |
| Drive API v2 examples | Drive API v3 | 2019, but examples still show v2 | Official examples still reference v2; use v3 in new code |
| Pages Router (Next.js) | App Router | Next.js 13+, stable v14+ | Pages Router maintained but App Router is the path forward |

**Deprecated/outdated:**
- Turborepo `"pipeline"` key: replaced by `"tasks"` — causes warning in turbo 2.x, will be removed
- Tailwind v4 for this project: explicitly locked to v3.4 — do not use

---

## Open Questions

1. **Credential provisioning timing**
   - What we know: Service account credentials and the Lumenalta template ID are not yet available (explicit prerequisite in CONTEXT.md)
   - What's unclear: When will the service account be created? What is the template presentation ID? What is the target Drive folder ID?
   - Recommendation: Plan must include a credential setup task as the gate before the Slides API spike. The spike cannot run without: (a) service-account-key.json or its JSON string in env, (b) the template presentation ID, (c) the Drive folder ID. These must be provided by a human before the spike task executes.

2. **Mastra vs. Prisma dual database in apps/agent**
   - What we know: Mastra uses `@mastra/libsql` for its own state (workflow snapshots, message history). Prisma uses a separate SQLite file for app-level records.
   - What's unclear: Whether the project ultimately needs Prisma at all in Phase 1, or if a simple JSON file or in-memory store suffices until Phase 4 when real jobs start flowing.
   - Recommendation: Include Prisma setup in Phase 1 as specified in CONTEXT.md, but keep the schema minimal (single `WorkflowJob` model or simpler). This de-risks the database setup before any phase depends on it.

3. **Mastra CLI version compatibility**
   - What we know: `@mastra/core` is at 1.8.0 (as of March 2026), but the framework is actively developed — changelogs show bi-weekly releases.
   - What's unclear: Whether `mastra dev` supports all turbo.json `persistent` semantics correctly, or requires any `--dir` flag in a monorepo.
   - Recommendation: When scaffolding apps/agent, test `mastra dev` in isolation first before wiring into Turborepo. If `mastra dev` requires a specific directory layout, use `"dev": "mastra dev --dir src/mastra"`.

---

## Validation Architecture

*Note: `workflow.nyquist_validation` is not set in `.planning/config.json` — this section is included as informational guidance for the planner.*

Phase 1 is an infrastructure phase with no automated test requirements. The success criteria are validated manually:

| Success Criterion | Validation Method |
|-------------------|-------------------|
| `turbo dev` starts both apps | Manual: observe both servers start in tui output |
| Google service account authenticates | Spike script logs token obtained successfully |
| Slides API spike duplicates template + inserts text | Spike script logs new presentation URL; verify manually in Drive |
| Prisma migrations run cleanly | `prisma migrate dev` exits 0; `prisma studio` shows schema |
| Env var validation rejects on missing var | Manually remove a var from `.env`, verify startup error message |

---

## Sources

### Primary (HIGH confidence)
- [Turborepo official docs — tasks and pipeline](https://turborepo.dev/docs/reference/configuration) — turbo.json schema, `tasks` key, `persistent`, `cache`, `dependsOn`
- [Prisma + Turborepo official guide](https://www.prisma.io/docs/guides/turborepo) — db:generate dependsOn pattern, turbo.json Prisma tasks
- [Prisma + pnpm workspaces official guide](https://www.prisma.io/docs/guides/use-prisma-in-pnpm-workspaces) — package structure, required scripts
- [Mastra libsql storage reference](https://mastra.ai/en/reference/storage/libsql) — LibSQLStore config, Mastra handles its own schema
- [Mastra manual install guide](https://mastra.ai/docs/getting-started/manual-install) — required packages, tsconfig settings, scripts
- [T3 Env Next.js docs](https://env.t3.gg/docs/nextjs) — createEnv, runtimeEnv, server/client split, build-time validation
- [Google Slides merge guide](https://developers.google.com/workspace/slides/api/guides/merge) — replaceAllText pattern, Node.js code example with Drive copy + batchUpdate
- [Google Slides reading guide](https://developers.google.com/workspace/slides/api/samples/reading) — presentations.get response structure, pageElements, objectId
- [Google Drive service account setup](https://developers.google.com/workspace/drive/api/quickstart/nodejs) — auth pattern, scopes, shared folder sharing

### Secondary (MEDIUM confidence)
- [Mastra deployment in monorepo](https://mastra.ai/docs/deployment/monorepo) — directory structure, env file location, turborepo filter usage
- [Mastra dev CLI reference](https://mastra.ai/docs/server-db/mastra-server) — default port 4111, swagger UI at /swagger-ui, `mastra dev` command
- [2025 Turborepo + pnpm + Next.js monorepo guide](https://medium.com/@TheblogStacker/2025-monorepo-that-actually-scales-turborepo-pnpm-for-next-js-ab4492fbde2a) — verified against official docs

### Tertiary (LOW confidence — verify before using)
- Mastra `--dir` flag behavior in monorepo — not confirmed from official docs; test empirically during Phase 1 execution
- Drive API v3 `requestBody` field name for `files.copy` — verified in principle; test with actual credentials

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all major libraries confirmed via official docs with current versions
- Architecture: HIGH — monorepo structure follows official Turborepo + Prisma guides precisely
- Google Slides spike pattern: HIGH — reading live objectIds confirmed via official reading guide; merge pattern confirmed via official merge guide
- Pitfalls: HIGH — Drive folder sharing, Prisma generate ordering, Mastra tsconfig all confirmed via official sources
- Mastra monorepo details: MEDIUM — deployment guide confirms the pattern but some CLI flags need empirical verification

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (Mastra releases frequently — recheck @mastra/core version before planning)
