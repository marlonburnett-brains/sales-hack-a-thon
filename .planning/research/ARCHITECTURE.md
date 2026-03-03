# Architecture Research

**Domain:** Agentic sales orchestration — LLM orchestration with RAG, HITL approval flows, Google Workspace output
**Researched:** 2026-03-03
**Confidence:** MEDIUM (Mastra AI specifics from training data; core patterns HIGH from established literature)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                          │
│  ┌─────────────────────┐      ┌──────────────────────────────────┐  │
│  │   Seller Web UI     │      │    HITL Review Panel             │  │
│  │  (Next.js / React)  │      │  (brief approval + deck review)  │  │
│  └──────────┬──────────┘      └────────────┬─────────────────────┘  │
└─────────────┼───────────────────────────────┼───────────────────────┘
              │ HTTP / REST                    │ webhook / polling
┌─────────────▼───────────────────────────────▼───────────────────────┐
│                         API GATEWAY LAYER                           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Next.js API Routes / Express server             │   │
│  │  POST /api/pre-call        POST /api/post-call               │   │
│  │  POST /api/workflow/resume  GET /api/workflow/:id/status      │   │
│  └──────────────────────────────┬───────────────────────────────┘   │
└──────────────────────────────────┼──────────────────────────────────┘
                                   │ function calls
┌──────────────────────────────────▼──────────────────────────────────┐
│                      MASTRA AI ORCHESTRATION LAYER                  │
│                                                                      │
│  ┌─────────────────────────┐   ┌────────────────────────────────┐   │
│  │   Pre-Call Workflow      │   │   Post-Call Workflow           │   │
│  │  ┌───────────────────┐  │   │  ┌──────────────────────────┐  │   │
│  │  │ Step: ResearchCo  │  │   │  │ Step: ParseTranscript    │  │   │
│  │  │ Step: GenHypothes │  │   │  │ Step: ValidateSchema     │  │   │
│  │  │ Step: BuildBriefin│  │   │  │ Step: GenerateBrief      │  │   │
│  │  │ Step: SaveToDrive │  │   │  │ Step: [SUSPEND → HITL-1] │  │   │
│  │  └───────────────────┘  │   │  │ Step: RAGRetrieval       │  │   │
│  └─────────────────────────┘   │  │ Step: AssembleSlideJSON  │  │   │
│                                 │  │ Step: GenerateCopy       │  │   │
│  ┌─────────────────────────┐   │  │ Step: CreateGoogleSlides │  │   │
│  │   Mastra Agents          │   │  │ Step: CreateTalkTrack    │  │   │
│  │  - ResearchAgent         │   │  │ Step: [SUSPEND → HITL-2] │  │   │
│  │  - TranscriptAgent       │   │  │ Step: CaptureEdits       │  │   │
│  │  - ContentAgent          │   │  └──────────────────────────┘  │   │
│  │  - CopywritingAgent      │   └────────────────────────────────┘   │
│  └─────────────────────────┘                                         │
└──────────────────────────────────────────────────────────────────────┘
         │                    │                        │
         │ MCP calls          │ Gemini API             │ Google APIs
         ▼                    ▼                        ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────────────┐
│  KNOWLEDGE LAYER │ │   LLM LAYER      │ │   OUTPUT LAYER           │
│                  │ │                  │ │                           │
│  AtlusAI MCP     │ │  Gemini 3 Flash  │ │  Google Slides API       │
│  - Semantic srch │ │  - Transcript    │ │  Google Docs API          │
│  - Struct search │ │    extraction    │ │  Google Drive API         │
│  - Doc discovery │ │  - Brief gen     │ │  (service account auth)  │
│  - Slide chunks  │ │  - Copy gen      │ └──────────────────────────┘
│  - Case studies  │ │  - FAQ gen       │
│  - Brand assets  │ └──────────────────┘
└──────────────────┘
         │
