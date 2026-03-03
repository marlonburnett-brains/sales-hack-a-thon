# Phase 4: Touch 1-3 Asset Generation & Interaction Tracking - Research

**Researched:** 2026-03-03
**Domain:** Full-stack asset generation (Next.js App Router + Mastra workflows + Google Slides API + Prisma SQLite + AtlusAI RAG)
**Confidence:** HIGH

## Summary

Phase 4 is the first feature-facing phase: it delivers three seller-facing GTM asset generation flows (Touch 1 first-contact pager, Touch 2 Meet Lumenalta intro deck, Touch 3 capability alignment deck), a unified deal management UI, interaction tracking infrastructure, and a knowledge base growth pipeline. This phase touches every layer of the stack simultaneously -- Next.js web UI, Mastra agent workflows, Google Slides API deck assembly, Prisma data models, and AtlusAI ingestion/retrieval.

The existing codebase provides strong foundations: validated Zod schemas for all three touch types (PagerContentLlmSchema, IntroDeckSelectionLlmSchema, CapabilityDeckSelectionLlmSchema), Google auth factories, a slide extractor, an AtlusAI ingestion client, and a proven Slides API batchUpdate spike. The web app is currently a placeholder (single page.tsx) with no components, no routing, and no shadcn/ui -- all UI infrastructure must be built from scratch. The Prisma schema has WorkflowJob and ImageAsset models but no Company, Deal, InteractionRecord, or FeedbackSignal models yet.

The critical architectural insight is the **template merge pattern** for Google Slides: copy a branded template via Drive API, then use batchUpdate with replaceAllText/replaceAllShapesWithImage/insertText to customize it. For Touch 2/3 where slides must be selected from multiple source presentations, the approach is: copy the branded template, then for each selected slide, read it from the source presentation and recreate it in the target via batchUpdate requests. The DuplicateObjectRequest only works within a single presentation, so cross-presentation assembly requires the template-copy-and-customize pattern applied per source deck.

**Primary recommendation:** Build in three waves: (1) Prisma models + deal page UI + Touch 1 end-to-end, (2) shared slide assembly engine + AtlusAI retrieval/ingestion, (3) Touch 2 and Touch 3 flows using the shared engine. This ordering validates the full vertical slice first, then extracts the reusable module, then applies it twice.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Unified deal page: seller enters company name, industry, salesperson name/photo, and customer logo once -- shared across all touch types
- Deal page shows three touch flow cards (Touch 1, 2, 3) with availability status
- After generation, results shown with embedded Google Slides iframe preview + direct Drive link
- Deal page includes a full asset timeline showing all prior generated assets for that company across all touch types
- Top-level deals dashboard page listing all companies/deals with industry, touch progress indicators, and last activity -- clicking opens the unified deal page
- Two-step Touch 1 flow: AI generates pager content (headline, value proposition, key capabilities), seller reviews as a summary card FIRST, approves text, THEN Google Slides deck is assembled from approved content
- Two override paths: (1) edit AI-generated text fields directly in the web app, then generate deck from revised content; (2) upload a completely custom Google Slides file to replace the AI version entirely
- Both text edit diffs and the final generated/uploaded deck are captured: edited fields stored as feedback signals (what the seller changed), final deck ingested into AtlusAI
- Approved (unmodified) AI pagers are ALSO ingested into AtlusAI as positive examples
- AI generates directly end-to-end for Touch 2/3: AI selects slides and assembles the final deck without an intermediate slide review step
- Seller reviews the final generated deck via embedded iframe preview on the deal page
- Revision paths: seller can regenerate with tweaked inputs (different capability areas, additional context) creating a new version, OR click the Drive link to edit directly in Google Slides
- Each regeneration creates a new version; old versions remain in Drive
- Shared slide assembly pipeline: one reusable module handles Touch 2, Touch 3, and later Phase 8
- Company + Deal as separate entities: a Company has many Deals, each deal has a name/context and tracks its own interactions
- Cross-touch context: form pre-fills from deal record AND AI slide selection receives prior touch outputs as context
- Full detail timeline on deal page: each entry shows touch type, timestamp, status, what was generated, what was changed, Drive link -- expandable for feedback signals

