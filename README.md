# AtlusDeck

AtlusDeck is Lumenalta's agentic sales orchestration workspace. It combines a Next.js seller UI, a Mastra-based workflow service, Prisma/Postgres persistence, Google Workspace generation, and AtlusAI-backed retrieval to help teams move from deal context to reviewable sales assets.

The product centers on five GTM workflows:

- `pre_call`: company research, value hypotheses, discovery questions, and a Google Doc briefing
- `touch_1`: first-contact one-pager generation with staged human review
- `touch_2`: intro deck generation for "Meet Lumenalta" conversations
- `touch_3`: capability-alignment deck generation
- `touch_4`: transcript-to-proposal generation, including a proposal deck, talk track, and buyer FAQ

## Documentation Map

- `README.md`: repo overview, setup, commands, and navigation
- `docs/architecture.md`: monorepo architecture, runtime boundaries, auth, integrations, and background jobs
- `docs/workflows.md`: detailed product workflows, HITL checkpoints, and seller-facing capabilities
- `docs/backend-api.md`: backend route families, workflow endpoints, and service behavior
- `docs/data-model.md`: Prisma schema and persistence model

## Monorepo Overview

This repo is a pnpm workspace managed by Turborepo.

```text
lumenalta-hackathon/
|- apps/
|  |- web/                     Next.js 15 seller workspace
|  \- agent/                  Mastra workflow and API service
|- packages/
|  |- schemas/                Shared Zod schemas, constants, agent catalog, generation types
|  |- eslint-config/          Shared lint config
|  \- tsconfig/               Shared TypeScript config
|- deploy/                    Agent container and compose setup
|- docs/                      Project documentation
|- Makefile                   Common local workflows
|- secrets.yml                Encrypted secret file manifest
|- turbo.json                 Turborepo task graph
\- pnpm-workspace.yaml        Workspace definition
```

## System Summary

- `apps/web` is the authenticated UI. It uses Supabase Auth, server actions, and typed wrappers in `apps/web/src/lib/api-client.ts` to talk to the agent service.
- `apps/agent` is the orchestration backend. It exposes REST routes from `apps/agent/src/mastra/index.ts` and registers Mastra workflows for pre-call and touch generation.
- `packages/schemas` is the contract layer shared by both apps: touch constants, subsectors, solution pillars, structured-output schemas, deal chat contracts, and agent metadata.
- PostgreSQL stores business data through Prisma, while Mastra uses its own Postgres-backed workflow state.
- Google Drive, Slides, and Docs handle generated assets and source presentations.
- AtlusAI is used for content discovery and retrieval, with MCP support and encrypted per-user token storage.

## Core Product Capabilities

- Deal workspace with companies, deals, owners, collaborators, statuses, and interaction history
- Persistent deal chat with contextual suggestions, transcript upload, note capture, and binding notes back to a deal or touch
- Template library for registering Google Slides sources, checking access, classifying them as templates or examples, and queuing ingestion
- Slide library with thumbnails, extracted slide elements, reviewable metadata, and similar-slide search through pgvector embeddings
- Deck intelligence that infers deck structures from examples, stores confidence scores, and supports refinement via chat
- Agent prompt management with a stable agent catalog, draft/publish/rollback flow, and a shared baseline prompt
- Action center for integration issues such as Google re-auth, sharing presentations with the service account, and AtlusAI setup gaps

For detailed workflow behavior, see `docs/workflows.md`.

## Architecture At A Glance

```text
Next.js web app
  -> Supabase session and Google OAuth token
  -> typed server-side API client
  -> Mastra agent service
      -> Prisma + Postgres
      -> Mastra workflow store (Postgres)
      -> Google Drive / Slides / Docs APIs
      -> AtlusAI search and MCP tools
      -> Gemini / Google GenAI model calls
```

More detail: `docs/architecture.md`

## Key Apps And Packages

### `apps/web`

Seller-facing UI built with Next.js App Router, React 19, Tailwind, and Radix UI.

Important route groups:

