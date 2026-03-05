# Phase 6: HITL Checkpoint 1 -- Brief Approval - Research

**Researched:** 2026-03-03
**Domain:** Mastra workflow suspend/resume, brief approval UI, durable state persistence
**Confidence:** HIGH

## Summary

Phase 6 adds a second suspend point (`awaitBriefApproval`) to the existing Touch 4 workflow after the `recordInteraction` step. The Mastra suspend/resume pattern is already proven in the codebase -- Touch 1 (`await-seller-approval`) and Touch 4 (`await-field-review`) both use `suspendSchema`/`resumeSchema`/`suspend()` with LibSQLStore persisting workflow state to `mastra.db`. Adding a second suspend point to the same workflow is explicitly supported by Mastra: "each step must be resumed in sequence, with a separate call to `resume()` for each suspended step." The existing REST API pattern (`POST /api/workflows/touch-4-workflow/{runId}/resume` with `{ stepId, resumeData }`) already handles step-targeted resume.

The UI extends the existing `BriefDisplay` component with an approval action bar (Approve/Reject/Edit), adds inline editing via controlled form state, and introduces a standalone shareable review page at `/deals/[dealId]/review/[briefId]`. The polling mechanism uses the same `checkTouch4StatusAction` pattern already established at 2-second intervals (shifted to 3-second per SC2). The Alert component from shadcn/ui needs to be added (`npx shadcn@latest add alert`) for the deal page banner.

**Primary recommendation:** Restructure the Touch 4 workflow to move `recordInteraction` *before* the new `awaitBriefApproval` step (so the Brief record exists in the database before the approval checkpoint), add approval status fields to the Brief Prisma model, and build the approval UI as an extension of the existing `BriefDisplay` component.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Approval review UX
- Both inline on deal page AND standalone shareable review page (`/deals/[dealId]/review/[briefId]`)
- Either path can trigger approval -- inline view and standalone page connect to the same workflow resume
- Standalone review page shows deal context header (company name, industry, subsector, brief transcript summary) above the full brief with approval actions
- Three approval actions: Approve, Reject (Request Changes), Edit
- Reviewer enters their name before performing any action (self-identification, no auth) -- name captured in the approval record (e.g., "Approved by Jane Doe")
- Reuse existing `BriefDisplay` component as the read-only brief view, extend with approval action bar below

#### Rejection & resubmit flow
- On rejection, reviewer provides freeform text feedback explaining what needs to change
- Feedback is stored as a FeedbackSignal and displayed to the seller
- Seller has TWO resubmit paths after rejection:
  1. Edit extracted fields and re-trigger brief generation from pillar mapping step forward (reuses FieldReview component)
  2. Edit the brief content directly and resubmit for approval (manual fix without regeneration)
- Both paths lead back to the approval checkpoint
- Unlimited rejection/resubmit cycles -- workflow stays suspended until approved
- Each rejection is recorded as a FeedbackSignal for knowledge base growth
- On resubmit, reviewer sees only the latest brief version (no diff or version history in the review UI)

#### Deal page status visibility
- Touch 4 card shows amber "Awaiting Approval" status badge with a "Review Brief" action button
- Interaction timeline entry updates through lifecycle: "Brief Generated" -> "Awaiting Approval" -> "Brief Approved" / "Changes Requested" (single entry, not separate entries per state)
- Top-of-page alert banner on the deal page when a brief is awaiting approval (yellow alert: "Brief awaiting approval -- Review now")
- Deals dashboard cards show an "Approval Pending" indicator so sellers and SMEs can quickly find deals needing action

#### Brief editability
- ALL brief fields are editable: primary pillar, secondary pillars, evidence, use case names/descriptions, ROI outcomes, value hypotheses, and synthesized context fields
- Inline editing on cards: clicking "Edit" makes brief cards editable in-place -- text fields become input/textarea, pillar becomes select dropdown, save button replaces edit button
- Edits captured as FeedbackSignal with diff (signal type "edited") -- original brief stored as "before" snapshot in FeedbackSignal content, Brief record updated in-place with edited content
- Edited-and-approved brief is what Phase 7 RAG pipeline will consume -- no separate "approved version" concept