### Claude's Discretion
- Salesperson photo/logo application approach (template placeholders vs dedicated title slide)
- Per-deal Drive folder naming convention and structure
- Mastra workflow design for each touch flow (step composition, error handling)
- Prisma model exact field definitions for Company, Deal, InteractionRecord, FeedbackSignal
- Loading states and progress indicators during generation
- shadcn/ui component selection for forms, cards, timeline

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TOUCH1-01 | Seller can select first-contact flow, input company name, industry, key context to generate 1-2 pager | Deal page UI with Touch 1 flow card, form inputs, Mastra workflow trigger |
| TOUCH1-02 | System suggests branded 1-2 slide Google Slides pager; seller can approve or override | Two-step flow: Gemini PagerContentLlmSchema -> summary card review -> template merge batchUpdate |
| TOUCH1-03 | Generated/overridden pager saved to per-deal folder in shared Lumenalta Drive | Drive API folder creation + files.copy + supportsAllDrives pattern |
| TOUCH1-04 | Approved = positive signal; overridden = learning signal + AtlusAI ingestion | InteractionRecord + FeedbackSignal Prisma models, atlusai-client.ts ingestDocument |
| TOUCH1-05 | Seller can upload custom Google Slides pager as override | File upload to Drive API, interaction record with "overridden" decision |
| TOUCH2-01 | Seller inputs company name, industry, salesperson name/photo, customer logo | Unified deal page form with shared inputs |
| TOUCH2-02 | System AI-selects relevant Meet Lumenalta slides based on industry/context | AtlusAI semantic search with touch_type + industry filters, IntroDeckSelectionLlmSchema |
| TOUCH2-03 | System assembles selected slides with salesperson/customer customizations | Shared slide assembly engine: template copy + replaceAllText + image injection |
| TOUCH2-04 | Generated intro deck saved to per-deal folder | Same Drive folder pattern as TOUCH1-03 |
| TOUCH3-01 | Seller inputs company name, industry, 1-2 capability areas | Form with capability area selector, CapabilityDeckSelectionLlmSchema |
| TOUCH3-02 | System AI-selects slides from AtlusAI + L2 capability decks | AtlusAI search with capability_area + industry filters |
| TOUCH3-03 | System assembles selected slides with customizations | Shared assembly engine reuse |
| TOUCH3-04 | Generated capability deck saved to per-deal folder | Same Drive folder pattern |
| DATA-01 | Every interaction persists complete record: inputs, decisions, output refs, timestamps | InteractionRecord Prisma model with JSON fields for inputs/outputRefs |
| DATA-03 | Approved = positive examples; overrides/edits = improvement signals | FeedbackSignal Prisma model with signalType enum |
| DATA-04 | Overrides ingested into AtlusAI to improve future generation | atlusai-client.ts ingestDocument for approved/overridden decks |
| DATA-05 | Interaction history for company/deal retrievable for cross-touch context | Company -> Deal -> InteractionRecord relations, Prisma query with include |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | ^15.5.12 | Web app (App Router, Server Components, Server Actions) | Already installed in apps/web |
| Mastra | @mastra/core ^1.8.0 | Workflow orchestration, HTTP API server | Already configured with LibSQLStore |
| Prisma | ^6.3.1 | SQLite ORM for Company, Deal, InteractionRecord, FeedbackSignal | Already configured, schema.prisma exists |
| googleapis | ^144.0.0 | Google Slides API + Drive API v3 | Already installed, auth factories exist |
| @google/genai | ^1.43.0 | Gemini 2.5 Flash for content generation and slide selection | Already installed |
| zod | ^4.3.6 | Schema validation (shared @lumenalta/schemas package) | Already in use across monorepo |
| shadcn/ui | latest | UI component library (Card, Button, Form, Input, Tabs, Dialog, Skeleton, Badge, Separator) | Established project pattern (shadcn stack in skills); needs init |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @t3-oss/env-nextjs | ^0.13.10 | Environment variable validation for web app | Already installed in apps/web |
| @t3-oss/env-core | ^0.13.10 | Environment variable validation for agent | Already installed in apps/agent |
| tailwindcss | ^3.4.17 | Utility-first CSS (already installed in apps/web) | All styling |
| lucide-react | latest | Icon library for shadcn/ui | UI icons (no emojis per skill guidelines) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn/ui | Raw Tailwind components | shadcn/ui provides consistent, accessible primitives with zero runtime cost -- no reason to hand-roll |
| Server Actions | API Route Handlers | Server Actions are simpler for form mutations; Route Handlers needed only for webhooks/external calls (Mastra handles its own HTTP) |
| Prisma SQLite | Mastra's LibSQLStore | Mastra store is internal state only; app data must be in Prisma per established two-database pattern |

