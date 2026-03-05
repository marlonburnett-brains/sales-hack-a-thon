# Phase 11: End-to-End Integration and Demo Polish - Research

**Researched:** 2026-03-04
**Domain:** Full-stack integration, progress UX, error handling, demo preparation
**Confidence:** HIGH

## Summary

Phase 11 is a pure integration and polish phase -- no new features, no new pipeline logic. The work breaks into four clear domains: (1) adding step-by-step progress indicators to all five flows (Touch 1-4 + pre-call), (2) installing a toast library and hardening error handling to surface failures clearly, (3) wiring any remaining end-to-end gaps discovered during validation runs, and (4) preparing a demo scenario with seed data, a Financial Services transcript fixture, and a rehearsed walkthrough.

The existing codebase is well-structured for this work. All five Mastra workflows are functional with named steps. The Mastra workflow run status API already returns per-step status objects (`status.steps["step-id"].status`), which means the polling loops already present in every form component can derive progress by checking which steps have completed. The `GenerationProgress` component currently shows a static spinner with a text message -- replacing it with a multi-step stepper derived from the existing `WorkflowStepper` pattern is the core UI task.

**Primary recommendation:** Use Mastra's existing workflow run status API (per-step status returned on each poll) to drive step-by-step progress indicators -- no new backend endpoints or SSE/WebSocket infrastructure needed. Install `sonner` via shadcn/ui for toast notifications. Create a Prisma seed script with a Financial Services company/deal pre-populated with Touch 1 history for the demo.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Step-by-step progress for ALL touch types, not just Touch 4
- Each flow shows named stages as they complete (e.g., Touch 2: "Selecting slides -> Assembling deck -> Saving to Drive")
- Touch 4 keeps its existing 5-stage WorkflowStepper (Transcript -> Brief -> Approved -> Assets -> Delivered) from Phase 9
- Touches 1-3 and pre-call get lighter steppers with 2-4 stages matching their pipeline steps
- Animated indicator on active step (spinning icon), checkmarks on completed steps -- no time estimates
- After completion, stepper stays visible showing all steps checked (demo visibility), then result panel appears below
- Toast notification + inline stepper error: toast pops for immediate attention, stepper shows the failed step with red marker and error message
- Toast library needed (sonner or similar) -- currently not installed
- Friendly + actionable error tone: "We couldn't generate the talk track. Try again, or contact support if this continues." -- warm, clear next step, no raw stack traces
- Partial failure handling: deliver successful artifacts with Drive links + warning about what failed + retry option for failed pieces -- seller gets value from what worked
- Retry restarts the whole flow (not per-step resume) -- simpler implementation, avoids stale state issues in Mastra workflows
- Pre-seeded Financial Services company/deal with some Touch 1 history already in DB -- shows cross-touch context flowing
- Demo walks through the natural sales journey: Pre-call -> Touch 1 -> Touch 2 -> Touch 3 -> Touch 4 -- demonstrates the complete seller workflow narrative
- Prepared realistic Financial Services transcript stored as a repo fixture -- default for demo, presenter can swap in their own
- Deep demo on Financial Services, quick Touch 1 or Touch 2 runs on 2 additional industries (e.g., Healthcare, Technology) to show breadth across the 11-industry taxonomy
- Demo-focused validation: validate the Financial Services demo scenario end-to-end across all touch types, fix issues found in that path
- Claude discovers integration gaps by running each flow end-to-end -- no pre-known broken flows assumed
- Interaction history verified during integration: explicitly test that records are captured for every flow and cross-touch context works
- Demo-ready visual polish: fix functional issues AND do a visual pass (consistent spacing, loading states, responsive layout) -- make it look polished for the hackathon audience