┌──────────────────┐
│  CONTENT INDEX   │
│  (indexed by:)   │
│  - industry      │
│  - subsector     │
│  - solution pillar│
│  - persona       │
│  - funnel stage  │
└──────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Seller Web UI | Input collection (company name, transcript paste), workflow status display, HITL review panels | Next.js + React, polling or SSE for workflow status |
| HITL Review Panel | Renders structured brief for approval, shows final deck/doc links for sign-off, captures edit annotations | React component backed by workflow state endpoint |
| API Gateway | Receives UI requests, validates input, starts Mastra workflows, exposes resume/status endpoints | Next.js API routes or a thin Express layer |
| Mastra Workflows | Stateful step-by-step orchestration with suspend/resume at HITL checkpoints; owns execution logic | `workflow.createWorkflow()` with typed step definitions |
| Mastra Agents | Encapsulate LLM calls with tool access; each agent has a specific role (research, parse, copy) | `agent.create()` with system prompt, tools, and model config |
| AtlusAI MCP Integration | RAG retrieval: semantic search over slide blocks, case studies, brand assets; returns ranked chunks | MCP tool calls from within Mastra workflow steps |
| Gemini 3 Flash (LLM) | All generation tasks: transcript field extraction, brief synthesis, copy generation, FAQ creation | Gemini API via Mastra model provider; Zod schemas enforce structured output |
| Zod v4 Schema Layer | Runtime validation of LLM output; rejects incomplete structured data with field-level errors | Defined alongside each workflow step; used in Mastra `.generate()` calls |
| Google Slides API | Creates slides in shared Lumenalta Drive from assembled slide JSON; sets content and layout | `googleapis` Node client, service account credentials |
| Google Docs API | Creates talk track and buyer FAQ documents | `googleapis` Node client, service account credentials |
| Google Drive API | Organizes output artifacts in folder structure, controls sharing | `googleapis` Node client, same service account |
| Workflow State Store | Persists workflow run state between suspend/resume cycles (HITL checkpoints) | Mastra built-in persistence (typically PostgreSQL or SQLite) |

---

## Recommended Project Structure

```
src/
├── workflows/               # Mastra workflow definitions
│   ├── pre-call.workflow.ts    # Pre-call briefing flow (4 steps, no suspend)
│   ├── post-call.workflow.ts   # Post-call flow (10 steps, 2 suspend points)
│   └── steps/               # Individual step implementations
│       ├── research-company.step.ts
│       ├── parse-transcript.step.ts
│       ├── validate-transcript.step.ts
│       ├── generate-brief.step.ts
│       ├── rag-retrieval.step.ts
│       ├── assemble-slide-json.step.ts
│       ├── generate-copy.step.ts
│       ├── create-google-slides.step.ts
│       ├── create-talk-track.step.ts
│       └── capture-edits.step.ts
│
├── agents/                  # Mastra agent definitions
│   ├── research.agent.ts       # Company research via public sources
│   ├── transcript.agent.ts     # Transcript parsing and extraction
│   ├── content.agent.ts        # RAG retrieval and slide block selection
│   └── copywriting.agent.ts    # Copy generation for slide blocks
│
├── schemas/                 # Zod v4 schema definitions
│   ├── transcript-fields.schema.ts   # Extracted transcript structured data
│   ├── sales-brief.schema.ts         # Multi-Pillar Sales Brief structure
│   ├── slide-assembly.schema.ts      # Slide JSON assembly output
│   └── company-research.schema.ts    # Pre-call briefing structure
│
├── tools/                   # Mastra tool definitions (callable by agents)
│   ├── atlusai.tool.ts         # AtlusAI MCP semantic + structured search
│   ├── google-slides.tool.ts   # Google Slides API write operations
│   ├── google-docs.tool.ts     # Google Docs API write operations
│   └── google-drive.tool.ts    # Drive folder creation and file linking
│
├── integrations/            # External service clients
│   ├── atlusai/
│   │   ├── client.ts           # MCP connection and query methods
│   │   └── index-content.ts    # One-time content ingestion scripts
│   └── google/
│       ├── auth.ts             # Service account credential setup
│       ├── slides.ts           # Slides API helper functions
│       ├── docs.ts             # Docs API helper functions
│       └── drive.ts            # Drive API helper functions
│
├── app/                     # Next.js web UI (if collocated)
│   ├── api/                    # API route handlers
│   │   ├── pre-call/route.ts
│   │   ├── post-call/route.ts
│   │   └── workflow/
│   │       ├── [id]/status/route.ts
│   │       └── [id]/resume/route.ts
│   └── (ui)/                   # React pages and components
│       ├── pre-call/page.tsx
│       ├── post-call/page.tsx
│       └── review/[id]/page.tsx  # HITL review page
│
├── lib/                     # Shared utilities
│   ├── taxonomy.ts             # 11 industry / 62 subsector definitions
│   ├── quality-checker.ts      # Output quality checklist validation
│   └── feedback-logger.ts      # Captures human edits for refinement loop
│
└── mastra.config.ts         # Mastra framework entry point and registration
```