**Installation (new dependencies):**
```bash
# Initialize shadcn/ui in the web app
cd apps/web && pnpm dlx shadcn@latest init

# Add required components
pnpm dlx shadcn@latest add button card input label select tabs dialog skeleton badge separator textarea form

# Add icon library
pnpm add lucide-react
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/
  app/
    layout.tsx                    # Root layout with shadcn/ui theme
    page.tsx                      # Redirect to /deals
    deals/
      page.tsx                    # Deals dashboard (list all companies/deals)
      [dealId]/
        page.tsx                  # Unified deal page (touch cards, timeline, forms)
    api/                          # Route handlers (if needed for file uploads)
  components/
    ui/                           # shadcn/ui primitives (auto-generated)
    deals/
      deal-card.tsx               # Deal card for dashboard list
      deal-dashboard.tsx          # Dashboard page component
    touch/
      touch-flow-card.tsx         # Touch 1/2/3 flow selector card
      touch-1-form.tsx            # Touch 1 input form + review card
      touch-2-form.tsx            # Touch 2 input form
      touch-3-form.tsx            # Touch 3 input form
      generation-progress.tsx     # Loading/progress indicator
      deck-preview.tsx            # Google Slides iframe embed
    timeline/
      interaction-timeline.tsx    # Full asset timeline component
      timeline-entry.tsx          # Individual timeline entry (expandable)
  lib/
    api-client.ts                 # Typed fetch wrapper for Mastra agent API
    actions/
      deal-actions.ts             # Server Actions for deal CRUD
      touch-actions.ts            # Server Actions that proxy to Mastra workflows

apps/agent/src/
  mastra/
    index.ts                      # Mastra instance (add workflows here)
    workflows/
      touch-1-workflow.ts         # Touch 1 pager generation workflow
      touch-2-workflow.ts         # Touch 2 intro deck workflow
      touch-3-workflow.ts         # Touch 3 capability deck workflow
  lib/
    google-auth.ts                # Existing auth factories
    slide-extractor.ts            # Existing slide text extraction
    atlusai-client.ts             # Existing AtlusAI ingestion
    slide-assembly.ts             # NEW: Shared slide assembly engine
    drive-folders.ts              # NEW: Per-deal Drive folder management
    deck-customizer.ts            # NEW: replaceAllText, image injection
  prisma/
    schema.prisma                 # Add Company, Deal, InteractionRecord, FeedbackSignal
```

### Pattern 1: Web -> Agent Communication
**What:** Next.js Server Actions call Mastra agent HTTP endpoints
**When to use:** All form submissions that trigger asset generation
**Example:**
```typescript
// apps/web/src/lib/actions/touch-actions.ts
'use server'

import { env } from '@/env'

export async function generateTouch1Pager(dealId: string, formData: FormData) {
  const response = await fetch(`${env.AGENT_SERVICE_URL}/api/workflows/touch-1-workflow/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputData: {
        dealId,
        companyName: formData.get('companyName'),
        industry: formData.get('industry'),
        context: formData.get('context'),
      },
    }),
  })
  return response.json()
}
```
**Source:** Mastra auto-exposes workflow routes at `/api/workflows/{workflowId}/start`

### Pattern 2: Mastra Workflow Step Composition
**What:** Workflows composed of createStep calls chained with .then()
**When to use:** Each touch flow is a workflow with typed steps
**Example:**
```typescript
// apps/agent/src/mastra/workflows/touch-1-workflow.ts
import { createWorkflow, createStep } from '@mastra/core/workflows'
import { z } from 'zod'

const generateContent = createStep({
  id: 'generate-pager-content',
  inputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    context: z.string(),
  }),
  outputSchema: PagerContentLlmSchema,
  execute: async ({ inputData }) => {
    // Call Gemini with PagerContentLlmSchema
    // Return structured pager content for review
  },
})

const awaitApproval = createStep({
  id: 'await-seller-approval',
  inputSchema: PagerContentLlmSchema,
  resumeSchema: z.object({
    decision: z.enum(['approved', 'edited']),
    editedContent: PagerContentLlmSchema.optional(),
  }),
  suspendSchema: z.object({
    reason: z.string(),
    generatedContent: PagerContentLlmSchema,
  }),
  outputSchema: z.object({
    finalContent: PagerContentLlmSchema,
    decision: z.enum(['approved', 'edited']),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return await suspend({
        reason: 'Seller review required',
        generatedContent: inputData,
      })
    }
    return {
      finalContent: resumeData.editedContent ?? inputData,
      decision: resumeData.decision,
    }
  },
})