### Claude's Discretion
- Update mechanism for progress (polling vs SSE) -- pick what's simplest given existing patterns
- Exact step names and count per touch type stepper
- Toast library selection (sonner vs react-hot-toast vs similar)
- Demo seed script implementation details
- Which 2 additional industries to use for breadth demo
- Visual polish scope -- prioritize what the demo audience will actually see
- Smoke test approach for non-demo industries

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sonner | ^2.x | Toast notifications | shadcn/ui's official toast component; `npx shadcn@latest add sonner` installs it automatically with the project's new-york style |
| @mastra/core | 1.8.0 | Workflow status API | Already installed; provides per-step status on workflow run GET |
| prisma | 6.19.x | Seed script for demo data | Already installed; `prisma db seed` is the standard seeding mechanism |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.576.0 | Icons for stepper (CheckCircle, Loader2, AlertCircle, XCircle) | Already installed; all icons for stepper states |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sonner | react-hot-toast | sonner has first-class shadcn/ui integration, react-hot-toast does not; both are small (~3KB) |
| Polling for progress | SSE/WebSocket | Polling is already the established pattern across ALL five form components; SSE would require new Mastra server infrastructure; polling at 2s intervals is simple and adequate for demo |

**Installation:**
```bash
cd apps/web && pnpm dlx shadcn@latest add sonner
```

This adds `sonner` to `package.json` and creates `apps/web/src/components/ui/sonner.tsx`.

## Architecture Patterns

### Recommended Project Structure (Phase 11 additions)
```
apps/
  web/
    src/
      components/
        ui/
          sonner.tsx               # NEW: shadcn sonner wrapper
        touch/
          pipeline-stepper.tsx     # NEW: generalized multi-step progress component
          workflow-stepper.tsx     # KEEP: Touch 4 lifecycle stepper (unchanged)
          generation-progress.tsx  # REPLACE internals: swap spinner for PipelineStepper
          touch-{1,2,3}-form.tsx  # MODIFY: add stepper state, error toast calls
          touch-4-form.tsx        # MODIFY: add progress stepper during asset generation phase
        pre-call/
          pre-call-form.tsx       # MODIFY: add stepper state during generation
      app/
        layout.tsx                # MODIFY: add <Toaster /> provider
  agent/
    prisma/
      seed.ts                     # NEW: demo seed script
    fixtures/
      demo-transcript-financial-services.txt  # NEW: prepared transcript
```

### Pattern 1: PipelineStepper -- Generalized Progress Component
**What:** A reusable stepper component that accepts step definitions and derives current state from the Mastra workflow run status API's step-level data.
**When to use:** Every flow's "generating" state.
**Example:**
```typescript
// PipelineStepper receives steps config and active step derived from polling
interface PipelineStep {
  id: string;     // Mastra step ID to check in status.steps
  label: string;  // Human-readable label
}

interface PipelineStepperProps {
  steps: PipelineStep[];
  completedStepIds: string[];  // Step IDs with status "completed"
  activeStepId: string | null; // Currently running step
  errorStepId: string | null;  // Step that failed
  errorMessage: string | null; // Friendly error message
}

// Usage per touch type:
const TOUCH_2_STEPS: PipelineStep[] = [
  { id: "select-slides", label: "Selecting slides" },
  { id: "assemble-deck", label: "Assembling deck" },
  { id: "record-interaction", label: "Saving to Drive" },
];
```

### Pattern 2: Derive Progress from Existing Polling
**What:** The existing `pollStatus` functions in every form component already call the Mastra workflow GET endpoint every 2 seconds and receive `status.steps`. Extend these polling loops to extract which steps have completed, which is active, and whether any failed -- then pass this to PipelineStepper.
**When to use:** Every form component's polling loop.
**Example:**
```typescript
// Inside the polling loop (already exists in every form):
const status = await checkTouch2StatusAction(runId);
const steps = status.steps ?? {};

// Derive completed steps for PipelineStepper
const completedStepIds = Object.entries(steps)
  .filter(([, v]) => v.status === "completed")
  .map(([k]) => k);

// Find active step (first step that is "running" or "waiting")
const activeStepId = Object.entries(steps)
  .find(([, v]) => v.status === "running" || v.status === "waiting")
  ?.[0] ?? null;

// Update state for PipelineStepper rendering
setCompletedSteps(completedStepIds);
setActiveStep(activeStepId);
```

