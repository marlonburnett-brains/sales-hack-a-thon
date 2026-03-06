# Lumenalta Agentic Sales Orchestration

An AI-powered sales enablement platform that covers all four touch points in Lumenalta's 2026 GTM strategy — from first-contact pagers through intro decks and capability alignment decks to fully custom solution proposals. The system eliminates the 24-hour to 5-day bottleneck between discovery calls and polished, brand-compliant collateral by orchestrating Gemini AI, Google Workspace APIs, and the AtlusAI knowledge base through automated workflows with human-in-the-loop checkpoints.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Turborepo Monorepo                       │
│                                                                 │
│  ┌──────────────────┐         ┌──────────────────────────────┐  │
│  │   apps/web        │  REST  │   apps/agent                  │  │
│  │   Next.js 15      │───────▶│   Mastra AI Workflows         │  │
│  │   Port 3000       │        │   Port 4111                   │  │
│  │                   │        │                               │  │
│  │  - Deal dashboard │        │  - Touch 1-4 workflows        │  │
│  │  - Touch forms    │        │  - Pre-call workflow          │  │
│  │  - HITL review UI │        │  - Prisma ORM (PostgreSQL)    │  │
│  │  - Timeline view  │        │  - Schema validation          │  │
│  └──────────────────┘         └───────┬───────┬───────┬───────┘  │
│                                       │       │       │          │
│  ┌────────────────────────────────────┐│       │       │          │
│  │  packages/schemas                  ││       │       │          │
│  │  Shared Zod schemas + constants    ││       │       │          │
│  └────────────────────────────────────┘│       │       │          │
└────────────────────────────────────────┼───────┼───────┼──────────┘
                                         │       │       │
                              ┌──────────┘       │       └──────────┐
                              ▼                  ▼                  ▼
                    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
                    │  Gemini 2.5  │   │   Google      │   │   AtlusAI    │
                    │  Flash API   │   │   Workspace   │   │   Knowledge  │
                    │              │   │   (Slides,    │   │   Base (MCP) │
                    │  Structured  │   │    Docs,      │   │              │
                    │  outputs     │   │    Drive)     │   │  Semantic &  │
                    │              │   │               │   │  structured  │
                    │              │   │  Service acct │   │  search      │
                    └──────────────┘   └──────────────┘   └──────────────┘