export const touch1Workflow = createWorkflow({
  id: 'touch-1-workflow',
  inputSchema: z.object({ /* ... */ }),
  outputSchema: z.object({ /* ... */ }),
})
  .then(generateContent)
  .then(awaitApproval)
  .then(assembleDeck)
  .then(saveToDrive)
  .then(recordInteraction)
  .commit()
```
**Source:** [Mastra Workflows Overview](https://mastra.ai/docs/workflows/overview), [Suspend & Resume](https://mastra.ai/docs/workflows/suspend-and-resume)

### Pattern 3: Google Slides Template Merge
**What:** Copy branded template via Drive API, customize with batchUpdate
**When to use:** All deck generation (Touch 1, 2, 3, and Phase 8)
**Example:**
```typescript
// apps/agent/src/lib/slide-assembly.ts
import { getDriveClient, getSlidesClient } from './google-auth'

export async function assembleFromTemplate(params: {
  templateId: string
  targetFolderId: string
  deckName: string
  textReplacements: Record<string, string>
  imageReplacements?: Record<string, string>
}): Promise<{ presentationId: string; driveUrl: string }> {
  const drive = getDriveClient()
  const slides = getSlidesClient()

  // Step 1: Copy template to per-deal folder
  const copy = await drive.files.copy({
    fileId: params.templateId,
    requestBody: {
      name: params.deckName,
      parents: [params.targetFolderId],
    },
    supportsAllDrives: true,
  })
  const presentationId = copy.data.id!

  // Step 2: Build batchUpdate requests
  const requests: slides_v1.Schema$Request[] = []

  // Text replacements (e.g., {{company-name}} -> "Acme Corp")
  for (const [tag, value] of Object.entries(params.textReplacements)) {
    requests.push({
      replaceAllText: {
        containsText: { text: tag, matchCase: true },
        replaceText: value,
      },
    })
  }

  // Image replacements (e.g., {{company-logo}} -> image URL)
  if (params.imageReplacements) {
    for (const [tag, imageUrl] of Object.entries(params.imageReplacements)) {
      requests.push({
        replaceAllShapesWithImage: {
          imageUrl,
          imageReplaceMethod: 'CENTER_INSIDE',
          containsText: { text: tag, matchCase: true },
        },
      })
    }
  }

  // Step 3: Execute batch update
  if (requests.length > 0) {
    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests },
    })
  }

  return {
    presentationId,
    driveUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
  }
}
```
**Source:** [Google Slides Merge Guide](https://developers.google.com/slides/api/guides/merge)

### Pattern 4: Google Slides Iframe Preview
**What:** Embed generated presentations in the web app using the /preview URL
**When to use:** After deck generation, display preview on deal page
**Example:**
```typescript
// apps/web/src/components/touch/deck-preview.tsx
'use client'

interface DeckPreviewProps {
  presentationId: string
}