### Claude's Discretion
- Exact Prisma model additions for approval state tracking (new model vs fields on Brief)
- Mastra workflow modifications to add the second suspend point after brief generation
- API endpoint design for approval/rejection/edit actions
- Polling mechanism implementation for real-time status updates (3-second interval per SC2)
- Server restart durability verification approach
- Alert banner and dashboard indicator styling/animation
- Inline edit mode implementation details (form validation, save/cancel UX)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GEN-03 | Seller and SME can review the complete structured brief in the web app before any assets are generated | BriefDisplay component already renders the brief; extend with approval action bar. Standalone review page at `/deals/[dealId]/review/[briefId]` for SME access. Workflow suspend at `awaitBriefApproval` step blocks all downstream steps. |
| GEN-04 | No asset generation begins until brief is explicitly approved via a hard-stop HITL checkpoint in the web app | Mastra suspend/resume pattern proven in codebase. Second suspend point in Touch 4 workflow. LibSQLStore persists state to `mastra.db` -- durable across server restarts. Resume only fires on explicit POST with `{ stepId: "await-brief-approval", resumeData: { decision: "approved", ... } }`. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @mastra/core | ^1.8.0 | Workflow engine with suspend/resume | Already in use; createStep/createWorkflow/suspend proven |
| @mastra/libsql | ^1.6.2 | Durable workflow state storage | Already in use; persists to mastra.db across restarts |
| @prisma/client | ^6.3.1 | Application database ORM | Already in use; Brief model exists, extend with approval fields |
| zod | ^4.x | Schema validation | Already in use; resumeSchema/suspendSchema pattern established |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui Alert | latest | Approval pending banner on deal page | `npx shadcn@latest add alert` -- NOT currently installed |
| lucide-react | existing | Icons (Shield, CheckCircle, XCircle, Edit, Clock) | Already in use project-wide |

### No New Dependencies Required

The entire phase can be built with existing stack. The only addition is the shadcn/ui Alert component primitive (not a new dependency, just a generated component).

**Installation:**
```bash
cd apps/web && npx shadcn@latest add alert
```

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/
  src/mastra/
    workflows/touch-4-workflow.ts     # MODIFY: add awaitBriefApproval step, reorder recordInteraction
    index.ts                          # MODIFY: add approval/rejection/edit/brief-fetch API routes
  prisma/
    schema.prisma                     # MODIFY: add approval fields to Brief model
apps/web/
  src/
    app/deals/[dealId]/
      page.tsx                        # MODIFY: add approval alert banner
      review/[briefId]/
        page.tsx                      # NEW: standalone shareable review page
    components/
      touch/
        brief-display.tsx             # MODIFY: add approval action bar + inline edit mode
        brief-approval-bar.tsx        # NEW: Approve/Reject/Edit action bar with reviewer name
        brief-edit-mode.tsx           # NEW: inline edit mode wrapping brief fields
        touch-4-form.tsx              # MODIFY: extend FormState for approval states
        touch-flow-card.tsx           # MODIFY: show "Awaiting Approval" badge
      timeline/
        timeline-entry.tsx            # MODIFY: show approval lifecycle states
      deals/
        deal-card.tsx                 # MODIFY: add "Approval Pending" indicator
    lib/
      actions/touch-actions.ts        # MODIFY: add approval/rejection/edit server actions
      api-client.ts                   # MODIFY: add approval/rejection/edit/brief-fetch API functions
```

### Pattern 1: Second Suspend Point in Existing Workflow

**What:** Add `awaitBriefApproval` as a new step in the Touch 4 workflow, creating a second HITL checkpoint after brief generation.

**When to use:** After `recordInteraction` persists the Brief record to the database.

**Critical design decision:** The `recordInteraction` step must run BEFORE `awaitBriefApproval` (unlike the current code where it runs last). This ensures the Brief record exists in the Prisma database when the workflow suspends, allowing:
- The standalone review page to query the Brief by ID
- The deal page to show "Awaiting Approval" status
- The approval action bar to reference a concrete `briefId`

**Revised workflow pipeline:**
```
parseTranscript -> validateFields -> awaitFieldReview (SUSPEND 1)
  -> mapPillarsAndGenerateBrief -> generateROIFraming
  -> recordInteraction (creates Brief record with status "pending_approval")
  -> awaitBriefApproval (SUSPEND 2)
  -> finalizeApproval (updates Brief status to "approved", creates FeedbackSignal)
