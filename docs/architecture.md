# Architecture

## Overview

AtlusDeck is a pnpm/Turborepo monorepo with two application runtimes:

- `apps/web`: the seller-facing Next.js application
- `apps/agent`: the Mastra-based orchestration and API service

Both apps share contracts from `packages/schemas`.

## Runtime Boundaries

### Web app

The web app is responsible for:

- session handling through Supabase SSR/auth
- rendering authenticated seller workflows
- making server-side calls to the agent service through `apps/web/src/lib/api-client.ts`
- proxying a small set of streaming routes through Next.js route handlers

Important layout structure:

- `apps/web/src/app/(authenticated)/layout.tsx`: authenticated app shell
- `apps/web/src/app/(authenticated)/deals/[dealId]/layout.tsx`: deal workspace shell plus persistent chat
- `apps/web/src/app/(authenticated)/settings/layout.tsx`: settings navigation for deck structures, integrations, Drive, and agents

### Agent service

The agent service is responsible for:

- workflow orchestration through Mastra
- REST API registration in `apps/agent/src/mastra/index.ts`
- data persistence through Prisma
- Google Drive, Slides, and Docs integrations
- AtlusAI integration and MCP lifecycle management
- deck generation, ingestion, deck-intelligence inference, and deal chat logic

Mastra workflows registered in code:

- `pre-call-workflow`
- `touch-1-workflow`
- `touch-2-workflow`
- `touch-3-workflow`
- `touch-4-workflow`
- `structure-driven-workflow`

## Monorepo Structure

### Applications

- `apps/web`: Next.js 15 App Router app
- `apps/agent`: Mastra server and Prisma project

### Shared packages

- `packages/schemas`: shared constants, Zod schemas, agent catalog, and generation types
- `packages/tsconfig`: shared TypeScript settings
- `packages/eslint-config`: shared lint rules

### Operational files

- `turbo.json`: task graph for `build`, `dev`, `lint`, `db:generate`, `db:migrate`
- `Makefile`: local workflows and env file switching
- `deploy/Dockerfile`: production image for the agent service
- `deploy/docker-compose.yml`: compose setup for the agent service

## Request Flow

### Standard application flow

1. A user authenticates in the web app through Supabase Google OAuth.
2. The web app obtains a Supabase session and, when needed, a Google access token.
3. `apps/web/src/lib/api-client.ts` sends requests to the agent service.
4. The agent validates the `Authorization` bearer token against Supabase JWKS.
5. The agent uses Prisma, Mastra workflow state, Google APIs, AtlusAI, and model calls to fulfill the request.
6. The web app renders persisted state, workflow status, or streaming responses.

### Google access strategy

The agent resolves Google auth in this order:

1. direct `X-Google-Access-Token` from the web app
2. refresh through a stored user token based on verified Supabase user ID
3. fallback to the service account for operations that can run under service-account access

This logic lives in `apps/agent/src/lib/request-auth.ts` and related token-cache helpers.

Important exception:

- the structure-driven deck pipeline requires pooled user Google auth to access org-shared template presentations and will fail if only service-account auth is available

## Auth Model

### Web-side auth

- middleware in `apps/web/src/middleware.ts` protects authenticated routes
- the login page only supports Google sign-in and signals `hd=lumenalta.com`
- authenticated users are redirected away from `/login` to `/deals`

### Agent-side auth

- Supabase JWT verification uses remote JWKS in `apps/agent/src/lib/supabase-jwt-auth.ts`
- most custom Mastra API routes require auth by default
- notable exceptions today:
  - `GET /health`
  - `GET /generation-logs/:dealId/:touchType`

### Integration auth

- Google refresh tokens are stored encrypted in `UserGoogleToken`
- AtlusAI tokens are stored encrypted in `UserAtlusToken`
- AtlusAI background or pooled paths can also fall back to `ATLUS_API_TOKEN` when present
- user-scoped token records are tied back to Supabase user IDs

## Shared Contract Layer

`packages/schemas` is the central contract package.

It includes:

- domain constants: industries, subsectors, touch types, personas, funnel stages, artifact types, solution pillars, action types
- shared LLM schemas: transcript fields, sales brief, ROI framing, pager content, proposal copy, buyer FAQ, slide metadata, slide descriptions, template auto-classification, and more
- deal-chat payload schemas
- agent catalog metadata with stable IDs and responsibilities
- generation types used by the structure-driven pipeline

## Workflow Architecture

### Pre-call workflow

`apps/agent/src/mastra/workflows/pre-call-workflow.ts` performs:

1. company research
2. case-study retrieval from AtlusAI
3. value-hypothesis generation
4. discovery-question generation
5. Google Doc briefing creation
6. interaction persistence

This workflow is direct-generation; it does not suspend for HITL review.

### Touch 1

`apps/agent/src/mastra/workflows/touch-1-workflow.ts` uses a 3-stage HITL model:

- `skeleton`: content outline
- `lowfi`: fleshed-out draft content
- `highfi`: assembled Google Slides pager

### Touch 2 and Touch 3

`apps/agent/src/mastra/workflows/touch-2-workflow.ts` and `apps/agent/src/mastra/workflows/touch-3-workflow.ts` currently use two approval checkpoints plus final deck generation:

- `skeleton`: selected slides and rationale
- `lowfi`: draft order and notes
- final deck generation: assembled Google Slides deck, persisted without a separate high-fi suspend step

These flows prefer structure-driven generation and currently need deck structures to complete final deck assembly. When no structure exists, the workflows can still produce an empty review skeleton, but they do not complete with a separate legacy assembly path.

### Touch 4

`apps/agent/src/mastra/workflows/touch-4-workflow.ts` is the heaviest pipeline. It includes:

- transcript extraction
- seller field review
- brief generation
- brief approval
- retrieval from AtlusAI
- proposal assembly and copy generation
- proposal deck, talk track, and FAQ generation
- brand compliance checks
- final asset review

### Structure-driven workflow

`apps/agent/src/generation/structure-driven-workflow.ts` is the generalized orchestration layer for blueprint-based deck generation. It handles:

- blueprint resolution
- slide selection
- multi-source deck assembly
- slide modification planning
- slide modification execution

The underlying logic is split into dedicated modules like `blueprint-resolver.ts`, `section-matcher.ts`, `multi-source-assembler.ts`, `modification-planner.ts`, and `modification-executor.ts`.

## Deal Chat Architecture

The deal-chat system combines persisted history with page-aware guidance.

Key pieces:

- `apps/agent/src/deal-chat/assistant.ts`: orchestrates each chat turn
- `apps/agent/src/deal-chat/persistence.ts`: stores threads, messages, and context bindings
- `apps/web/src/app/api/deals/[dealId]/chat/route.ts`: proxy route for chat requests
- `apps/web/src/app/(authenticated)/deals/[dealId]/layout.tsx`: mounts `PersistentDealChat`

Capabilities:

- deal-history Q&A
- knowledge-base suggestions
- transcript upload support
- note capture and save-back into `DealContextSource`
- route-aware greeting and suggestion prompts

## Ingestion And Knowledge Pipeline

Template and example ingestion is driven by the agent service.

Core steps:

1. register a Google Slides presentation as a `Template`
2. verify accessibility through user token or service account
3. enqueue ingestion through `ingestionQueue`
4. extract slide content and structural elements
5. generate metadata, descriptions, and embeddings
6. review or correct classifications later in the UI

Related modules:

- `apps/agent/src/ingestion/ingestion-queue.ts`
- `apps/agent/src/ingestion/ingest-template.ts`
- `apps/agent/src/ingestion/auto-classify-templates.ts`
- `apps/agent/src/ingestion/backfill-descriptions.ts`

## Deck Intelligence

Deck intelligence creates reusable deck blueprints from ingested examples.

Capabilities:

- infer deck structures per touch type and artifact type
- store section flow, rationale, example count, and confidence
- allow chat-based refinement of the structure
- protect active chat sessions from automatic background reinference

Primary files:

- `apps/agent/src/deck-intelligence/infer-deck-structure.ts`
- `apps/agent/src/deck-intelligence/chat-refinement.ts`
- `apps/agent/src/deck-intelligence/auto-infer-cron.ts`

## Agent Prompt Architecture

Prompts are not hardcoded as a single opaque blob.

The system maintains:

- a stable catalog of named agents in `packages/schemas/agent-catalog.ts`
- persisted config in `AgentConfig`
- immutable history in `AgentConfigVersion`
- draft, publish, discard, rollback, and baseline-prompt flows through REST routes and settings UI

## Background Jobs And Startup Hooks

Defined primarily in `apps/agent/src/mastra/index.ts`.

- staleness polling starts after agent initialization and re-checks ingested template sources every 24h
- auto-ingest and auto-classify start after a short delay and repeat every 10m
- deck-structure inference cron starts on boot and runs every 24h
- stale ingestion states are cleared on startup for crash recovery
- slides missing descriptions or element maps are detected and queued for backfill on startup
- MCP initialization runs on startup and shuts down on `SIGTERM`

## Deployment Shape

Current deployment artifacts are focused on the agent service.

- `deploy/Dockerfile` builds the agent output and includes the generated Prisma client
- `deploy/docker-compose.yml` exposes port `4111` and checks `GET /health`
- the web app does not currently have an equivalent checked-in deployment manifest

## Architecture Caveats

- some route-level authorization behavior is internal-app oriented rather than hardened for public exposure
- `GET /generation-logs/:dealId/:touchType` is currently unauthenticated
- contributor documentation should follow the migration-only Prisma workflow even though a `db:push` script still exists in `apps/agent/package.json`