### Structure Rationale

- **workflows/ vs agents/:** Workflows own the stateful execution graph including suspend points; agents own the LLM interaction logic. Keeping them separate prevents coupling orchestration state to model behavior.
- **schemas/:** Centralizing Zod schemas ensures the same validation is used in both Mastra `.generate()` calls and API route input validation. Single source of truth for data contracts.
- **tools/:** Mastra tools are the formal boundary between agents and external services. All Google API and AtlusAI calls go through tools, making them testable and replaceable.
- **integrations/:** Raw API clients with no Mastra coupling. This layer can be tested independently and swapped if AtlusAI or Google credentials change.
- **lib/taxonomy.ts:** The 11-industry / 62-subsector taxonomy is a shared constant referenced by both the UI (dropdowns) and the RAG retrieval step (filter parameters). One definition, many consumers.

---

## Architectural Patterns

### Pattern 1: Workflow-as-State-Machine with Suspend/Resume

**What:** Each workflow is a directed graph of steps. Steps produce typed output consumed by subsequent steps. At HITL checkpoints, the workflow suspends and stores its state to persistent storage. A human action (API call from the UI) resumes the workflow with approval data injected as the next step's input.

**When to use:** Any flow that requires human decision-making in the middle of an automated pipeline. Required for both HITL-1 (brief approval) and HITL-2 (final assets sign-off).

**Trade-offs:** Adds complexity of durable state storage; eliminates the risk of losing work in progress if the process dies between human actions.

**Example:**
```typescript
// post-call.workflow.ts (Mastra v0.x pattern)
import { createWorkflow, createStep } from '@mastra/core';
import { generateBriefStep } from './steps/generate-brief.step';
import { salesBriefSchema } from '../schemas/sales-brief.schema';

export const postCallWorkflow = createWorkflow({
  name: 'post-call-deck-generation',
  triggerSchema: z.object({
    transcript: z.string(),
    industry: z.string(),
    subsector: z.string(),
    sellerId: z.string(),
  }),
})
  .step(parseTranscriptStep)
  .step(validateTranscriptStep)
  .step(generateBriefStep)
  // Suspend here; workflow persists state; UI polls /workflow/:id/status
  .step(hitlCheckpoint1Step)   // emits { status: 'awaiting_approval', briefData: ... }
  .afterEvent('brief-approved') // resumes on explicit resume call
  .step(ragRetrievalStep)
  .step(assembleSlideJsonStep)
  .step(generateCopyStep)
  .step(createGoogleSlidesStep)
  .step(createTalkTrackStep)
  .step(hitlCheckpoint2Step)   // second suspend
  .afterEvent('assets-approved')
  .step(captureEditsStep)
  .commit();
```

### Pattern 2: Agent-per-Concern with Typed Tool Boundaries