### Pattern 3: Toast + Inline Error (Belt and Suspenders)
**What:** On any pipeline error, fire a sonner toast for immediate attention AND update the stepper to show the failed step with a red marker. The toast auto-dismisses; the stepper error state persists until retry.
**When to use:** Every `catch` block in form submission handlers.
**Example:**
```typescript
import { toast } from "sonner";

// In error handler:
catch (err) {
  const message = err instanceof Error ? err.message : "Generation failed";
  const friendly = mapToFriendlyError(message);
  toast.error(friendly);
  setErrorStepId(activeStep);
  setErrorMessage(friendly);
  setState("error"); // or keep stepper visible with error state
}

function mapToFriendlyError(raw: string): string {
  if (raw.includes("timeout")) return "The generation took too long. Please try again.";
  if (raw.includes("Drive")) return "We couldn't save to Google Drive. Please try again.";
  if (raw.includes("Gemini") || raw.includes("API")) return "AI generation encountered an issue. Please try again.";
  return "Something went wrong. Please try again, or contact support if this continues.";
}
```

### Pattern 4: Demo Seed Script via Prisma
**What:** A TypeScript seed script that creates a Financial Services company, deal, and one completed Touch 1 interaction record. Runs via `npx prisma db seed` or a standalone script.
**When to use:** Before the demo, or during development to have pre-populated data.
**Example:**
```typescript
// apps/agent/prisma/seed.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Create Financial Services demo company
  const company = await prisma.company.upsert({
    where: { name: "Meridian Capital Group" },
    update: {},
    create: {
      name: "Meridian Capital Group",
      industry: "Financial Services",
    },
  });

  // Create demo deal
  const deal = await prisma.deal.create({
    data: {
      companyId: company.id,
      name: "Enterprise Digital Transformation - Q1 2026",
      salespersonName: "Alex Chen",
    },
  });

  // Pre-seed a Touch 1 interaction to show cross-touch context
  await prisma.interactionRecord.create({
    data: {
      dealId: deal.id,
      touchType: "touch_1",
      status: "approved",
      decision: "approved",
      inputs: JSON.stringify({
        companyName: "Meridian Capital Group",
        industry: "Financial Services",
        context: "Enterprise payment infrastructure modernization",
      }),
      generatedContent: JSON.stringify({
        headline: "Modernize Payment Infrastructure with Lumenalta",
        valueProposition: "Reduce transaction latency by 60% while maintaining regulatory compliance...",
      }),
      outputRefs: JSON.stringify(["https://docs.google.com/presentation/d/demo-touch1/edit"]),
    },
  });
}
```

### Anti-Patterns to Avoid
- **SSE/WebSocket for progress:** The existing polling pattern works across all five flows. Adding SSE would require Mastra server changes, CORS configuration, and new connection management on the client. Not worth it for a hackathon demo.
- **Per-step resume on retry:** The CONTEXT.md explicitly locks retry to restart the whole flow. Per-step resume would require tracking partial workflow state, which Mastra suspend/resume does not cleanly support for non-HITL steps.
- **Custom progress API endpoint:** The Mastra workflow run GET endpoint already returns step-level status. Adding a custom endpoint would duplicate existing functionality.
- **Modifying workflow step logic:** Phase 11 must NOT change pipeline logic. Progress indicators are derived from existing step status, not from adding status-reporting code to steps.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom alert banner system | `sonner` via shadcn/ui | Handles stacking, auto-dismiss, animations, accessibility, positioning; integrates with shadcn theme |
| Step progress tracking | Custom progress state machine | Mastra workflow run status API + simple derivation | Per-step status already returned by existing GET endpoint; derivation is 10 lines of code |
| Demo data seeding | Manual SQL inserts | Prisma seed script (`prisma db seed`) | Type-safe, reproducible, documented in package.json |
| Error message mapping | Raw error propagation | Centralized `mapToFriendlyError()` utility | Single place to maintain user-facing error messages; prevents raw stack traces |