```

**Example:**
```typescript
// Source: Verified against existing awaitFieldReview pattern in touch-4-workflow.ts
const awaitBriefApproval = createStep({
  id: "await-brief-approval",
  inputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    briefData: SalesBriefLlmSchema,
    roiFramingData: ROIFramingLlmSchema,
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    briefData: SalesBriefLlmSchema,
    roiFramingData: ROIFramingLlmSchema,
    decision: z.enum(["approved"]),
    reviewerName: z.string(),
    editedBrief: SalesBriefLlmSchema.optional(),
  }),
  resumeSchema: z.object({
    decision: z.enum(["approved"]),
    reviewerName: z.string(),
    editedBrief: SalesBriefLlmSchema.optional(),
  }),
  suspendSchema: z.object({
    reason: z.string(),
    briefId: z.string(),
    interactionId: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return await suspend({
        reason: "Brief approval required -- HITL Checkpoint 1",
        briefId: inputData.briefId,
        interactionId: inputData.interactionId,
      });
    }

    // Resumed with approval
    return {
      interactionId: inputData.interactionId,
      briefId: inputData.briefId,
      briefData: resumeData.editedBrief ?? inputData.briefData,
      roiFramingData: inputData.roiFramingData,
      decision: resumeData.decision,
      reviewerName: resumeData.reviewerName,
    };
  },
});
```

### Pattern 2: Brief Status on Prisma Model (NOT a Separate ApprovalState Model)

**What:** Add approval tracking fields directly to the existing Brief model rather than creating a separate ApprovalState model.

**Rationale:**
- Brief is 1:1 with approval state -- no many-to-many relationship needed
- The Brief record is already queried for display; adding fields avoids an extra join
- Keeps the data model simple for a hackathon demo
- Rejection feedback lives in FeedbackSignal (already designed for this)

**Example schema additions:**
```prisma
model Brief {
  // ... existing fields ...

  // Phase 6: Approval tracking
  approvalStatus   String    @default("pending_approval") // "pending_approval" | "approved" | "rejected" | "changes_requested"
  reviewerName     String?   // Name of the person who approved/rejected
  approvedAt       DateTime? // Timestamp of approval
  rejectionFeedback String?  // Freeform text feedback on rejection
  workflowRunId    String?   // Mastra workflow run ID for resume operations
}
```

### Pattern 3: Rejection/Resubmit as Custom API Endpoints (NOT Workflow Steps)

**What:** Handle rejection and resubmission via custom `registerApiRoute` endpoints rather than additional Mastra workflow steps.

**Rationale:** The rejection flow is not a linear workflow step -- it loops back. The workflow stays suspended at `awaitBriefApproval` indefinitely until "approved" is received. Rejection is a side-effect that:
1. Updates Brief.approvalStatus to "changes_requested"
2. Creates a FeedbackSignal with rejection feedback
3. Does NOT resume the workflow

Resubmission (either regenerated or manually edited) updates the Brief record and leaves the workflow suspended. Only explicit approval resumes the workflow.

**Endpoint design:**
```
POST /briefs/:briefId/reject   -- Records rejection, updates status
POST /briefs/:briefId/edit     -- Updates brief content in-place
POST /briefs/:briefId/approve  -- Resumes workflow, updates status
GET  /briefs/:briefId          -- Fetch brief for review page
GET  /briefs/:briefId/review   -- Fetch brief + deal context for standalone review
```

### Pattern 4: Polling with 3-Second Interval

**What:** Client-side polling at 3-second intervals to detect workflow state changes.

**Existing pattern:** `checkTouch4StatusAction` already polls at 2-second intervals. For the approval checkpoint, the polling detects when the workflow transitions from "running" to "suspended" at the `await-brief-approval` step.

**New polling context:** After brief generation resumes from field review, the client polls until:
1. The workflow reaches the second suspend point (`await-brief-approval`)
2. The client reads `briefId` and `interactionId` from the suspend payload
3. The client transitions to the approval UI state

```typescript
// Detect second suspend (brief approval checkpoint)
if (status.status === "suspended") {
  const steps = status.steps ?? {};
  const approvalStep = steps["await-brief-approval"];
  if (approvalStep?.payload) {
    const payload = approvalStep.payload as Record<string, unknown>;
    return {
      status: "awaiting_approval",
      briefId: payload.briefId as string,
      interactionId: payload.interactionId as string,
    };
  }
}
```

### Pattern 5: Standalone Review Page (No Auth, Self-Identification)

**What:** A server-rendered page at `/deals/[dealId]/review/[briefId]` that fetches the brief and deal context from the agent API.

**Key design points:**
- No authentication -- the URL is the access token (demo showpiece)
- Reviewer enters their name in an input field before any action button becomes enabled
- Same `BriefDisplay` component + approval action bar used on both inline and standalone views
- Page is a Next.js server component that fetches data, then renders a client component for interactions

### Anti-Patterns to Avoid

- **Creating a separate workflow for approval:** The approval is a continuation of the Touch 4 workflow, not a standalone process. Using the same `runId` ensures workflow continuity.
- **Storing workflow state in Prisma instead of Mastra:** The LibSQLStore in `mastra.db` is the authoritative workflow state store. Prisma's Brief.approvalStatus is a UI convenience mirror, not the source of truth.
- **Resuming the workflow on rejection:** The workflow must stay suspended. Only an "approved" decision triggers `run.resume()`.
- **Polling the approval status from the agent server:** The approval state should be fetched from Prisma (Brief.approvalStatus), not by polling the Mastra workflow status. Polling is only needed during the brief generation phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Workflow state persistence | Custom database storage for suspend/resume | LibSQLStore (mastra.db) | Already durable across server restarts by design |
| Workflow orchestration | Custom state machine for approval flow | Mastra createStep with suspend/resume | Established pattern, automatic snapshot persistence |
| UI component library | Custom card/badge/alert components | shadcn/ui primitives | Already initialized with 12+ components |
| Form validation | Custom validation logic for brief edits | Zod schemas (SalesBriefLlmSchema) | Same schemas used in workflow, ensures type consistency |
| Status polling | Custom WebSocket or SSE | setInterval with server action | Already proven at 2-second intervals in Touch 4 |

**Key insight:** This phase is almost entirely about wiring together existing patterns (Mastra suspend/resume, Prisma models, shadcn/ui components, server actions, API client). The novelty is the second suspend point and the approval UI -- not any new technology.

## Common Pitfalls

### Pitfall 1: recordInteraction Running After Approval
**What goes wrong:** If `recordInteraction` runs after `awaitBriefApproval` (keeping current order), the Brief record does not exist in the database during the approval review period.
**Why it happens:** The current workflow has `recordInteraction` as the final step.
**How to avoid:** Move `recordInteraction` BEFORE `awaitBriefApproval` in the workflow chain. This means the InteractionRecord and Brief are persisted before the workflow suspends for approval.
**Warning signs:** 404 errors when the standalone review page tries to fetch the brief by ID.

### Pitfall 2: Workflow Step ID Mismatch on Resume
**What goes wrong:** The client sends `stepId: "await-field-review"` when it should send `stepId: "await-brief-approval"` (or vice versa).
**Why it happens:** Two suspend points in the same workflow with similar resume patterns.
**How to avoid:** The client must track which suspend point it is at. The polling result includes the suspended step ID in `result.suspended[0]` or `status.steps[stepId].payload`. Use this to determine which step to resume.
**Warning signs:** Resume calls returning errors or resuming the wrong step.

### Pitfall 3: Editing Brief Content Without Creating FeedbackSignal
**What goes wrong:** Brief edits are saved but the original version is lost, breaking the knowledge growth requirement (DATA-03).
**Why it happens:** Updating the Brief record in-place without first snapshotting the original.
**How to avoid:** Before updating Brief fields, create a FeedbackSignal with `signalType: "edited"` containing the original brief content as the `before` snapshot and the edited content as the `after`.
**Warning signs:** FeedbackSignal table has no "edited" entries for briefs that were modified.

### Pitfall 4: Workflow Resume After Server Restart
**What goes wrong:** After a server restart, the client has a `runId` but the Mastra instance might not immediately recognize it.
**Why it happens:** Mastra loads workflow state from LibSQLStore on demand, not eagerly.
**How to avoid:** The resume endpoint (`POST /api/workflows/touch-4-workflow/{runId}/resume`) should work regardless of server restart because LibSQLStore restores state from `mastra.db`. The `workflowRunId` stored on the Brief model allows the client to resume even if it lost the in-memory `runId`. Verification: restart the server, then call the resume endpoint with the stored `runId` and confirm the workflow completes.
**Warning signs:** 404 on resume after restart. (This would indicate a Mastra bug -- the LibSQLStore should handle this.)

### Pitfall 5: Touch 4 Form State Machine Complexity
**What goes wrong:** The `Touch4Form` component becomes an unmanageable tangle of states when approval flow is added.
**Why it happens:** The current `FormState` union is `"input" | "extracting" | "fieldReview" | "generating" | "briefResult"`. Adding approval states increases it to ~8-9 states.
**How to avoid:** Extend the `FormState` type carefully:
```typescript
type FormState =
  | "input"
  | "extracting"
  | "fieldReview"
  | "generating"
  | "awaitingApproval"  // Brief generated, waiting for approval action
  | "rejected"           // Rejection feedback displayed to seller
  | "editing"            // Inline edit mode active
  | "resubmitting"      // Regenerating or saving edits
  | "approved";          // Final approved state