**What:** Each LLM-interaction concern gets its own agent with a scoped system prompt, a specific set of tools, and a Zod-validated output schema. Agents do not call each other directly; they are invoked by workflow steps which pass typed context.

**When to use:** Whenever the same capability (e.g., RAG retrieval) is needed in multiple workflow steps, or when a single LLM call must be constrained to a specific domain (e.g., copywriting agent only writes copy — it never researches companies).

**Trade-offs:** More files and definitions upfront; prevents prompt contamination across concerns; each agent is independently testable with mock tool responses.

**Example:**
```typescript
// agents/content.agent.ts
import { createAgent } from '@mastra/core';
import { atlusaiTool } from '../tools/atlusai.tool';

export const contentAgent = createAgent({
  name: 'content-retrieval',
  instructions: `You are a content retrieval specialist for Lumenalta's sales collateral library.
    Given an industry, subsector, solution pillars, and deal context, retrieve the most relevant
    slide blocks, case studies, and capability descriptions. Return ONLY content from the library.
    Never generate layouts or capabilities not present in the retrieved content.`,
  model: geminiFlash,
  tools: { atlusai: atlusaiTool },
  defaultGenerateOptions: {
    output: slideRetrievalSchema,  // Zod schema enforces structured retrieval result
  },
});
```

### Pattern 3: RAG as a Workflow Step, Not Agent Intelligence

**What:** RAG retrieval is treated as a discrete, explicit workflow step rather than an implicit capability of an agent. The retrieval step calls AtlusAI via MCP with structured filter parameters (industry, solution pillar, funnel stage), receives ranked chunks, and passes the chunk set to the next step as typed context.

**When to use:** When retrieval quality is a first-class concern — explicit steps are observable, debuggable, and replaceable. Prevents the model from "deciding" when to retrieve content.

**Trade-offs:** More deterministic and auditable than letting an agent autonomously decide to call a retrieval tool; less flexible if retrieval needs to be iterative (e.g., refine query based on initial results).

**Example:**
```typescript
// steps/rag-retrieval.step.ts
export const ragRetrievalStep = createStep({
  id: 'rag-retrieval',
  inputSchema: salesBriefSchema,  // Output of HITL-1 approved brief
  outputSchema: retrievedContentSchema,
  execute: async ({ context }) => {
    const { primaryPillar, secondaryPillar, industry, subsector } = context;
    const chunks = await atlusaiClient.semanticSearch({
      query: buildRetrievalQuery(primaryPillar, industry),
      filters: { industry, subsector, solutionPillar: primaryPillar, funnelStage: 'proposal' },
      topK: 15,
    });
    return { slideBlocks: chunks.slides, caseStudies: chunks.cases };
  },
});
```

### Pattern 4: Schema-First Output Contract (Zod v4 + Gemini Structured Output)

**What:** Every LLM generation call is constrained by a Zod v4 schema passed to Gemini's structured output mode. The schema defines exactly what fields the LLM must produce. If the output fails validation, the workflow step rejects it and returns a field-level error to the caller.

**When to use:** For every extraction and generation step. Especially critical for transcript parsing (missing fields must surface as specific errors, not null outputs).

**Trade-offs:** Requires careful schema design upfront; greatly reduces hallucinated or malformed output; validation errors are human-readable and can be surfaced to the seller UI.

---

## Data Flow

### Pre-Call Briefing Flow

```
Seller inputs company name + buyer role + meeting context
    ↓
POST /api/pre-call  →  starts Mastra pre-call workflow
    ↓
[Step: ResearchCompany]
    ↓  AtlusAI MCP (Lumenalta solution matching)
    ↓  (public sources via research agent tools)
    → company snapshot: { initiatives, news, financials, relevantSolutions }
    ↓
[Step: GenerateHypotheses]  →  Gemini Flash
    → hypotheses: string[]
    → discoveryQuestions: { question, mappedSolution, priority }[]
    ↓
[Step: BuildBriefingDoc]  →  assembles formatted one-pager JSON
    ↓
[Step: SaveToDrive]  →  Google Drive API (service account)
    → driveFileUrl: string
    ↓
UI polls workflow status  →  displays formatted briefing + Drive link
```