export function DeckPreview({ presentationId }: DeckPreviewProps) {
  // /preview works with "anyone with the link" sharing -- no formal publishing needed
  const previewUrl = `https://docs.google.com/presentation/d/${presentationId}/preview`

  return (
    <div className="aspect-[16/9] w-full rounded-lg overflow-hidden border">
      <iframe
        src={previewUrl}
        className="w-full h-full"
        allowFullScreen
        title="Generated deck preview"
      />
    </div>
  )
}
```
**Note:** The service account must set sharing to "anyone with the link can view" on generated presentations for iframe preview to work. Use Drive API permissions.create with role: 'reader' and type: 'anyone'.

### Pattern 5: Per-Deal Drive Folder Management
**What:** Create a named subfolder per deal in the shared Lumenalta Drive folder
**When to use:** First asset generation for any deal
**Example:**
```typescript
// apps/agent/src/lib/drive-folders.ts
export async function getOrCreateDealFolder(params: {
  companyName: string
  dealName: string
  parentFolderId: string
}): Promise<string> {
  const drive = getDriveClient()
  const folderName = `${params.companyName} - ${params.dealName}`

  // Check if folder exists
  const existing = await drive.files.list({
    q: `'${params.parentFolderId}' in parents and name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })

  if (existing.data.files?.length) {
    return existing.data.files[0].id!
  }

  // Create folder
  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [params.parentFolderId],
    },
    fields: 'id',
    supportsAllDrives: true,
  })

  return created.data.id!
}
```

### Anti-Patterns to Avoid
- **Hardcoding Google Slides objectIds:** ObjectIds are Google-generated (g35b593a0db0_0_XXXX format). Always read from presentations.get response. Phase 1 spike already validated this.
- **Using DuplicateObjectRequest across presentations:** It only works within the same presentation. For cross-presentation assembly, use the template merge pattern.
- **Missing supportsAllDrives: true:** Required on ALL Drive API calls targeting the shared Lumenalta Drive. Omitting causes silent failures.
- **Coupling touch-specific logic into the shared assembly engine:** The assembly engine should accept a generic "deck spec" (template ID, text replacements, image replacements, slide selection criteria). Touch-specific logic stays in the workflow.
- **Putting interaction tracking in the workflow steps:** Track interactions at the API/Server Action layer, not inside Mastra steps, so tracking happens even if the workflow fails partway through.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UI component primitives | Custom form inputs, buttons, cards | shadcn/ui + Tailwind | Accessible, consistent, zero runtime cost |
| Form validation | Custom validation logic | Zod schemas + react-hook-form (or native form validation) | Schemas already exist in @lumenalta/schemas |
| Deck template merge | Custom slide-by-slide JSON-to-Slides converter | Google Slides replaceAllText/replaceAllShapesWithImage | Google's merge pattern handles font, layout, positioning automatically |
| Workflow orchestration | Custom job queue with polling | Mastra workflow with suspend/resume | State persistence, restart recovery, typed steps built-in |
| AtlusAI document ingestion | Custom API client | Existing atlusai-client.ts ingestDocument() | Already proven in Phase 2; creates Google Docs in monitored folder |
| Slide text extraction | Custom DOM parser | Existing slide-extractor.ts extractSlidesFromPresentation() | Handles shapes, tables, groups, speaker notes recursively |
| Google auth | Custom token management | Existing google-auth.ts factories | Service account auth with correct scopes already configured |
| Drive folder management | Ad-hoc folder creation | Dedicated drive-folders.ts module with idempotent getOrCreate | Prevents duplicate folders, consistent naming |

**Key insight:** The existing codebase already has the hard parts solved (Google auth, Slides API spike, AtlusAI ingestion, Zod schemas). Phase 4's challenge is composition and UI -- not infrastructure.

## Common Pitfalls

### Pitfall 1: Google Slides Image Insertion Requires Publicly Accessible URLs
**What goes wrong:** replaceAllShapesWithImage fails with "problem retrieving the image" when the image URL is a private Drive file
**Why it happens:** The Slides API fetches images via HTTP, even when the service account has Drive access. Private files are not accessible via their standard Drive URL.
**How to avoid:** Either (a) make images viewable by "anyone with the link" using Drive permissions.create, or (b) use the workaround of constructing an authenticated URL: `https://www.googleapis.com/drive/v3/files/{fileId}?alt=media&access_token={token}`. For headshots/logos from ImageAsset registry, set sharing at ingestion time.
**Warning signs:** 400 errors from batchUpdate with "problem retrieving the image" message

### Pitfall 2: Cross-Presentation Slide Copy Is Not Supported
**What goes wrong:** Attempting to use DuplicateObjectRequest with a slide from a different presentation fails
**Why it happens:** DuplicateObjectRequest only works within the same presentation. The Google Slides API has no native "import slides from another deck" method.
**How to avoid:** For Touch 2/3 slide assembly: (1) Copy the branded template as the base deck, (2) For each selected slide from source presentations, read its content via presentations.get, (3) Create new slides in the target and replicate content via insertText/createShape. Alternatively, use the simpler approach: copy the entire source deck, delete unneeded slides, then customize remaining ones.
**Warning signs:** Planning to use DuplicateObjectRequest across presentation IDs

### Pitfall 3: Mastra Workflow Suspend State Must Be Explicitly Stored
**What goes wrong:** Workflow suspends for seller approval, but the suspend payload (generated content for review) is lost on server restart
**Why it happens:** Mastra persists snapshots in LibSQLStore, but application-level state (what to show the seller) should also be in Prisma for the web app to query independently
**How to avoid:** When a workflow suspends, immediately write the generated content to a Prisma record (e.g., InteractionRecord with status "pending_review") so the web app can display it without querying Mastra's internal state. On resume, update the Prisma record.
**Warning signs:** Web app polls Mastra workflow status instead of having its own data source

### Pitfall 4: Iframe Preview Requires "Anyone with Link" Sharing
**What goes wrong:** Embedded Google Slides iframe shows "You need permission" or blank content
**Why it happens:** Service-account-created presentations default to private access. The /preview URL requires the viewer to have at least read access.
**How to avoid:** After creating/copying a presentation, immediately set sharing with Drive permissions.create: `{ role: 'reader', type: 'anyone' }`. This makes the /preview URL work for any viewer without authentication.
**Warning signs:** Blank iframes, 403 responses, "access denied" overlays in the embed

### Pitfall 5: Missing Template Tags Cause Silent No-Ops
**What goes wrong:** replaceAllText runs successfully but the deck still has placeholder text
**Why it happens:** The tag in the template (e.g., `{{company-name}}`) doesn't exactly match the tag in the API call (case-sensitive, whitespace-sensitive)
**How to avoid:** Define tag constants in a shared module. Use matchCase: true. After batchUpdate, verify replacements by reading the presentation back and checking for remaining `{{...}}` patterns. Log all replacement operations.
**Warning signs:** Generated decks with `{{placeholder}}` text visible

### Pitfall 6: File Upload for Touch 1 Override Needs Route Handler
**What goes wrong:** Attempting to upload a Google Slides file via Server Action fails or is unreliable
**Why it happens:** Server Actions handle FormData but large file uploads are better served by Route Handlers with streaming support. The uploaded file must be forwarded to the Drive API.
**How to avoid:** Use a Next.js Route Handler (app/api/upload/route.ts) for file upload that streams the file to the agent service, which then uploads to Drive. Or use a client-side direct-to-agent upload pattern.
**Warning signs:** Memory issues, timeout errors on large file uploads via Server Actions

## Code Examples

### Prisma Schema: Company, Deal, InteractionRecord, FeedbackSignal
```prisma
// Source: Prisma one-to-many relations documentation
// https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/one-to-many-relations

model Company {
  id        String   @id @default(cuid())
  name      String
  industry  String
  logoUrl   String?  // Drive URL or public URL for customer logo
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deals     Deal[]

  @@unique([name])
}

model Deal {
  id               String              @id @default(cuid())
  companyId        String
  company          Company             @relation(fields: [companyId], references: [id])
  name             String              // e.g., "Q1 2026 Enterprise Pitch"
  salespersonName  String?
  salespersonPhoto String?             // Drive file ID or URL
  driveFolderId    String?             // Per-deal folder in shared Drive
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt
  interactions     InteractionRecord[]

  @@index([companyId])
}

model InteractionRecord {
  id           String           @id @default(cuid())
  dealId       String
  deal         Deal             @relation(fields: [dealId], references: [id])
  touchType    String           // "touch_1" | "touch_2" | "touch_3" | "touch_4"
  status       String           @default("pending") // "pending" | "generating" | "pending_review" | "approved" | "overridden" | "edited"
  inputs       String           // JSON: company, industry, context, etc.
  decision     String?          // "approved" | "overridden" | "edited" | null (if pending)
  generatedContent String?      // JSON: AI-generated content for review (pager content, slide selection)
  outputRefs   String?          // JSON array: Drive URLs of generated assets
  driveFileId  String?          // Primary generated presentation ID
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt
  feedbackSignals FeedbackSignal[]

  @@index([dealId])
  @@index([touchType])
}

model FeedbackSignal {
  id              String            @id @default(cuid())
  interactionId   String
  interaction     InteractionRecord @relation(fields: [interactionId], references: [id])
  signalType      String            // "positive" | "negative" | "override"
  source          String            // "touch_1_approve" | "touch_1_edit" | "touch_1_upload" etc.
  content         String            // JSON: diff data, original vs edited fields, etc.
  createdAt       DateTime          @default(now())

  @@index([interactionId])
  @@index([signalType])
}
```

### Mastra Workflow Registration
```typescript
// apps/agent/src/mastra/index.ts
import { Mastra } from '@mastra/core'
import { LibSQLStore } from '@mastra/libsql'
import { touch1Workflow } from './workflows/touch-1-workflow'
import { touch2Workflow } from './workflows/touch-2-workflow'
import { touch3Workflow } from './workflows/touch-3-workflow'
import { env } from '../env'

export const mastra = new Mastra({
  storage: new LibSQLStore({
    url: 'file:./prisma/mastra.db',
  }),
  workflows: {
    'touch-1-workflow': touch1Workflow,
    'touch-2-workflow': touch2Workflow,
    'touch-3-workflow': touch3Workflow,
  },
  server: {
    port: parseInt(env.MASTRA_PORT, 10),
  },
})
```
**Source:** [Mastra Workflows Overview](https://mastra.ai/docs/workflows/overview)

### AtlusAI Semantic Search for Slide Selection (Touch 2/3)
```typescript
// This runs within a Mastra workflow step that has access to MCP tools
// AtlusAI MCP tools are read-only; invoked via Claude Code's MCP connection
// In production workflow: use @mastra/mcp to call knowledge_base_search_semantic

// The workflow step constructs a search query from deal context:
const searchQuery = `Meet Lumenalta intro slides for ${industry} industry`
// Or for Touch 3:
const searchQuery = `${capabilityArea} capability slides for ${industry}`

// AtlusAI returns matching slide documents with:
// - documentId (SHA-256 of presentationId:slideObjectId)
// - textContent, speakerNotes
// - Metadata: industries, funnelStages, touchType, slideCategory
```

### Google Slides Sharing for Iframe Preview
```typescript
// After creating/copying a presentation, make it viewable
async function makePubliclyViewable(fileId: string): Promise<void> {
  const drive = getDriveClient()
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
    supportsAllDrives: true,
  })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom REST job queue | Mastra workflow suspend/resume with LibSQLStore | Mastra 1.x (2025) | Durable workflow state built-in; no custom polling needed |
| Next.js API Routes for mutations | Next.js Server Actions with 'use server' | Next.js 14+ (2024) | Simpler form handling, automatic revalidation |
| Custom component library | shadcn/ui (copy-paste, zero runtime) | 2023+ | Accessible primitives, Tailwind-native, no bundle bloat |
| Google Slides manual objectId tracking | Template merge with replaceAllText tags | Google best practice | Tags survive template edits; no fragile objectId coupling |
| Separate upload/edit endpoints | Mastra auto-generated workflow routes | Mastra dev server | /api/workflows/{id}/start, /api/workflows/{id}/resume auto-exposed |

**Deprecated/outdated:**
- Mastra's legacy workflow syntax (pre-`.then()` chaining) -- use current createWorkflow/createStep pattern
- Google Slides API v2 -- Drive API v3 is used exclusively (v2 is legacy)
- `zod-to-json-schema` package -- replaced by native `z.toJSONSchema()` in Zod v4

## Open Questions

1. **AtlusAI MCP Tool Authentication in Mastra Workflows**
   - What we know: AtlusAI MCP tools (knowledge_base_search_semantic, knowledge_base_search_structured) work through Claude Code's internal MCP connection. The SSE endpoint requires auth managed by Claude Code.
   - What's unclear: How to invoke these MCP tools from within a Mastra workflow step that runs as a standalone Node.js process (not through Claude Code). The @mastra/mcp package may bridge this gap.
   - Recommendation: Research @mastra/mcp integration with AtlusAI SSE endpoint. If direct MCP is not feasible from Mastra, the alternative is to use Gemini with AtlusAI content that was already ingested (slide text content is in the Google Docs ingestion folder and can be queried via Drive API search).

2. **Salesperson Photo/Logo Injection into Slides**
   - What we know: replaceAllShapesWithImage can swap tagged shapes with images. The image must be publicly accessible.
   - What's unclear: Whether the existing Meet Lumenalta template has `{{salesperson-photo}}` and `{{company-logo}}` placeholder shapes, or if these need to be added manually to the template.
   - Recommendation: Inspect the actual template structure via presentations.get before designing the customization approach. If no placeholders exist, add a dedicated title/intro slide with tagged shapes.

3. **Cross-Presentation Slide Assembly Strategy for Touch 2/3**
   - What we know: Google Slides API cannot copy individual slides between presentations. DuplicateObjectRequest is intra-presentation only.
   - What's unclear: Best approach for assembling a deck from slides sourced from multiple presentations.
   - Recommendation: Use the **"copy entire source, delete unwanted"** pattern: (1) Copy the source presentation (e.g., Meet Lumenalta deck) to the deal folder, (2) Delete slides not selected by the AI, (3) Apply customizations to remaining slides. This preserves original formatting perfectly. For multi-source assembly (Touch 3 with AtlusAI + L2 decks), start with the primary template and manually recreate needed slides from secondary sources using insertText/createShape.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual verification (no automated test framework configured) |
| Config file | none -- see Wave 0 |
| Quick run command | `pnpm --filter agent validate-schemas` (existing LLM schema validation) |
| Full suite command | N/A -- no test runner configured |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOUCH1-01 | Seller inputs company/industry, gets pager | smoke | Manual: submit form, verify deck in Drive | N/A |
| TOUCH1-02 | AI suggests pager, seller approves/overrides | smoke | Manual: review summary card, approve, verify deck | N/A |
| TOUCH1-03 | Pager saved to per-deal Drive folder | smoke | Manual: check Drive folder after generation | N/A |
| TOUCH1-04 | Approved = positive signal, override = learning signal | smoke | Manual: approve and override, check Prisma records | N/A |
| TOUCH1-05 | Upload custom pager as override | smoke | Manual: upload file, verify in Drive | N/A |
| TOUCH2-01 | Input company/industry/salesperson/logo | smoke | Manual: fill form, submit | N/A |
| TOUCH2-02 | AI selects Meet Lumenalta slides | smoke | Manual: verify selected slides match industry | N/A |
| TOUCH2-03 | Assembled deck with customizations | smoke | Manual: verify name/photo/logo in generated deck | N/A |
| TOUCH2-04 | Saved to per-deal Drive folder | smoke | Manual: check Drive folder | N/A |
| TOUCH3-01-04 | Touch 3 flow end-to-end | smoke | Manual: similar to Touch 2 | N/A |
| DATA-01 | Interaction records persisted | smoke | Manual: query Prisma after each flow | N/A |
| DATA-03 | Feedback signals recorded | smoke | Manual: check FeedbackSignal table | N/A |
| DATA-04 | Overrides ingested into AtlusAI | smoke | Manual: check Drive ingestion folder | N/A |
| DATA-05 | Interaction history retrievable | smoke | Manual: verify timeline on deal page | N/A |

### Sampling Rate
- **Per task commit:** Visual verification of UI + Prisma query for data records
- **Per wave merge:** Full Touch 1 flow end-to-end, then full Touch 2/3 flow
- **Phase gate:** All three touch flows generate decks successfully; interaction records visible in timeline

### Wave 0 Gaps
- [ ] shadcn/ui initialization in apps/web (no components.json exists)
- [ ] Prisma migration for Company, Deal, InteractionRecord, FeedbackSignal models
- [ ] No automated test framework -- this phase relies on manual smoke testing (hackathon context)

## Sources

### Primary (HIGH confidence)
- [Mastra Workflows Overview](https://mastra.ai/docs/workflows/overview) - Workflow definition, step composition, execution modes
- [Mastra Suspend & Resume](https://mastra.ai/docs/workflows/suspend-and-resume) - HITL patterns, suspend/resume API, state persistence
- [Mastra HITL Patterns](https://mastra.ai/docs/workflows/human-in-the-loop) - Approval patterns, bail(), multi-stage approvals
- [Mastra Custom API Routes](https://mastra.ai/docs/server/custom-api-routes) - registerApiRoute, Hono context, middleware
- [Mastra Client SDK Workflows](https://mastra.ai/reference/client-js/workflows) - startAsync, resume, runById, stream
- [Google Slides Merge Guide](https://developers.google.com/slides/api/guides/merge) - Template copy + replaceAllText pattern
- [Google Slides Write Samples](https://developers.google.com/slides/api/samples/writing) - insertText, deleteText, createShape, createImage
- [Google Slides Operations](https://developers.google.com/workspace/slides/api/samples/slides) - createSlide, duplicateObject, updateSlidesPosition
- [Prisma One-to-Many Relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/one-to-many-relations) - Relation modeling for Company->Deal->Interaction
- [shadcn/ui Next.js Installation](https://ui.shadcn.com/docs/installation/next) - Setup commands, component installation

### Secondary (MEDIUM confidence)
- [Google Slides Codelab (Node.js)](https://codelabs.developers.google.com/codelabs/slides-api) - End-to-end Node.js patterns
- [Google Document URL Tricks](https://learninginhand.com/blog/google-document-url-tricks) - /preview vs /embed URL patterns
- Existing codebase: apps/agent/src/spike/slides-spike.ts (validated batchUpdate pattern)
- Existing codebase: apps/agent/src/lib/atlusai-client.ts (Drive-based ingestion strategy)

### Tertiary (LOW confidence)
- Cross-presentation slide assembly strategy (no official Google documentation; derived from API limitations and community patterns)
- AtlusAI MCP tool invocation from Mastra workflows (needs validation with @mastra/mcp package)
- Image URL accessibility requirements for replaceAllShapesWithImage (GitHub issues suggest public access required)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and configured in monorepo; shadcn/ui is the only new addition
- Architecture: HIGH - Patterns verified against official Mastra and Google docs; template merge pattern confirmed by Google's own guide
- Pitfalls: HIGH - Image accessibility, cross-presentation copy limitation, and iframe sharing verified from multiple sources
- AtlusAI integration: MEDIUM - MCP tool invocation from Mastra workflows needs validation; Drive-based ingestion is proven
- Cross-presentation assembly: MEDIUM - No native API support; workaround strategies are well-documented but complex

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable technologies; Mastra moves fast so check for workflow API changes)