**Key insight:** The Mastra workflow GET endpoint already returns step-by-step status. The entire progress indicator feature is a UI concern that reads data the backend already provides.

## Common Pitfalls

### Pitfall 1: Stepper Flicker During Polling
**What goes wrong:** When polling every 2 seconds, the stepper re-renders with each poll response. If state derivation is non-deterministic or steps briefly show different statuses, the stepper can flicker between states.
**Why it happens:** Mastra step statuses transition through intermediate states (waiting -> running -> completed). If a poll catches a step mid-transition, the derived active step may jump back and forth.
**How to avoid:** Use a monotonic progression model -- once a step is marked as completed in the client state, never un-complete it. Track completed steps in a Set that only grows, never shrinks.
**Warning signs:** Steps appearing to "uncomplete" during generation.

### Pitfall 2: Toast Provider Missing for Server Actions
**What goes wrong:** Toasts triggered from within Server Actions or their error handlers do not fire because `toast()` requires the `<Toaster />` component to be mounted in the React tree.
**Why it happens:** Server Actions run on the server; `toast()` is a client-side function. If the error is thrown in a Server Action, the client-side catch block must call `toast()`.
**How to avoid:** Always call `toast()` from client-side catch blocks in form components, never from Server Actions. Server Actions should throw errors; client components catch and toast.
**Warning signs:** Errors logged in server console but no toast appears in browser.

### Pitfall 3: Seed Script Colliding with Existing Data
**What goes wrong:** Running the seed script twice creates duplicate deals/interactions because `prisma.deal.create` does not upsert by default.
**Why it happens:** Company has `@@unique([name])` so upsert works, but Deal has no unique constraint beyond its auto-generated `id`.
**How to avoid:** Use `prisma.company.upsert` for the company, then check for existing deals by company name + deal name before creating. Or use a "reset seed" approach that deletes existing demo data first.
**Warning signs:** Multiple copies of "Meridian Capital Group" deals in the dashboard.

### Pitfall 4: Demo Transcript Too Long or Too Short
**What goes wrong:** A transcript that is too long causes Gemini context window concerns or slow processing. Too short and the extracted fields are empty, causing the field review to show nothing useful.
**Why it happens:** The transcript processing step expects substantive content across all six extraction fields (customerContext, businessOutcomes, constraints, stakeholders, timeline, budget).
**How to avoid:** Craft the fixture transcript to be 2000-4000 words with explicit mentions of all six fields. Include specific Financial Services terminology, named stakeholders, budget ranges, and timeline milestones.
**Warning signs:** Multiple "missing" severity markers in field review; empty or generic brief output.

### Pitfall 5: Drive API Rate Limits During Demo
**What goes wrong:** Running all five flows in rapid succession for the demo can hit Google Drive API rate limits (100 requests per 100 seconds per user for the service account).
**Why it happens:** Each flow makes 3-8 Drive API calls (folder creation, file creation, permission setting, file copying).
**How to avoid:** Run the demo with natural pauses between touch types (which the demo narrative provides). Pre-create the deal folder during seeding so later flows skip folder creation. Consider caching the `getOrCreateDealFolder` result on the deal record (already implemented via `driveFolderId`).
**Warning signs:** "Rate limit exceeded" errors during rapid-fire demo runs.

### Pitfall 6: Error Messages Leaking Raw Stack Traces
**What goes wrong:** Mastra workflow errors or Google API errors contain technical details (API keys in URLs, internal paths) that leak to the user through the error message.
**Why it happens:** The `fetchJSON` wrapper in `api-client.ts` throws `Agent API error (${status}): ${text}` which can contain the full error body from the Mastra server.
**How to avoid:** The `mapToFriendlyError()` function should be the ONLY path to user-visible error text. Never display `err.message` directly in the UI -- always map it through the friendly error function first.
**Warning signs:** Technical error messages visible in the browser (HTTP status codes, stack traces, file paths).