### Post-Call Transcript → Deck Flow (with HITL)

```
Seller pastes transcript + selects industry + subsector
    ↓
POST /api/post-call  →  starts Mastra post-call workflow  →  workflowId returned
    ↓
[Step: ParseTranscript]  →  Gemini Flash + transcriptFieldsSchema
    → { customerContext, businessOutcomes, constraints, stakeholders, timeline, budget }
    ↓
[Step: ValidateTranscript]  →  Zod validation
    IF missing critical fields:
    → workflow returns { status: 'incomplete', missingFields: string[] }
    → UI shows seller which fields are missing BEFORE proceeding
    ↓ (all fields present)
[Step: GenerateBrief]  →  Gemini Flash + salesBriefSchema
    → { primaryPillar, secondaryPillar, positioning, roiStatements, valueHypothesis }
    ↓
[Step: HITL Checkpoint 1]  →  workflow SUSPENDS
    → persists { workflowId, briefData, status: 'awaiting_brief_approval' }
    → notifies seller + SME (email / UI notification)

    === HUMAN ACTION: Seller + SME review brief in /review/:workflowId ===

POST /api/workflow/:id/resume  { approved: true, edits: {...} }
    ↓
[Step: RAGRetrieval]  →  AtlusAI MCP semantic search
    → { slideBlocks: SlideChunk[], caseStudies: CaseStudy[] }
    ↓
[Step: AssembleSlideJSON]  →  Gemini Flash + slideAssemblySchema
    → ordered array of { slideId, layout, contentFields: {} }
    ↓
[Step: GenerateCopy]  →  Gemini Flash (copywritingAgent)
    → each slideId populated with bespoke copy strings
    ↓
[Step: CreateGoogleSlides]  →  Google Slides API (service account)
    → creates presentation in shared Drive folder
    → returns { presentationId, driveUrl }
    ↓
[Step: CreateTalkTrack]  →  Google Docs API
    → returns { talkTrackDocId, faqDocId }
    ↓
[Step: HITL Checkpoint 2]  →  workflow SUSPENDS
    → persists { workflowId, assets: { slidesUrl, talkTrackUrl, faqUrl }, status: 'awaiting_final_approval' }
    → notifies Seller, SME, Marketing, Solutions

    === HUMAN ACTION: Reviewers approve / annotate in /review/:workflowId ===

POST /api/workflow/:id/resume  { approved: true, humanEdits: {...} }
    ↓
[Step: CaptureEdits]  →  logs edit delta to feedback store
    → updates few-shot examples for refinement loop
    ↓
Workflow complete  →  final status: { status: 'complete', assets: {...} }
```

### State Management

```
Mastra Workflow State Store (PostgreSQL / SQLite)
    ↓ (persists on each step completion)
Workflow Run Record:
  - workflowId: uuid
  - status: 'running' | 'suspended' | 'complete' | 'error'
  - currentStep: string
  - stepOutputs: Record<stepId, typedOutput>   ← typed, validated
  - suspendPayload: object                      ← data for HITL UI rendering
  - createdAt / updatedAt

UI polling: GET /api/workflow/:id/status
    → returns { status, suspendPayload } on suspension
    → HITL review page renders suspendPayload directly
```

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-50 sellers (hackathon / v1) | Single Next.js server, in-process Mastra, SQLite state store, one service account. No queue needed. |
| 50-500 sellers | Move workflow execution to background workers (BullMQ job queue). Decouple API server from workflow runner. Add PostgreSQL for workflow state. |
| 500+ sellers | Horizontally scale workflow workers. Add workflow timeout handling and dead-letter queues. Consider separate RAG caching layer for high-frequency AtlusAI queries. |