```
**Warning signs:** Impossible state transitions, stale state after rejection cycles.

### Pitfall 6: Alert Component Not Installed
**What goes wrong:** Import errors when using `<Alert>` or `<AlertTitle>` from `@/components/ui/alert`.
**Why it happens:** The shadcn/ui Alert component has not been added to the project. Currently installed: button, card, input, label, select, tabs, dialog, skeleton, badge, separator, textarea, form, accordion.
**How to avoid:** Run `npx shadcn@latest add alert` in `apps/web` before using the component.
**Warning signs:** Build errors on `Cannot find module '@/components/ui/alert'`.

## Code Examples

### Mastra Workflow Resume via REST API (Established Pattern)
```typescript
// Source: apps/web/src/lib/api-client.ts (existing pattern)
export async function resumeTouch4Workflow(
  runId: string,
  stepId: string,
  resumeData: Record<string, unknown>
): Promise<WorkflowRunResult> {
  return fetchJSON<WorkflowRunResult>(
    `/api/workflows/touch-4-workflow/${runId}/resume`,
    {
      method: "POST",
      body: JSON.stringify({
        stepId,
        resumeData,
      }),
    }
  );
}
```

### Brief Approval Resume Call
```typescript
// New function following established pattern
export async function approveBrief(
  runId: string,
  resumeData: {
    decision: "approved";
    reviewerName: string;
    editedBrief?: SalesBrief;
  }
): Promise<WorkflowRunResult> {
  return fetchJSON<WorkflowRunResult>(
    `/api/workflows/touch-4-workflow/${runId}/resume`,
    {
      method: "POST",
      body: JSON.stringify({
        stepId: "await-brief-approval",
        resumeData,
      }),
    }
  );
}
```

### Brief Rejection (Custom API Endpoint, NOT Workflow Resume)
```typescript
// Source: Following registerApiRoute pattern from apps/agent/src/mastra/index.ts
registerApiRoute("/briefs/:briefId/reject", {
  method: "POST",
  handler: async (c) => {
    const briefId = c.req.param("briefId");
    const body = await c.req.json();
    const { reviewerName, feedback } = z.object({
      reviewerName: z.string().min(1),
      feedback: z.string().min(1),
    }).parse(body);

    const brief = await prisma.brief.update({
      where: { id: briefId },
      data: {
        approvalStatus: "changes_requested",
        reviewerName,
        rejectionFeedback: feedback,
      },
    });

    // Record feedback signal
    await prisma.feedbackSignal.create({
      data: {
        interactionId: brief.interactionId,
        signalType: "negative",
        source: "brief_rejection",
        content: JSON.stringify({
          reviewerName,
          feedback,
          briefId,
        }),
      },
    });

    return c.json({ success: true, brief });
  },
});
```

### Inline Edit Save with FeedbackSignal Diff
```typescript
// Source: Following FeedbackSignal pattern from touch-4-workflow.ts recordInteraction step
registerApiRoute("/briefs/:briefId/edit", {
  method: "POST",
  handler: async (c) => {
    const briefId = c.req.param("briefId");
    const body = await c.req.json();
    const { editedBrief, reviewerName } = body;

    // Snapshot original before editing
    const original = await prisma.brief.findUniqueOrThrow({
      where: { id: briefId },
    });

    // Update brief in-place
    await prisma.brief.update({
      where: { id: briefId },
      data: {
        primaryPillar: editedBrief.primaryPillar,
        secondaryPillars: JSON.stringify(editedBrief.secondaryPillars),
        evidence: editedBrief.evidence,
        customerContext: editedBrief.customerContext,
        businessOutcomes: editedBrief.businessOutcomes,
        constraints: editedBrief.constraints,
        stakeholders: editedBrief.stakeholders,
        timeline: editedBrief.timeline,
        budget: editedBrief.budget,
        useCases: JSON.stringify(editedBrief.useCases),
        approvalStatus: "pending_approval",
      },
    });

    // Record edit signal with before/after diff
    await prisma.feedbackSignal.create({
      data: {
        interactionId: original.interactionId,
        signalType: "edited",
        source: "brief_edit",
        content: JSON.stringify({
          reviewerName,
          before: {
            primaryPillar: original.primaryPillar,
            secondaryPillars: original.secondaryPillars,
            evidence: original.evidence,
            useCases: original.useCases,
          },
          after: editedBrief,
        }),
      },
    });

    return c.json({ success: true });
  },
});
```

### Approval Action Bar Component Pattern
```typescript
// Source: Following shadcn/ui Button + Card patterns from existing components
interface BriefApprovalBarProps {
  briefId: string;
  onApprove: (reviewerName: string) => void;
  onReject: (reviewerName: string, feedback: string) => void;
  onEdit: () => void;
  isSubmitting: boolean;
}