## Code Examples

### Example 1: PipelineStepper Component
```typescript
// apps/web/src/components/touch/pipeline-stepper.tsx
"use client";

import { Fragment } from "react";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

export interface PipelineStep {
  id: string;
  label: string;
}

interface PipelineStepperProps {
  steps: PipelineStep[];
  completedStepIds: Set<string>;
  activeStepId: string | null;
  errorStepId: string | null;
  errorMessage: string | null;
}

export function PipelineStepper({
  steps,
  completedStepIds,
  activeStepId,
  errorStepId,
  errorMessage,
}: PipelineStepperProps) {
  return (
    <div className="space-y-2 py-4" role="list" aria-label="Pipeline progress">
      {steps.map((step, index) => {
        const isCompleted = completedStepIds.has(step.id);
        const isActive = step.id === activeStepId;
        const isError = step.id === errorStepId;

        return (
          <div key={step.id} role="listitem" className="flex items-center gap-3">
            {/* Step icon */}
            <div className="flex h-6 w-6 shrink-0 items-center justify-center">
              {isError ? (
                <XCircle className="h-5 w-5 text-red-500" />
              ) : isCompleted ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : isActive ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              ) : (
                <div className="h-2.5 w-2.5 rounded-full bg-slate-200" />
              )}
            </div>

            {/* Step label */}
            <span
              className={`text-sm ${
                isError
                  ? "font-medium text-red-600"
                  : isCompleted
                    ? "text-green-700"
                    : isActive
                      ? "font-medium text-blue-700"
                      : "text-slate-400"
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}

      {/* Error message below stepper */}
      {errorMessage && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
```

### Example 2: Step Definitions per Touch Type
```typescript
// Step configurations for each flow
// These map Mastra step IDs to human-readable labels

export const TOUCH_1_PIPELINE_STEPS: PipelineStep[] = [
  { id: "generate-pager-content", label: "Generating pager content" },
  { id: "await-seller-approval", label: "Ready for review" },
  { id: "assemble-deck", label: "Assembling Google Slides deck" },
  { id: "record-interaction", label: "Saving to Drive" },
];

export const TOUCH_2_PIPELINE_STEPS: PipelineStep[] = [
  { id: "select-slides", label: "Selecting slides" },
  { id: "assemble-deck", label: "Assembling deck" },
  { id: "record-interaction", label: "Saving to Drive" },
];

export const TOUCH_3_PIPELINE_STEPS: PipelineStep[] = [
  { id: "select-slides", label: "Selecting capability slides" },
  { id: "assemble-deck", label: "Assembling deck" },
  { id: "record-interaction", label: "Saving to Drive" },
];

// Touch 4 keeps existing WorkflowStepper for lifecycle; add PipelineStepper
// for the asset generation phase (steps 8-14)
export const TOUCH_4_ASSET_PIPELINE_STEPS: PipelineStep[] = [
  { id: "rag-retrieval", label: "Retrieving relevant content" },
  { id: "assemble-slide-json", label: "Planning slide structure" },
  { id: "generate-custom-copy", label: "Writing slide content" },
  { id: "create-slides-deck", label: "Creating Google Slides deck" },
  { id: "create-talk-track", label: "Generating talk track" },
  { id: "create-buyer-faq", label: "Generating buyer FAQ" },
  { id: "check-brand-compliance", label: "Checking brand compliance" },
];

export const PRE_CALL_PIPELINE_STEPS: PipelineStep[] = [
  { id: "research-company", label: "Researching company" },
  { id: "query-case-studies", label: "Finding case studies" },
  { id: "generate-hypotheses", label: "Generating hypotheses" },
  { id: "generate-discovery-questions", label: "Creating discovery questions" },
  { id: "build-briefing-doc", label: "Building briefing document" },
  { id: "record-interaction", label: "Saving to Drive" },
];
```

### Example 3: Toaster Integration in Layout
```typescript
// apps/web/src/app/layout.tsx
import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={cn(inter.variable, "font-sans antialiased")}>
        <nav>...</nav>
        <main>...</main>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
```

### Example 4: Friendly Error Mapping Utility
```typescript
// apps/web/src/lib/error-messages.ts
export function mapToFriendlyError(raw: string): string {
  const lower = raw.toLowerCase();

  if (lower.includes("timeout") || lower.includes("polling timeout")) {
    return "The generation is taking longer than expected. Please try again.";
  }
  if (lower.includes("drive") || lower.includes("folder")) {
    return "We couldn't save the file to Google Drive. Please try again.";
  }
  if (lower.includes("gemini") || lower.includes("api") || lower.includes("model")) {
    return "AI generation encountered an issue. Please try again.";
  }
  if (lower.includes("workflow failed")) {
    return "The generation pipeline encountered an error. Please try again.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Connection issue. Check your network and try again.";
  }
  if (lower.includes("agent api error")) {
    return "The server encountered an issue. Please try again in a moment.";
  }

  return "Something went wrong. Please try again, or contact support if this continues.";
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single spinner (`GenerationProgress`) | Step-by-step stepper with per-step status | Phase 11 | Sellers see exactly what the system is doing |
| Silent errors (`setState("input")`) | Toast + inline stepper error | Phase 11 | No more silent failures; every error is visible |
| No demo seed data | Prisma seed with Financial Services scenario | Phase 11 | Repeatable, one-command demo setup |
| Raw error messages | Centralized friendly error mapper | Phase 11 | Professional error UX, no stack traces leaked |

**Key upgrade:** The current `GenerationProgress` component is a generic spinner with a static text message. Phase 11 replaces its internals with `PipelineStepper`, turning every flow into a transparent step-by-step visualization.

## Progress Update Mechanism Decision

**Recommendation: Use polling (existing pattern).**

Rationale:
1. All five form components already poll the Mastra workflow status every 2 seconds
2. The Mastra GET `/api/workflows/{name}/{runId}` endpoint already returns per-step status
3. No backend changes needed -- just read more data from the response already being fetched
4. SSE/WebSocket would require: new Mastra server-side infrastructure, CORS configuration, connection lifecycle management, reconnection logic, and testing -- significant effort for marginal UX improvement
5. 2-second polling is adequate for demo purposes; steps complete in 5-30 seconds each

The only change is in the client polling loop: instead of only checking top-level `status.status`, also read `status.steps` to derive which steps are completed, active, or failed.

## Demo Scenario Architecture

### Seed Data Design
- **Company:** "Meridian Capital Group" (Financial Services)
- **Deal:** "Enterprise Digital Transformation - Q1 2026"
- **Salesperson:** "Alex Chen"
- **Pre-seeded interactions:** One completed Touch 1 interaction with approved pager content (shows cross-touch context in Touch 2/3/4)

### Transcript Fixture
- **Location:** `apps/agent/fixtures/demo-transcript-financial-services.txt`
- **Length:** ~3000 words (sufficient for all 6 extraction fields)
- **Content:** Discovery call between Alex Chen (Lumenalta) and a VP of Engineering at Meridian Capital Group about modernizing their payment processing infrastructure
- **Required field coverage:** customerContext (payment platform details), businessOutcomes (transaction speed, cost reduction), constraints (regulatory compliance, PCI DSS), stakeholders (VP Eng, CTO, CFO), timeline (Q2-Q4 2026), budget (explicitly mentioned range)

### Demo Flow Order
1. Pre-call briefing for Meridian Capital Group (buyer: VP Engineering)
2. Touch 1: Generate pager -> approve
3. Touch 2: Generate intro deck
4. Touch 3: Capability deck (Data Engineering + Cloud Migration)
5. Touch 4: Paste transcript -> field review -> brief approval -> asset review -> delivery
6. Show interaction timeline accumulating all five records
7. Quick Touch 1 or Touch 2 on Healthcare and Technology industries for breadth

### Additional Industries for Breadth Demo
- **Healthcare** and **Technology** -- both are well-represented in the existing content library and are universally understood by a hackathon audience

## Visual Polish Priorities

For the hackathon demo audience, prioritize what is visible during the live walkthrough:

1. **Pipeline progress steppers** -- the most visible new element; must look polished
2. **Error toast styling** -- should match the app's design language (sonner + shadcn handles this)
3. **Deals page dashboard** -- the entry point; ensure deal cards show all relevant status badges
4. **Deal page layout** -- Prep/Engagement sections should have clear visual hierarchy
5. **Interaction timeline** -- shows accumulating history; must render all five interaction types cleanly
6. **Loading states** -- no layout shift when transitioning between form states
7. **Responsive layout** -- ensure the deal page looks good on a projector (typically 1920x1080)

Lower priority (skip if time-constrained):
- Mobile breakpoints (demo is on desktop/projector)
- Empty states for flows that haven't been run
- Deal list page animations

## Smoke Test Approach for Non-Demo Industries

For the 11 industries, validate that Touch 1 and Touch 2 (the simplest flows) can generate decks without errors for at least 2 non-Financial-Services industries. This is a quick functional check, not a deep validation:

1. Create a deal for Healthcare (e.g., "Regional Hospital Group")
2. Run Touch 1 with minimal context -> verify deck appears in Drive
3. Create a deal for Technology (e.g., "DataFlow Analytics")
4. Run Touch 2 with basic inputs -> verify intro deck appears in Drive
5. If both succeed, the content library and slide selection are working across industries

No need to test all 11 individually -- the pipeline logic is industry-agnostic; only the content library coverage varies.

## Open Questions

1. **Mastra step status values**
   - What we know: Steps have `status` field, values include "completed", "running", "waiting", "failed", "suspended"
   - What's unclear: The exact set of intermediate status values that Mastra assigns during step execution. The forms currently only check "completed", "suspended", "failed"
   - Recommendation: During implementation, log the full `status.steps` response during a test run to discover the exact status values and map them to stepper states

2. **Partial failure in Touch 4**
   - What we know: Touch 4 has 14 steps. If step 13 (create-talk-track) fails but step 10 (create-slides-deck) succeeded, the deck exists in Drive
   - What's unclear: Whether the Mastra workflow status reports partial results (completed step outputs) when a later step fails
   - Recommendation: Test a failure scenario; if step outputs are accessible after failure, implement partial success UI. If not, treat any failure as full failure with retry

3. **Demo Drive folder pre-creation**
   - What we know: `getOrCreateDealFolder` creates folders on first use. During demo, the first flow for a deal will create the folder
   - What's unclear: Whether folder creation adds noticeable latency to the first demo flow
   - Recommendation: Include `driveFolderId` in the seed script by pre-creating the folder, or accept the one-time latency

## Sources

### Primary (HIGH confidence)
- Project codebase analysis: all 5 workflow files, all 4 touch form components, pre-call form, layout.tsx, api-client.ts, mastra/index.ts, Prisma schema
- shadcn/ui sonner documentation: https://ui.shadcn.com/docs/components/radix/sonner
- sonner GitHub: https://github.com/emilkowalski/sonner

### Secondary (MEDIUM confidence)
- LogRocket React toast comparison (2025): https://blog.logrocket.com/react-toast-libraries-compared-2025/
- Knock top React notification libraries (2026): https://knock.app/blog/the-top-notification-libraries-for-react

### Tertiary (LOW confidence)
- None -- all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - sonner is the shadcn/ui blessed choice; polling is the established project pattern
- Architecture: HIGH - all patterns derive from existing codebase analysis; no new infrastructure
- Pitfalls: HIGH - identified from direct code review of all form components, error handling paths, and Drive API usage
- Demo scenario: MEDIUM - transcript content quality and Drive rate limits are empirical concerns that need runtime validation

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable -- no fast-moving dependencies)