### Scaling Priorities

1. **First bottleneck:** Gemini API rate limits. Each workflow run makes 4-6 Gemini calls. At high concurrency, implement per-seller request queuing.
2. **Second bottleneck:** Google Slides API. Service account has per-minute write limits. Batch slide creation requests and add retry with exponential backoff.

---

## Anti-Patterns

### Anti-Pattern 1: Monolithic "Super-Agent" that Does Everything

**What people do:** Create one agent with every tool attached and ask it to run the full pipeline end-to-end in a single prompt.

**Why it's wrong:** A single agent context cannot reliably extract transcript fields, do RAG retrieval, assemble a slide structure, and write copy in one pass. Each concern has different instructions. Mixing them causes the model to drift, hallucinate, or ignore constraints from earlier in the prompt.

**Do this instead:** One agent per concern, each with a scoped system prompt and only the tools it needs. Workflow steps compose agents in sequence.

### Anti-Pattern 2: Generating Slides Without Validating the Brief

**What people do:** Skip structured brief validation and pipe transcript text directly to a slide generation prompt to save steps.

**Why it's wrong:** Missing budget, unclear stakeholders, or generic problem framing will propagate into every generated slide. Errors are expensive to fix post-generation. The HITL-1 brief approval checkpoint exists specifically to catch this.

**Do this instead:** Hard-stop the pipeline at HITL-1. Zero slides are generated until the structured brief is explicitly approved. Zod validation of the brief schema is a prerequisite for the resume call.

### Anti-Pattern 3: Inline Google API Calls Inside LLM Tool Definitions

**What people do:** Embed the full Google Slides API logic inside the agent's tool definition so the agent can "decide" when to create slides.

**Why it's wrong:** Agents should not control when slides are created — that is a workflow orchestration decision. If an agent creates slides during a reasoning loop, the workflow loses the ability to gate creation behind HITL approval.

**Do this instead:** Google API operations are only invoked from explicit workflow steps (not from agent tools). Agents produce structured JSON; workflow steps call the Google API with that JSON.

### Anti-Pattern 4: Storing the Full Transcript in Every Step's Context

**What people do:** Pass the raw transcript string as context to every downstream step for "reference."

**Why it's wrong:** Wastes token budget and increases Gemini API costs per call. After the parse step, the transcript has been reduced to structured fields.

**Do this instead:** The parse step outputs a typed schema. All downstream steps consume the typed output, not the raw transcript. Keep the raw transcript in workflow state but only inject it where explicitly needed.

### Anti-Pattern 5: MCP Content Ingestion as a Runtime Operation

**What people do:** Try to ingest and index Lumenalta content assets into AtlusAI as part of the application startup or first workflow run.

**Why it's wrong:** Content ingestion is a one-time administrative task, not a runtime operation. Treating it as runtime blocks the application on every restart and makes it brittle.

