# Backend API

## Overview

The agent service registers custom REST routes in `apps/agent/src/mastra/index.ts`. The web app calls these routes through `apps/web/src/lib/api-client.ts`.

In addition to these routes, Mastra workflow endpoints are used for starting, resuming, and polling workflow runs.

## Public Or Less-Restricted Routes

- `GET /health`: simple health check
- `GET /generation-logs/:dealId/:touchType`: generation log polling for touch workflows

Everything else should be treated as an internal authenticated application API.

## Route Families

### Companies

- `GET /companies`
- `POST /companies`

Used for company CRUD and deal creation support.

### Deals

- `GET /deals`
- `POST /deals`
- `GET /deals/:id`
- `GET /deals/:id/interactions`
- `PATCH /deals/:id/status`
- `PATCH /deals/:id/assignment`
- `GET /users/known`

These power the deal dashboard, assignee filters, and deal detail views.

### Deal chat

- `GET /deals/:dealId/chat`
- `POST /deals/:dealId/chat`
- `POST /deals/:dealId/chat/bindings`

These routes support persisted chat history, streamed chat answers, and saving context into `DealContextSource`.

### Touch and review operations

- `POST /touch-1/upload`
- `GET /briefs/:briefId`
- `GET /briefs/:briefId/review`
- `POST /briefs/:briefId/approve`
- `POST /briefs/:briefId/reject`
- `POST /briefs/:briefId/edit`
- `GET /interactions/:id/asset-review`
- `POST /interactions/:id/approve-assets`
- `POST /interactions/:id/reject-assets`
- `POST /interactions/:id/revert-stage`
- `POST /interactions/:id/mark-failed`
- `POST /interactions/:id/regenerate-stage`
- `POST /interactions/:id/retry-generation`

These routes handle human review, approval, rejection, stage rollback, and recovery flows.

### Templates and slides

- `GET /templates`
- `POST /templates`
- `DELETE /templates/:id`
- `POST /templates/:id/ingest`
- `POST /templates/:id/classify`
- `GET /templates/:id/progress`
- `POST /templates/:id/check-staleness`
- `GET /templates/:id/slides`
- `GET /templates/:id/thumbnails`
- `PATCH /slides/:id/update-classification`
- `GET /slides/:id/similar`

These routes back the template registry, ingestion UI, slide library, and slide review tools.

### Token storage and user settings

- `POST /tokens`
- `GET /tokens/check/:userId`
- `GET /tokens/access/:userId`
- `GET /user-settings/:userId/:key`
- `PUT /user-settings/:userId/:key`

These routes manage Google token persistence and per-user settings like the Drive root folder override.

### Actions

- `GET /actions`
- `GET /actions/count`
- `POST /actions/:id/resolve`
- `POST /actions/:id/silence`

These drive the action center in the UI.

### Atlus and discovery

- `POST /atlus/oauth/store-token`
- `POST /atlus/detect`
- `GET /discovery/access-check`
- `GET /discovery/browse`
- `GET /discovery/search`
- `POST /discovery/ingest`
- `GET /discovery/ingest/:batchId/progress`

These support AtlusAI account connection, access detection, discovery browsing, and ingestion from search results.

### Deck intelligence

- `GET /deck-structures`
- `GET /deck-structures/:touchType`
- `POST /deck-structures/:touchType/infer`
- `POST /deck-structures/:touchType/chat`
- `DELETE /deck-structures/:touchType/memories`
- `DELETE /deck-structures/:touchType/messages/:messageId`

These power the settings UI for inferred deck structures and chat-based refinement.

Touch 4 supports artifact-typed structure lookups through a query string such as `artifactType=proposal`.

### Agent config and prompt management

- `GET /agent-configs`
- `GET /agent-configs/:agentId`
- `GET /agent-configs/:agentId/versions`
- `PUT /agent-configs/:agentId/draft`
- `POST /agent-configs/:agentId/publish`
- `POST /agent-configs/:agentId/discard`
- `POST /agent-configs/:agentId/rollback`
- `POST /agent-configs/:agentId/chat`
- `PUT /agent-configs/baseline/draft`
- `POST /agent-configs/baseline/publish`

These routes persist the named-agent prompt system.

## Workflow Endpoints

The web app also interacts with Mastra workflow endpoints through helper functions in `apps/web/src/lib/api-client.ts`, including:

- start and resume Touch 1
- start and resume Touch 2
- start and resume Touch 3
- start, resume, and poll Touch 4
- start and poll pre-call workflow
- generic workflow-status polling helpers

The route handlers in the web app proxy or normalize some of these interactions, especially for streaming responses.

## Streaming Behaviors

Several APIs stream plaintext chunks and then append a delimiter payload.

Examples:

- deal chat appends `---DEAL_CHAT_META---`
- deck-structure chat appends `---STRUCTURE_UPDATE---`

The UI parses these markers to separate visible text from machine-readable metadata.

## Background Service Behavior

Startup and recurring service behavior is handled inside `apps/agent/src/mastra/index.ts`.

### Startup work

- clear stale ingestion states for crash recovery
- detect templates that need description/element backfill
- seed the published agent catalog defaults
- initialize MCP
- start deck inference cron

### Timers

- staleness polling: every 24h
- auto-ingest + auto-classify: every 10m
- deck-structure inference: every 24h

## API Caveats

- route-level authorization is designed around an internal authenticated app and should not be assumed to be hardened for public API use
- `GET /generation-logs/:dealId/:touchType` is unauthenticated today
- user-scoped endpoints like token or setting lookups should be treated carefully in future hardening work