```

**Communication flow:** The Next.js frontend calls the Mastra agent service over REST via a typed fetch wrapper. The agent service orchestrates AI generation (Gemini), document creation (Google Workspace APIs), and content retrieval (AtlusAI MCP). Workflows support suspend/resume for human-in-the-loop checkpoints.

## Tech Stack

| Category | Technology |
|---|---|
| **Language** | TypeScript 5.7 |
| **Frontend** | Next.js 15 (App Router), React 19, TailwindCSS, shadcn/ui, Radix UI |
| **AI orchestration** | Mastra 1.3 |
| **LLM** | Gemini 2.5 Flash (`@google/genai`) |
| **Knowledge base** | AtlusAI (MCP-connected semantic search) |
| **Database** | Supabase PostgreSQL via Prisma ORM |
| **Document generation** | Google Slides API, Google Docs API, Google Drive API |
| **Validation** | Zod v4, `@t3-oss/env-nextjs` / `@t3-oss/env-core` |
| **Forms** | React Hook Form + `@hookform/resolvers` |
| **Build** | Turborepo, pnpm workspaces |

## Project Structure

```
lumenalta-hackathon/
├── apps/
│   ├── web/                          # Next.js 15 frontend
│   │   ├── src/
│   │   │   ├── app/                  # App Router pages & API routes
│   │   │   │   ├── deals/            # Deal dashboard, detail, review pages
│   │   │   │   └── api/              # File upload route handler
│   │   │   ├── components/           # React components
│   │   │   │   ├── deals/            # Deal cards, forms, dashboard
│   │   │   │   ├── pre-call/         # Pre-call briefing UI
│   │   │   │   ├── timeline/         # Interaction timeline
│   │   │   │   ├── touch/            # Touch 1-4 forms and review UIs
│   │   │   │   └── ui/              # shadcn/ui primitives
│   │   │   └── lib/                  # API client, server actions, utilities
│   │   └── package.json
│   │
│   └── agent/                        # Mastra AI orchestration service
│       ├── src/
│       │   ├── mastra/               # Mastra agent + workflow definitions
│       │   │   └── workflows/        # Touch 1-4 + pre-call workflows
│       │   ├── lib/                  # Core business logic
│       │   │   ├── atlusai-client.ts # AtlusAI MCP integration
│       │   │   ├── deck-assembly.ts  # Google Slides assembly
│       │   │   ├── doc-builder.ts    # Google Docs generation
│       │   │   ├── drive-folders.ts  # Google Drive management
│       │   │   ├── google-auth.ts    # Service account auth
│       │   │   └── brand-compliance.ts
│       │   ├── ingestion/            # Content library ingestion
│       │   └── validation/           # Schema validation scripts
│       ├── prisma/
│       │   └── schema.prisma         # Database schema
│       └── package.json
│
├── packages/
│   ├── schemas/                      # Shared Zod schemas & domain constants
│   │   ├── constants.ts              # 11 industries, 62 subsectors, pillars
│   │   ├── llm/                      # LLM structured output schemas
│   │   └── app/                      # Application-level schemas
│   ├── tsconfig/                     # Shared TypeScript configs
│   └── eslint-config/                # Shared ESLint config
│
├── turbo.json                        # Turborepo task config
├── pnpm-workspace.yaml               # pnpm workspace definition
└── package.json
```

## Key Features

### Touch 1 — First Contact (1-2 Pager)
Seller inputs company name, industry, and context. Gemini generates a branded pager (headline, value prop, capabilities, CTA). Seller approves or overrides — overrides are captured as learning signals.

### Touch 2 — Intro Conversation (Meet Lumenalta Deck)
AI selects the most relevant slides from a pre-made "Meet Lumenalta" deck based on industry and context, then assembles them into a Google Slides presentation with salesperson and customer customizations.

### Touch 3 — Capability & Use Case Alignment
Seller selects 1-2 capability areas. AI retrieves and assembles relevant slides from AtlusAI and capability decks into a customized Google Slides presentation.

### Touch 4 — Solution Proposal (Transcript-to-Deck)
The heaviest workflow — a multi-step pipeline:
1. Seller pastes a raw meeting transcript and selects industry/subsector
2. Gemini extracts structured fields (Customer Context, Business Outcomes, Constraints, Stakeholders, Timeline, Budget)
3. **HITL Checkpoint 1:** Seller reviews and approves the generated brief
4. System retrieves relevant content from AtlusAI, assembles slide JSON, and generates a Google Slides deck + Talk Track (Google Doc) + Buyer FAQ (Google Doc)
5. **HITL Checkpoint 2:** Seller reviews final assets before delivery

### Pre-Call Briefing
Seller inputs company name, buyer role, and meeting context. System generates a company research snapshot, role-specific hypotheses, and 5-10 prioritized discovery questions — delivered as a formatted Google Doc.

## Getting Started

### Prerequisites

- **Node.js** 18+
- **pnpm** 9.12.0 (required — not npm or yarn)

### Installation

```bash
pnpm install
```

### Environment Variables

Environment files are encrypted and committed to the repo. To set up locally:

1. Get the `SECRETS_KEY` from a team member
2. Add it to the root `.env.local`:
   ```
   SECRETS_KEY=<key-from-team>
   ```
3. Decrypt all environment files:
   ```bash
   make pull env
   ```

If you're setting up the project for the first time (no existing key):

```bash
make set-new env   # Generates a new key in .env.local
make push env      # Encrypts all secret files (commit the .enc files)
```

The list of managed secret files is defined in `secrets.yml`.

#### Agent (`apps/agent/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Supabase PostgreSQL pooled connection string |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Yes | Google service account credentials JSON string |
| `GOOGLE_DRIVE_FOLDER_ID` | Yes | Google Drive folder ID for generated assets |
| `GOOGLE_TEMPLATE_PRESENTATION_ID` | Yes | Lumenalta branded Google Slides template ID |
| `GEMINI_API_KEY` | Yes | Google Gemini API key ([get one here](https://aistudio.google.com/apikey)) |
| `MEET_LUMENALTA_PRESENTATION_ID` | No | Source presentation ID for Touch 2 intro decks |
| `CAPABILITY_DECK_PRESENTATION_ID` | No | Source presentation ID for Touch 3 capability decks |
| `MASTRA_PORT` | No | Mastra HTTP server port (default: `4111`) |
| `NODE_ENV` | No | `development` / `production` / `test` |

#### Web (`apps/web/.env`)

| Variable | Required | Description |
|---|---|---|
| `AGENT_SERVICE_URL` | No | Agent service URL (default: `http://localhost:4111`) |
| `NODE_ENV` | No | `development` / `production` / `test` |

### Database Setup

```bash
pnpm --filter agent db:push
```

This pushes the Prisma schema to the PostgreSQL database. For subsequent schema changes:

```bash
pnpm --filter agent db:generate   # Regenerate Prisma client
pnpm --filter agent db:migrate    # Run migrations
```

### Running the App

Start both the web app and agent service with environment switching:

```bash
make run dev    # Uses .env.dev files (default)
make run prod   # Uses .env.prod files
```

This copies the appropriate env files into place and starts both services.

- **Web app:** http://localhost:3000
- **Agent service:** http://localhost:4111

To run them individually:

```bash
pnpm --filter web dev      # Next.js only
pnpm --filter agent dev    # Mastra agent only
```

## Scripts

| Command | Description |
|---|---|
| `make run dev` | Start all apps with dev environment |
| `make run prod` | Start all apps with prod environment |
| `make install` | Install dependencies |
| `make build` | Build all apps and packages |
| `make lint` | Lint all apps and packages |
| `make set-new env` | Generate a new secrets encryption key |
| `make push env` | Encrypt secret files (commit the `.enc` files) |
| `make pull env` | Decrypt secret files from `.enc` to local |
| `make db-generate` | Regenerate Prisma client |
| `make db-migrate` | Run database migrations |
| `make seed` | Seed the database |

## Shared Packages

| Package | Description |
|---|---|
| `@lumenalta/schemas` | Zod validation schemas for LLM structured outputs and app data, plus domain constants (industries, subsectors, solution pillars) |
| `@lumenalta/tsconfig` | Base, Next.js, and Node.js TypeScript configurations |
| `@lumenalta/eslint-config` | Shared ESLint rules with TypeScript parser |