**Do this instead:** Build a separate `src/integrations/atlusai/index-content.ts` script run once before the application is deployed. The RAG pipeline assumes AtlusAI is already populated. Document the ingestion process explicitly.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| AtlusAI | MCP client within Mastra tool definitions; tool called from RAG retrieval workflow step | Must be populated with indexed content before workflow is functional. Semantic search + structured filter search are distinct query modes. |
| Gemini Flash API | Via Mastra model provider (`@mastra/google` or similar); pass Zod schema to `.generate()` for structured output | Large context window handles noisy transcripts. Rate limit is the primary scaling concern. |
| Google Slides API | `googleapis` Node.js client with service account credentials; called only from `CreateGoogleSlides` workflow step | Requires Slides scope in service account. Use `batchUpdate` requests for efficiency — one API call creates all slides. |
| Google Docs API | `googleapis` Node.js client, same service account | Talk track and FAQ are separate documents. Keep IDs in workflow state for linking. |
| Google Drive API | `googleapis` Node.js client, same service account | Create per-deal folder in shared Lumenalta Drive. Store folder ID in workflow state for organizing all output artifacts. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Web UI ↔ API Gateway | HTTP REST (JSON); polling for workflow status | Use Server-Sent Events (SSE) as a v1.1 upgrade to eliminate polling. For hackathon, polling every 3s is sufficient. |
| API Gateway ↔ Mastra | Direct function calls (same process in v1) | In v2+, decouple via job queue (BullMQ) so the API server returns immediately and workflows run asynchronously. |
| Mastra Workflow ↔ Agents | Typed function calls; agents invoked within step `execute()` functions; output validated against Zod schema before step commits | Agents are stateless within a step execution. Workflow state is owned by the workflow, not the agent. |
| Mastra Agents ↔ Tools | Mastra tool registry; tools are called by the model during generation | Each tool has `inputSchema` and `outputSchema` for type safety. |
| Workflow Steps ↔ AtlusAI | Via Mastra tool → MCP client → AtlusAI API | The MCP abstraction means the tool implementation can swap AtlusAI for another knowledge base without changing workflow logic. |
| Workflow Steps ↔ Google APIs | Via `integrations/google/` helper functions, called directly (not via agent tools) | Direct calls enforce that Google output only happens at designated workflow steps, not during agent reasoning. |

---

## Suggested Build Order

The architecture has a dependency chain that dictates build sequence:

```
1. Foundations (no dependencies)
   ├── Zod schemas (transcript, brief, slide assembly)
   ├── Google service account auth + API helpers (verify credentials work)
   ├── AtlusAI MCP client + content ingestion script
   └── Mastra config and agent boilerplate

2. Core Pipeline Steps (depends on #1)
   ├── ParseTranscript step + ValidateTranscript step (Zod output)
   ├── GenerateBrief step (LLM + schema)
   └── RAGRetrieval step (AtlusAI must be populated)

3. Google Output Steps (depends on #2, #1 Google helpers)
   ├── AssembleSlideJSON step
   ├── GenerateCopy step
   ├── CreateGoogleSlides step (first end-to-end integration test)
   └── CreateTalkTrack step

4. Workflow Wiring + HITL (depends on #2, #3)
   ├── Post-call workflow with suspend/resume
   ├── HITL state persistence
   └── Resume API endpoint

5. Web UI (depends on #4 for API contract)
   ├── Post-call input form
   ├── HITL review panel
   └── Status polling

6. Pre-Call Flow (parallel to #4-5, lighter dependency)
   ├── ResearchCompany step
   ├── GenerateHypotheses step
   ├── Pre-call workflow (no suspend)
   └── Pre-call UI

7. Feedback Loop (depends on everything)
   └── CaptureEdits step + feedback logger
```

**Key dependency constraint:** The RAG retrieval step (step 2) cannot be meaningfully tested until AtlusAI is populated with indexed Lumenalta content (step 1). This makes content ingestion a day-one prerequisite, not a later task.

---

## Sources

- Mastra AI documentation (https://mastra.ai/docs) — MEDIUM confidence (training data; verify current API against live docs)
- Google Slides API reference (https://developers.google.com/slides/api/reference/rest) — HIGH confidence
- Google Drive API — service account authorization patterns — HIGH confidence
- RAG pipeline architecture patterns (LangChain, LlamaIndex, and Mastra RAG documentation) — HIGH confidence on pattern; MEDIUM on Mastra-specific API details
- Zod v4 structured output integration with LLM providers — MEDIUM confidence (v4 released 2025; verify Mastra integration is current)
- MCP (Model Context Protocol) for tool-as-service patterns — MEDIUM confidence (rapidly evolving ecosystem)

---

*Architecture research for: Agentic sales orchestration — Mastra AI + AtlusAI RAG + Google Workspace output*
*Researched: 2026-03-03*
