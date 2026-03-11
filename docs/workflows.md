# Workflows And Features

## Product Scope

AtlusDeck supports the seller journey from meeting prep through custom follow-up assets.

The core workflow families are:

- pre-call briefing
- touch 1 first-contact pager
- touch 2 intro deck
- touch 3 capability-alignment deck
- touch 4 proposal package

## Shared Workflow Concepts

### Interaction records

Every touch flow persists an `InteractionRecord`. It stores:

- `touchType`
- workflow status
- raw inputs
- current HITL stage
- stage content for review
- generated content and output references
- Drive file references

### HITL stages

Touch workflows use Mastra suspend/resume boundaries so sellers can approve or refine content before the next generation step.

Common stages in code:

- `skeleton`
- `lowfi`
- `highfi`
- `ready` in some later-stage contexts

### Generated assets

Generated assets are stored in Google Drive, usually in a per-deal folder. Touch 4 can create multiple artifacts per run.

## Pre-call Briefing

File: `apps/agent/src/mastra/workflows/pre-call-workflow.ts`

Inputs:

- deal ID
- company name
- industry
- buyer role
- meeting context

Pipeline:

1. run company research through the `company-researcher` agent
2. query AtlusAI for case-study-like results
3. generate value hypotheses through `value-hypothesis-strategist`
4. generate prioritized discovery questions through `discovery-question-strategist`
5. build a formatted Google Doc briefing
6. store interaction history and output references

Outputs:

- Google Doc pre-call briefing
- persisted interaction record

Seller-facing value:

- turns sparse meeting context into a prep document
- grounds questions in Lumenalta solution pillars
- links the briefing to the deal folder

## Touch 1: First-contact Pager

File: `apps/agent/src/mastra/workflows/touch-1-workflow.ts`

Inputs:

- deal ID
- company name
- industry
- freeform seller context
- optional salesperson name

Stages:

### 1. Skeleton

The system generates:

- headline
- value proposition
- key capabilities

The seller can approve or refine the outline.

### 2. Low-fi

The system expands the approved outline into richer pager content. If deck-structure metadata exists, generation can become section-aware and align to template slot counts.

### 3. High-fi

The system assembles a Google Slides one-pager and updates the interaction record with the generated asset.

Other capabilities:

- visual QA can be enabled
- sellers can override with manual uploads through `/touch-1/upload`
- feedback is captured as `FeedbackSignal` records

## Touch 2: Intro Deck

File: `apps/agent/src/mastra/workflows/touch-2-workflow.ts`

Inputs:

- deal ID
- company and industry
- optional salesperson and customer identity fields
- optional context
- optional prior touch outputs

Stages:

### 1. Skeleton

The system resolves a generation strategy, prefers a structure-driven blueprint, selects slides, and explains selection rationale section by section.

### 2. Low-fi

The system creates a draft slide order and per-slide notes.

### 3. Final deck generation

The system assembles the Google Slides deck, stores outputs, and can ingest the generated deck back into the library.

Seller-facing value:

- creates a customer-relevant intro deck using examples and templates already in the system
- allows review before full assembly
- exposes generation logs for polling in the UI

## Touch 3: Capability-alignment Deck

File: `apps/agent/src/mastra/workflows/touch-3-workflow.ts`

Inputs:

- deal ID
- company and industry
- one or more capability areas
- optional context and prior touch outputs

Stages mirror Touch 2:

- skeleton: capability-oriented slide selection
- low-fi: slide ordering and note generation
- final deck generation: assembled deck without a separate final approval suspend step

Key distinction:

- capability areas materially shape selection rationale and personalization notes

## Touch 4: Transcript-to-proposal Package

File: `apps/agent/src/mastra/workflows/touch-4-workflow.ts`

This is the most complex workflow in the system.

Inputs:

- deal ID
- company name
- industry and subsector
- transcript text
- optional seller notes

### Phase 1: Transcript extraction

The `transcript-extractor` agent parses six structured fields:

- customer context
- business outcomes
- constraints
- stakeholders
- timeline
- budget

The workflow then validates these fields and assigns severity levels.

### Phase 2: Seller field review

The workflow suspends for seller review. Hard requirements must be corrected before moving on.

### Phase 3: Brief generation

The system:

- maps the deal to primary and secondary Lumenalta solution pillars
- synthesizes a structured sales brief
- enriches use cases with ROI framing
- persists `Transcript` and `Brief` records

### Phase 4: Brief approval

The workflow suspends again for a seller approval gate. Approval state is stored on the `Brief`.

### Phase 5: Retrieval and assembly

After approval, the system:

- retrieves relevant content from AtlusAI
- filters and selects candidate slides
- generates customer-specific slide copy
- assembles a proposal deck in Google Slides
- creates a talk track in Google Docs
- creates a buyer FAQ in Google Docs

### Phase 6: Asset review

The system runs brand-compliance checks, suspends for final review, and only then finalizes delivery.

Outputs:

- proposal deck
- talk track
- buyer FAQ
- feedback and approval records

## Deal Chat

Deal chat is available throughout the deal workspace.

Capabilities:

- answer questions about current deal state
- suggest context-aware next actions based on page location
- accept transcript uploads
- capture notes and bind them to a deal or interaction
- persist all chat history by deal

Important files:

- `apps/agent/src/deal-chat/assistant.ts`
- `apps/agent/src/deal-chat/persistence.ts`
- `apps/web/src/app/api/deals/[dealId]/chat/route.ts`

## Template Library And Ingestion

Seller/admin workflows supported today:

- add a Google Slides presentation as a source template
- validate Drive accessibility
- classify it as `template` or `example`
- attach touch types and, for touch 4 examples, artifact type
- trigger ingestion
- monitor ingestion progress
- re-check staleness

Outputs of ingestion:

- `Template` records with access and ingestion state
- `SlideEmbedding` records with metadata and vector embeddings
- `SlideElement` records with extracted layout structure

## Slide Library

The slide library aggregates ingested slides across templates.

Capabilities:

- browse all ingested slides
- view thumbnails
- inspect extracted slide elements
- update classifications
- run similar-slide search against embeddings

## Discovery And AtlusAI

The discovery page depends on valid AtlusAI access.

Capabilities:

- browse discovered documents
- search discovery results
- ingest discovered assets into the template library
- surface AtlusAI connection problems in the UI

## Deck Structures And Agent Settings

### Deck structures

The settings area exposes inferred deck structures for touch types and touch-4 artifact types.

Capabilities:

- inspect inferred sections and confidence
- trigger manual inference
- chat to refine the structure
- delete chat memory or individual messages

### Agents

The settings area also exposes prompt management.

Capabilities:

- list named agents
- inspect versions
- save draft prompts
- publish prompts
- discard drafts
- roll back to prior versions
- manage a shared baseline prompt used across agents

## Action Center

The action center tracks integration issues that require follow-up.

Examples in code:

- Google re-auth needed
- share template with service account
- Atlus account required
- AtlusAI reconnection or account access required