- `/login`: Google-only sign-in for `@lumenalta.com` accounts
- `/deals`: deal dashboard with grid/table views, status filters, and assignee filters
- `/deals/[dealId]`: deal workspace with overview, briefing, touch flows, reviews, and persistent chat
- `/templates`: template registry and ingestion operations
- `/slides`: cross-template slide library
- `/discovery`: AtlusAI browse/search and ingestion entrypoint
- `/actions`: required user or admin follow-ups
- `/settings/deck-structures`: deck intelligence review and refinement
- `/settings/agents`: agent prompt/version management
- `/settings/integrations`: external integration status
- `/settings/drive`: per-user Drive root folder override

### `apps/agent`

Mastra service responsible for workflows, REST endpoints, and integration orchestration.

Major areas:

- `src/mastra/workflows`: pre-call, touch 1-4, and structure-driven workflows
- `src/mastra/index.ts`: REST route registration, auth integration, startup hooks, timers, and workflow wiring
- `src/generation`: blueprint resolution, slide matching, multi-source assembly, modification planning, and execution
- `src/ingestion`: template ingestion, auto-classification, queueing, and backfill logic
- `src/deal-chat`: persistent chat orchestration and persistence
- `src/deck-intelligence`: structure inference, chat refinement, and inference cron
- `prisma/schema.prisma`: business data model

### `packages/schemas`

Shared package used by both apps.

Contains:

- GTM constants such as touch types, subsectors, personas, funnel stages, and solution pillars
- LLM structured-output schemas for research, pager content, transcript extraction, briefs, proposal copy, slide metadata, and more
- deal-chat request/response schemas
- agent catalog definitions and IDs
- generation pipeline types

## Auth And Access Model

- The web app uses Supabase Auth and middleware to protect all authenticated routes.
- Sign-in is Google OAuth only and is intended for `@lumenalta.com` users.
- The web app forwards the Supabase JWT to the agent service in the `Authorization` header.
- The agent verifies JWTs against Supabase JWKS in `apps/agent/src/lib/supabase-jwt-auth.ts`.
- Google API access can come from a live user access token, a stored refresh token resolved server-side, or the service account for operations that do not require user-delegated template access. Structure-driven deck generation requires a connected user Google token.
- AtlusAI access primarily uses encrypted per-user tokens in the database, with optional `ATLUS_API_TOKEN` env fallback for pooled/background use.

## Data Model Highlights

The Prisma schema tracks both workflow state and knowledge assets.

Primary models:

- `Company`, `Deal`, `InteractionRecord`
- `Transcript`, `Brief`, `FeedbackSignal`
- `DealChatThread`, `DealChatMessage`, `DealContextSource`
- `Template`, `SlideEmbedding`, `SlideElement`
- `DeckStructure`, `DeckChatMessage`
- `UserGoogleToken`, `UserAtlusToken`, `UserSetting`, `ActionRequired`
- `AgentConfig`, `AgentConfigVersion`

Full breakdown: `docs/data-model.md`

## Local Development

### Prerequisites

- Node.js 22 recommended
- `pnpm@9.12.0`
- PostgreSQL compatible with Prisma and pgvector
- Supabase project for auth and database access
- Google Cloud / Workspace credentials

### Install

```bash
pnpm install
```

### Secrets And Env Files

This repo uses encrypted environment files managed by `scripts/secrets.sh` and `secrets.yml`.

Managed secret files:

- `apps/agent/vertex-service-account.json`
- `apps/agent/.env.dev`
- `apps/agent/.env.prod`
- `apps/web/.env.dev`
- `apps/web/.env.prod`

To decrypt existing files locally:

```bash
printf 'SECRETS_KEY=your-key\n' > .env.local
make pull env
```

To create a new key and re-encrypt:

```bash
make set-new env
make push env
```

### Required Environment Variables

#### Agent service (`apps/agent/.env.*`)

Required in code:

- `DATABASE_URL`
- `DIRECT_URL`
- `GOOGLE_SERVICE_ACCOUNT_KEY`
- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_CLOUD_LOCATION`
- `VERTEX_SERVICE_ACCOUNT_KEY`
- `SUPABASE_URL`
- `WEB_APP_URL` (defaults to `http://localhost:3000` if omitted)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_AI_STUDIO_API_KEY`

Common optional or conditional values:

- `GOOGLE_DRIVE_FOLDER_ID`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`
- `GCS_THUMBNAIL_BUCKET`
- `TAVILY_API_KEY`
- `ATLUS_USE_MCP`
- `ATLUS_API_TOKEN`
- `ATLUS_PROJECT_ID`
- `ATLUS_MCP_MAX_LIFETIME_MS`
- legacy compatibility vars: `GOOGLE_TEMPLATE_PRESENTATION_ID`, `MEET_LUMENALTA_PRESENTATION_ID`, `CAPABILITY_DECK_PRESENTATION_ID`

#### Web app (`apps/web/.env.*`)

- `AGENT_SERVICE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional:

- `NEXT_PUBLIC_GOOGLE_API_KEY`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

## Running The Apps

Run both apps with the repo Makefile:

```bash
make run dev
```

This copies `apps/web/.env.dev` to `apps/web/.env.local`, copies `apps/agent/.env.dev` to `apps/agent/.env`, clears stale Mastra output, and starts the workspace dev processes.

Default local URLs:

- web: `http://localhost:3000`
- agent: `http://localhost:4111`

Run apps individually if needed:

```bash
pnpm --filter web dev
pnpm --filter agent dev
```

## Database Workflow

Use Prisma migrations only.

Generate client:

```bash
pnpm --filter agent db:generate
```

Create and apply a migration:

```bash
pnpm --filter agent db:migrate -- --name your_change_name
```

Seed data:

```bash
pnpm --filter agent seed
```

Do not use `prisma db push` for schema changes in this project. Repository rules require forward-only migrations.

## Commands

### Root

- `pnpm dev`: run workspace dev tasks through Turborepo
- `pnpm build`: build all apps/packages
- `pnpm lint`: lint all apps/packages

### Makefile helpers

- `make run dev`
- `make run prod`
- `make install`
- `make build`
- `make lint`
- `make db-generate`
- `make db-migrate`
- `make seed`
- `make set-new env`
- `make push env`
- `make pull env`

### Agent-specific

- `pnpm --filter agent build`
- `pnpm --filter agent validate-schemas`

## Background Jobs And Startup Behavior

The agent service starts several recurring or startup-time tasks:

- template staleness polling every 24 hours
- automatic ingest and auto-classification every 10 minutes
- deck structure inference cron every 24 hours
- stale-ingestion recovery on startup
- slide description and element backfill detection on startup
- MCP initialization on startup

These are documented in more detail in `docs/architecture.md` and `docs/backend-api.md`.

## Deployment

- `deploy/Dockerfile` builds a production image for the agent service only
- `deploy/docker-compose.yml` runs the agent with a `/health` check on port `4111`
- the repo does not include an equivalent web deployment manifest

## Testing

- `apps/agent` uses Vitest for route, workflow, auth, ingestion, deck-intelligence, and deal-chat tests
- `apps/web` uses Vitest plus Testing Library for component, route, and API-client tests
- there is no root `test` script today

## Notes And Caveats

- the current codebase contains a `db:push` script in `apps/agent/package.json`, but contributors should still use migrations only
- `/health` is intentionally public
- `/generation-logs/:dealId/:touchType` is currently unauthenticated
- some user-scoped agent routes rely on caller behavior and should be treated as internal-app APIs, not public APIs
- the repo currently has richer deployment artifacts for the agent service than for the web app

## Where To Read Next

1. Start with `docs/architecture.md` for the full system picture.
2. Read `docs/workflows.md` for seller flows and HITL checkpoints.
3. Read `docs/backend-api.md` for route coverage and service responsibilities.
4. Read `docs/data-model.md` for persistence details.