function BriefApprovalBar({ briefId, onApprove, onReject, onEdit, isSubmitting }: BriefApprovalBarProps) {
  const [reviewerName, setReviewerName] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [feedback, setFeedback] = useState("");

  const canAct = reviewerName.trim().length > 0;

  return (
    <Card className="border-slate-200 bg-slate-50">
      <CardContent className="pt-4 space-y-3">
        {/* Reviewer name input */}
        <div className="space-y-1">
          <Label htmlFor="reviewer-name">Your Name</Label>
          <Input
            id="reviewer-name"
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
            placeholder="Enter your name to review"
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            onClick={() => onApprove(reviewerName)}
            disabled={!canAct || isSubmitting}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4 mr-1" /> Approve
          </Button>
          <Button
            onClick={() => setShowRejectForm(true)}
            disabled={!canAct || isSubmitting}
            variant="destructive"
            className="flex-1"
          >
            <XCircle className="h-4 w-4 mr-1" /> Request Changes
          </Button>
          <Button
            onClick={onEdit}
            disabled={!canAct || isSubmitting}
            variant="outline"
            className="flex-1"
          >
            <Edit className="h-4 w-4 mr-1" /> Edit
          </Button>
        </div>

        {/* Rejection feedback form (shown when "Request Changes" clicked) */}
        {showRejectForm && (
          <div className="space-y-2">
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Explain what needs to change..."
              rows={3}
            />
            <Button
              onClick={() => onReject(reviewerName, feedback)}
              disabled={!feedback.trim() || isSubmitting}
              variant="destructive"
              className="w-full"
            >
              Submit Feedback
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single suspend point per workflow | Multiple suspend points with step-targeted resume | Mastra 1.x (2025) | Enables HITL-1 and HITL-2 in same Touch 4 workflow |
| Custom state persistence for approval | LibSQLStore automatic snapshot persistence | Mastra 1.6+ | Server restart durability is built-in, no custom code |
| Separate approval workflow | Same workflow, additional step | Architecture decision | Single runId tracks entire Touch 4 lifecycle |

**Not deprecated:**
- The `registerApiRoute` pattern used for custom endpoints continues to work
- The REST API pattern (`/api/workflows/{id}/{runId}/resume`) is stable in Mastra 1.8.x
- LibSQLStore with `file:` prefix is the recommended local storage approach

## Open Questions

1. **Workflow output schema after adding approval step**
   - What we know: The current workflow `outputSchema` returns `{ interactionId, transcriptId, briefId, briefData, roiFramingData }`. After adding the approval step, it should also include `{ decision, reviewerName }`.
   - What's unclear: Whether the final step output needs to include all previous step data or just the approval decision.
   - Recommendation: The `finalizeApproval` step should output the complete set needed by any downstream consumer (Phase 7+ would need `briefId` and `decision`).

2. **Regeneration path after rejection**
   - What we know: The seller can "edit extracted fields and re-trigger brief generation from pillar mapping step forward."
   - What's unclear: Whether this means starting a NEW workflow run or somehow re-running specific steps of the suspended workflow.
   - Recommendation: Start a NEW workflow run with the edited fields. The old workflow run stays suspended and is abandoned. The new run creates a new Brief record. Update the old Brief's status to "superseded" and link to the new one. This is simpler than trying to re-run individual steps of a suspended workflow, which Mastra does not natively support.

3. **ROI framing persistence after brief edit**
   - What we know: When a reviewer edits the brief directly, the Brief record is updated in-place. But the ROI framing was generated based on the original brief.
   - What's unclear: Whether ROI framing should be regenerated after a direct brief edit.
   - Recommendation: For the hackathon demo, keep the original ROI framing. If the reviewer edits use case names, the ROI framing match-by-name may break. Accept this limitation and document it.

## Validation Architecture

> `workflow.nyquist_validation` is not set in config.json -- treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual verification (no automated test framework configured) |
| Config file | none |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GEN-03 | Brief displayed in web app before asset generation | manual | Navigate to deal page, verify BriefDisplay renders with approval bar | N/A |
| GEN-04 | No asset generation until explicit approval | manual | Verify workflow stays suspended, check no downstream steps execute | N/A |
| SC-1 | Brief rendered as formatted cards | manual | Visual verification of BriefDisplay component | N/A |
| SC-2 | Status polling at 3-second interval | manual | Browser devtools network tab, verify 3s interval | N/A |
| SC-3 | No asset generation until approve click | manual | Check Mastra workflow status remains "suspended" at await-brief-approval | N/A |
| SC-4 | Server restart durability | manual | Restart agent server, verify resume works | N/A |
| SC-5 | Rejection with feedback + resubmit | manual | Click Reject, enter feedback, verify seller sees it, resubmit | N/A |

### Sampling Rate
- **Per task commit:** Manual smoke test in browser
- **Per wave merge:** Full manual walkthrough of approval flow
- **Phase gate:** Complete walkthrough: generate brief -> approve AND generate brief -> reject -> resubmit -> approve

### Wave 0 Gaps
None -- no automated test infrastructure to set up for this phase. All validation is manual UI verification.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `apps/agent/src/mastra/workflows/touch-4-workflow.ts` -- verified suspend/resume pattern with `suspendSchema`/`resumeSchema`/`suspend()`
- Existing codebase: `apps/agent/src/mastra/index.ts` -- verified LibSQLStore configuration at `file:./prisma/mastra.db`
- Existing codebase: `apps/web/src/lib/api-client.ts` -- verified REST API pattern `/api/workflows/touch-4-workflow/{runId}/resume`
- Existing codebase: `apps/web/src/components/touch/brief-display.tsx` -- verified BriefDisplay component structure
- Existing codebase: `apps/agent/prisma/schema.prisma` -- verified Brief model structure
- [Mastra Suspend & Resume Docs](https://mastra.ai/docs/workflows/suspend-and-resume) -- confirmed multiple suspend points supported
- [Mastra HITL Docs](https://mastra.ai/docs/workflows/human-in-the-loop) -- confirmed "each step must be resumed in sequence"

### Secondary (MEDIUM confidence)
- [Mastra run.resume() Reference](https://mastra.ai/reference/workflows/run-methods/resume) -- confirmed `step` parameter for targeting specific suspend points
- [Mastra Workflows API Client Reference](https://mastra.ai/reference/client-js/workflows) -- confirmed REST endpoint patterns

### Tertiary (LOW confidence)
- None -- all findings verified against codebase and official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- pattern directly extends existing Touch 4 workflow with proven suspend/resume mechanism
- Pitfalls: HIGH -- identified from direct codebase analysis and Mastra documentation
- UI patterns: HIGH -- extending existing BriefDisplay component with established shadcn/ui primitives
- Rejection/resubmit flow: MEDIUM -- regeneration path involves creating a new workflow run (reasonable but not yet proven in codebase)

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable -- no fast-moving dependencies)
