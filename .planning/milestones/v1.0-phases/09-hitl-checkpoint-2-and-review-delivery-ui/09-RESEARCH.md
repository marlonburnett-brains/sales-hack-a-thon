# Phase 9: HITL Checkpoint 2 and Review Delivery UI - Research

**Researched:** 2026-03-04
**Domain:** Mastra workflow suspend/resume, Next.js review UI, brand compliance validation, workflow lifecycle display
**Confidence:** HIGH

## Summary

Phase 9 extends the existing 14-step Touch 4 workflow with two new steps (awaitAssetReview + finalizeDelivery), builds a standalone asset review page with iframe previews for Google Workspace artifacts, implements a programmatic brand compliance check on the generated SlideJSON, and adds a workflow lifecycle stepper/status display across the deal page and dashboard.

The codebase already contains all necessary patterns from Phase 6 (HITL Checkpoint 1): the brief review standalone page (`/deals/[dealId]/review/[briefId]`), the BriefApprovalBar component, Mastra suspend/resume with `suspendSchema`/`resumeSchema`, custom API endpoints for approve/reject actions, and FeedbackSignal creation. Phase 9 clones these patterns with modifications for asset-level review (multiple artifacts, iframe previews, role selection, brand compliance warnings).

**Primary recommendation:** Clone the Phase 6 HITL-1 pattern (standalone review page, approval endpoints, workflow suspend/resume) for HITL-2 asset review, adding iframe previews for Google Drive artifacts, a brand compliance section, and a 5-stage workflow stepper.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Review panel: Stacked cards with embedded iframe previews for all 3 artifacts (deck, talk track, FAQ) on standalone review page
- Both inline on deal page AND standalone shareable review page: `/deals/[dealId]/asset-review/[interactionId]`
- Deal page shows compact summary -- artifact cards with name, type icon, and status -- plus a prominent "Review Assets" button linking to standalone page
- Full iframe previews only on standalone review page (deal page stays lightweight)
- Deck gets a tall iframe; Google Docs (talk track, FAQ) get shorter iframes
- Vertical scroll through all three artifact cards on standalone page
- Single approve/reject action covers the whole asset set (not per-artifact)
- Two actions only: Approve and Reject (no inline Edit -- edits happen directly in Google Drive)
- Reviewer enters name AND selects their role (Seller, SME, Marketing, Solutions) before acting -- captured in audit trail, no gating
- On rejection: reviewer provides freeform feedback, feedback logged as FeedbackSignal, reviewer edits in Drive, then re-approves
- No regeneration on rejection -- Drive artifacts are already editable in place
- Unlimited rejection/re-approve cycles -- workflow stays suspended until approved
- Programmatic checks only (pure logic, no LLM call) -- fast, runs before HITL-2 triggers
- Issues surfaced as warnings (amber badges) in review panel -- reviewer can still approve despite warnings
- Dedicated "Brand Compliance" section at top of review panel showing pass/warn status with specific issue descriptions
- Slide structure checks: all slides have titles, bullet count 3-6 per slide, speaker notes present on every slide, deck length within 8-18 range
- Content quality checks: no empty content blocks, client name appears in deck, problem restatement slide present, next steps slide exists
- Both horizontal stepper (quick status) AND extended InteractionTimeline (detailed history with timestamps)
- 5 grouped stages in stepper: Transcript -> Brief -> Approved -> Assets -> Delivered
- Stepper appears on both standalone asset review page AND deal page Touch 4 card
- Deals dashboard shows compact pipeline stage badge per deal card
- InteractionTimeline extended with richer lifecycle entries

### Claude's Discretion
- Artifact card display style (icon+title vs thumbnail preview from Google API)
- Exact iframe dimensions for Slides vs Docs previews
- Stepper component implementation (CSS steps, shadcn/ui, or custom)
- Brand compliance check implementation details (how to read SlideJSON for validation)
- API endpoint design for asset approval/rejection
- Mastra workflow step structure for awaitAssetReview suspend point
- Polling mechanism for asset generation status updates
- InteractionTimeline entry format for new lifecycle states
- Deal dashboard badge styling and placement

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REVW-01 | Seller, SME, Marketing, and Solutions can review all generated assets (deck, talk track, FAQ) in the web app before final delivery | Standalone review page at `/deals/[dealId]/asset-review/[interactionId]` with iframe previews for all 3 artifacts; role selection in approval bar |
| REVW-02 | Web app provides direct links to all Google Drive artifacts after generation is complete | outputRefs (JSON object with deckUrl, talkTrackUrl, faqUrl) already persisted in Phase 8 step 14; review panel reads these for Drive links |
| REVW-03 | All generated Google Slides output uses only Lumenalta-approved layouts, colors, and typography from the building block library | Brand compliance check step validates SlideJSON structure before HITL-2 triggers; warnings surfaced in review panel |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @mastra/core | 1.8.0 | Workflow suspend/resume for HITL-2 checkpoint | Already used for HITL-1; createStep with suspendSchema/resumeSchema |
| next | 15.x | Standalone review page (App Router, server/client split) | Already used project-wide |
| react | 18.x | Client components for review panel, stepper, approval bar | Already used project-wide |
| @prisma/client | existing | InteractionRecord status updates, FeedbackSignal creation | Already used for all DB operations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui | existing | Card, Badge, Button, Alert, Separator for review panel + stepper | All UI components |
| lucide-react | existing | Icons for artifact types, stepper stages, status indicators | All icon needs |
| zod | 4.x | Validation schemas for approval/rejection endpoints | All API input validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom CSS stepper | shadcn/ui Tabs or Progress | Custom CSS stepper is simpler for a horizontal 5-stage display; Tabs adds unnecessary interactivity; Progress is too simple |
| iframe previews | Google Drive API thumbnails | Thumbnails are low-resolution and require additional API calls; iframes show live, interactive documents with zero extra API cost |

**Installation:**
No new packages needed. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/src/
  lib/
    brand-compliance.ts         # NEW: pure-logic brand compliance checker
  mastra/
    index.ts                    # EXTEND: add asset approval/rejection endpoints
    workflows/
      touch-4-workflow.ts       # EXTEND: append 2 steps (awaitAssetReview + finalizeDelivery)

apps/web/src/
  app/
    deals/
      [dealId]/
        asset-review/
          [interactionId]/
            page.tsx            # NEW: server component (fetch interaction + outputRefs)
            asset-review-client.tsx  # NEW: client component (review panel + approval)
        page.tsx                # EXTEND: add asset review alert banner + stepper on Touch 4 card
      page.tsx                  # EXTEND: deal cards get pipeline stage badge
  components/
    touch/
      asset-review-panel.tsx    # NEW: stacked artifact cards with iframe previews
      asset-approval-bar.tsx    # NEW: approve/reject with name + role selection
      brand-compliance-section.tsx  # NEW: pass/warn display for compliance checks
      workflow-stepper.tsx      # NEW: 5-stage horizontal stepper component
      touch-4-form.tsx          # EXTEND: add assetGenerating/awaitingAssetReview/delivered states
    timeline/
      timeline-entry.tsx        # EXTEND: new status labels and colors for lifecycle states
    deals/
      deal-card.tsx             # EXTEND: add pipeline stage badge
  lib/
    actions/
      touch-actions.ts          # EXTEND: add asset approval/rejection server actions
    api-client.ts               # EXTEND: add asset review API client functions
```

### Pattern 1: Mastra Workflow Suspend/Resume (HITL-2)
**What:** Third suspend point in the Touch 4 workflow, appended after step 14 (createBuyerFAQ)
**When to use:** After all three Google Workspace artifacts are generated and brand compliance is checked
**Example:**
```typescript
// Step 15: Brand compliance check (pure logic, no LLM)
const checkBrandCompliance = createStep({
  id: "check-brand-compliance",
  inputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    deckUrl: z.string(),
    talkTrackUrl: z.string(),
    faqUrl: z.string(),
    slideCount: z.number(),
    dealFolderId: z.string(),
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    deckUrl: z.string(),
    talkTrackUrl: z.string(),
    faqUrl: z.string(),
    slideCount: z.number(),
    dealFolderId: z.string(),
    complianceResult: z.object({
      passed: z.boolean(),
      warnings: z.array(z.object({
        check: z.string(),
        message: z.string(),
        severity: z.enum(["pass", "warn"]),
      })),
    }),
  }),
  execute: async ({ inputData }) => {
    // Read SlideJSON from workflow step output (already in memory)
    // OR re-read from InteractionRecord if needed
    // Run pure-logic checks against SlideJSON structure
    const complianceResult = runBrandComplianceChecks(/* slideJSON, brief */);

    // Update InteractionRecord status to "pending_asset_review"
    await prisma.interactionRecord.update({
      where: { id: inputData.interactionId },
      data: { status: "pending_asset_review" },
    });

    return { ...inputData, complianceResult };
  },
});

// Step 16: Await Asset Review (SUSPEND 3 -- HITL-2)
const awaitAssetReview = createStep({
  id: "await-asset-review",
  suspendSchema: z.object({
    reason: z.string(),
    interactionId: z.string(),
    deckUrl: z.string(),
    talkTrackUrl: z.string(),
    faqUrl: z.string(),
    complianceResult: z.object({ /* ... */ }),
  }),
  resumeSchema: z.object({
    decision: z.enum(["approved"]),
    reviewerName: z.string(),
    reviewerRole: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return await suspend({
        reason: "Asset review required -- HITL Checkpoint 2",
        interactionId: inputData.interactionId,
        deckUrl: inputData.deckUrl,
        talkTrackUrl: inputData.talkTrackUrl,
        faqUrl: inputData.faqUrl,
        complianceResult: inputData.complianceResult,
      });
    }
    return { ...inputData, ...resumeData };
  },
});
```

### Pattern 2: Standalone Review Page (Server/Client Split)
**What:** Clone of Phase 6's brief review page pattern for asset review
**When to use:** Asset review page at `/deals/[dealId]/asset-review/[interactionId]`
**Example:**
```typescript
// page.tsx (server component)
export default async function AssetReviewPage({ params }) {
  const { dealId, interactionId } = await params;
  const reviewData = await getAssetReviewAction(interactionId);
  return (
    <AssetReviewClient
      reviewData={reviewData}
      dealId={dealId}
      interactionId={interactionId}
    />
  );
}

// asset-review-client.tsx (client component)
// Renders: WorkflowStepper + BrandComplianceSection + AssetReviewPanel + AssetApprovalBar
```

### Pattern 3: Brand Compliance Check (Pure Logic)
**What:** Validate SlideJSON structure against brand rules before HITL-2
**When to use:** As a workflow step after createBuyerFAQ, before awaitAssetReview
**Implementation detail:** The compliance check operates on the SlideJSON intermediate representation (which is still available as a workflow step output string). This avoids an additional Google Slides API call.
**Example:**
```typescript
// apps/agent/src/lib/brand-compliance.ts
export interface ComplianceCheck {
  check: string;
  message: string;
  severity: "pass" | "warn";
}

export function runBrandComplianceChecks(params: {
  slideJSON: SlideAssembly;
  companyName: string;
}): { passed: boolean; warnings: ComplianceCheck[] } {
  const checks: ComplianceCheck[] = [];
  const { slideJSON, companyName } = params;

  // Slide structure checks
  const slideCount = slideJSON.slides.length;
  checks.push({
    check: "deck_length",
    message: slideCount >= 8 && slideCount <= 18
      ? `Deck has ${slideCount} slides (within 8-18 range)`
      : `Deck has ${slideCount} slides (expected 8-18)`,
    severity: slideCount >= 8 && slideCount <= 18 ? "pass" : "warn",
  });

  for (const slide of slideJSON.slides) {
    // Title check
    if (!slide.slideTitle.trim()) {
      checks.push({ check: "slide_title", message: `Slide missing title`, severity: "warn" });
    }
    // Bullet count check (3-6 per slide)
    const bulletCount = slide.bullets.length;
    if (bulletCount < 3 || bulletCount > 6) {
      checks.push({
        check: "bullet_count",
        message: `"${slide.slideTitle}" has ${bulletCount} bullets (expected 3-6)`,
        severity: "warn",
      });
    }
    // Speaker notes check
    if (!slide.speakerNotes.trim()) {
      checks.push({
        check: "speaker_notes",
        message: `"${slide.slideTitle}" has no speaker notes`,
        severity: "warn",
      });
    }
  }

  // Content quality checks
  const hasClientName = slideJSON.slides.some(s =>
    s.slideTitle.includes(companyName) || s.bullets.some(b => b.includes(companyName))
  );
  if (!hasClientName) {
    checks.push({ check: "client_name", message: "Client name not found in any slide", severity: "warn" });
  }

  const hasProblemRestatement = slideJSON.slides.some(s => s.sectionType === "problem_restatement");
  if (!hasProblemRestatement) {
    checks.push({ check: "problem_restatement", message: "No problem restatement slide found", severity: "warn" });
  }

  const hasNextSteps = slideJSON.slides.some(s => s.sectionType === "next_steps");
  if (!hasNextSteps) {
    checks.push({ check: "next_steps", message: "No next steps slide found", severity: "warn" });
  }

  const passed = checks.every(c => c.severity === "pass");
  return { passed, warnings: checks };
}
```

### Pattern 4: API Endpoint Design for Asset Approval/Rejection
**What:** Custom Mastra registerApiRoute endpoints, cloned from Phase 6 brief approval pattern
**When to use:** Asset review approve/reject actions
**Key difference from HITL-1:** Asset rejection does NOT restart the workflow -- artifacts are editable in Google Drive. Rejection logs a FeedbackSignal and keeps the workflow suspended. Only approval resumes the workflow.
**Example:**
```typescript
// POST /interactions/:id/approve-assets
registerApiRoute("/interactions/:id/approve-assets", {
  method: "POST",
  handler: async (c) => {
    const id = c.req.param("id");
    const body = z.object({
      reviewerName: z.string().min(1),
      reviewerRole: z.enum(["Seller", "SME", "Marketing", "Solutions"]),
      runId: z.string().min(1),
    }).parse(await c.req.json());

    // Resume workflow at await-asset-review step
    const wf = mastra.getWorkflow("touch-4-workflow");
    const run = wf.createRun({ runId: body.runId });
    await run.resume({
      stepId: "await-asset-review",
      resumeData: {
        decision: "approved",
        reviewerName: body.reviewerName,
        reviewerRole: body.reviewerRole,
      },
    });

    return c.json({ success: true });
  },
});

// POST /interactions/:id/reject-assets
registerApiRoute("/interactions/:id/reject-assets", {
  method: "POST",
  handler: async (c) => {
    const id = c.req.param("id");
    const body = z.object({
      reviewerName: z.string().min(1),
      reviewerRole: z.enum(["Seller", "SME", "Marketing", "Solutions"]),
      feedback: z.string().min(1),
    }).parse(await c.req.json());

    // Update InteractionRecord status (keep as pending_asset_review)
    // Create FeedbackSignal for rejection -- workflow stays suspended
    await prisma.feedbackSignal.create({ /* ... */ });

    return c.json({ success: true });
  },
});
```

### Pattern 5: Touch 4 Form State Machine Extension
**What:** Extend the 9-state Touch4Form with new states for asset generation and review
**Current states:** input | extracting | fieldReview | generating | awaitingApproval | rejected | editing | resubmitting | approved
**New states to add:** assetGenerating | awaitingAssetReview | delivered
**Implementation:** After "approved" state, the workflow continues silently (no UI change). The form transitions to "assetGenerating" during RAG retrieval + deck/doc creation, then to "awaitingAssetReview" when the workflow suspends at HITL-2, then to "delivered" after final approval.

### Pattern 6: Google Drive Iframe Embed URLs
**What:** Construct iframe-compatible URLs for Google Slides and Google Docs previews
**Critical detail:** The files must be publicly viewable (already handled by `makePubliclyViewable` in deck-assembly.ts and doc-builder.ts).
**Slides embed URL:** `https://docs.google.com/presentation/d/{ID}/embed?start=false&loop=false&delayms=3000`
**Docs embed URL:** `https://docs.google.com/document/d/{ID}/preview`
**Edit URL (for "Open in Drive" button):** Use the existing URLs from outputRefs as-is (ending in `/edit`)

### Anti-Patterns to Avoid
- **Per-artifact approval:** The user decided on single approve/reject for the whole set. Do NOT build per-artifact actions.
- **Asset regeneration on rejection:** The user decided artifacts are edited in Drive. Do NOT add a regenerate-from-rejection path.
- **LLM-based brand compliance:** The user decided on programmatic checks only. Do NOT call Gemini for compliance.
- **Blocking compliance warnings:** The user decided warnings do not prevent approval. Do NOT gate the approve button on compliance pass.
- **Reading live slides for compliance:** The SlideJSON is already in the workflow pipeline. Use it directly -- do NOT make an additional presentations.get API call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Workflow suspend/resume | Custom state machine | Mastra createStep with suspendSchema/resumeSchema | Already proven in HITL-1; durable state via LibSQLStore |
| Iframe preview dimensions | Custom responsive logic | Fixed aspect ratios per doc type | Google embeds have standard dimensions; responsive containers with fixed height work best |
| Role selector UI | Custom dropdown | shadcn/ui Select component | Already available in component library |
| Status badge colors | Hard-coded color strings | STATUS_BADGE pattern from BriefDisplay | Consistent with existing UI patterns |

**Key insight:** Phase 9 is ~80% clone-and-adapt from Phase 6 patterns. The novel elements are: (1) iframe previews, (2) brand compliance section, (3) workflow stepper, (4) role selection in approval bar. Everything else (standalone page, approval endpoints, FeedbackSignal, workflow suspend/resume) is a direct clone.

## Common Pitfalls

### Pitfall 1: outputRefs Format Inconsistency
**What goes wrong:** Touch 1-3 store outputRefs as a JSON array of strings `["url1"]`, but Touch 4 Phase 8 stores it as a JSON object `{deckUrl, talkTrackUrl, faqUrl, dealFolderId}`.
**Why it happens:** Different phases used different formats; Touch 4 needs named keys for three distinct artifacts.
**How to avoid:** Parse outputRefs as JSON and check type -- if it's an object, access `.deckUrl`, `.talkTrackUrl`, `.faqUrl`. If it's an array, use index-based access. The review panel MUST handle the object format from Phase 8.
**Warning signs:** Links showing "[object Object]" or undefined in the review panel.

### Pitfall 2: Workflow Run ID Availability for Resume
**What goes wrong:** The workflow runId is needed to resume at the HITL-2 suspend point, but Mastra steps cannot access their own runId.
**Why it happens:** Same issue from Phase 6 -- runId is managed by the Mastra runtime, not available inside step.execute.
**How to avoid:** Follow the Phase 6 pattern: the approve endpoint receives the runId from the client, and the standalone review page needs access to it. Store the runId (or retrieve it from the Mastra workflow status) and pass it through the review UI. For HITL-2, the runId should be stored on the InteractionRecord (or retrievable from the workflow status API) since the Brief model's workflowRunId was set during HITL-1 approval.
**Warning signs:** "Workflow not found" errors on resume.

### Pitfall 3: Iframe Same-Origin Restrictions
**What goes wrong:** Google Drive iframes may not render if the content security policy blocks embedded frames.
**Why it happens:** Some configurations restrict iframe embedding; Google Drive files must have public access to render in embedded mode.
**How to avoid:** The `makePubliclyViewable` function (already called in deck-assembly.ts and doc-builder.ts) sets `role: reader, type: anyone`. Use the `/embed` URL for Slides and `/preview` URL for Docs, which are specifically designed for iframe embedding.
**Warning signs:** Blank iframes or "Refused to display" console errors.

### Pitfall 4: Workflow State After Phase 8 Completion
**What goes wrong:** Currently the workflow completes after step 14 (createBuyerFAQ). Adding steps 15-17 means the workflow MUST NOT complete at step 14 anymore. If the outputSchema chain breaks, the workflow could error or complete prematurely.
**Why it happens:** The workflow `.commit()` chain must carry data through all new steps without schema mismatches.
**How to avoid:** Carefully extend the outputSchema of createBuyerFAQ to pass through to checkBrandCompliance, then to awaitAssetReview, then to finalizeDelivery. The workflow outputSchema must be updated to reflect the final step's output.
**Warning signs:** "Output schema validation failed" errors, or the workflow completing before reaching HITL-2.

### Pitfall 5: SlideJSON Not Available After Step 14
**What goes wrong:** The brand compliance check needs SlideJSON content, but step 14 (createBuyerFAQ) does not pass slideJSON through its output.
**Why it happens:** Each step can only access its immediate input (from the previous step's output).
**How to avoid:** Ensure createBuyerFAQ outputs the slideJSON string, or have the brand compliance step re-read it from the createSlidesDeck step output. The simplest approach: add slideJSON to createBuyerFAQ's outputSchema so it passes through to the compliance step.
**Warning signs:** Compliance check has no slide data to validate.

### Pitfall 6: InteractionRecord Status Transitions
**What goes wrong:** The status field needs new values ("pending_asset_review", "delivered") but existing code checks for specific status strings.
**Why it happens:** Status checks are string-based throughout the codebase (not enum-validated).
**How to avoid:** Add new status values carefully. Update all status-checking code: TouchFlowCard, DealCard, TimelineEntry, and the deal page. Add entries to STATUS_LABELS and STATUS_COLORS maps in timeline-entry.tsx.
**Warning signs:** Interactions showing as "pending" or "Unknown" status instead of the correct lifecycle stage.

## Code Examples

### Google Drive Iframe Embed URLs
```typescript
// Construct embed URLs from outputRefs
function getEmbedUrl(driveUrl: string, type: "slides" | "docs"): string {
  // driveUrl format: https://docs.google.com/presentation/d/{ID}/edit
  // or: https://docs.google.com/document/d/{ID}/edit
  const id = driveUrl.split("/d/")[1]?.split("/")[0];
  if (!id) return driveUrl;

  if (type === "slides") {
    return `https://docs.google.com/presentation/d/${id}/embed?start=false&loop=false&delayms=3000`;
  }
  return `https://docs.google.com/document/d/${id}/preview`;
}
```

### Asset Review Panel Component
```typescript
// Stacked artifact cards with iframe previews
interface ArtifactCard {
  name: string;
  type: "slides" | "docs";
  driveUrl: string;
  icon: LucideIcon;
}

function AssetReviewPanel({ artifacts, complianceResult }: {
  artifacts: ArtifactCard[];
  complianceResult: { passed: boolean; warnings: ComplianceCheck[] };
}) {
  return (
    <div className="space-y-6">
      <BrandComplianceSection result={complianceResult} />
      {artifacts.map((artifact) => (
        <Card key={artifact.name}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <artifact.icon className="h-5 w-5 text-slate-600" />
                <CardTitle className="text-base">{artifact.name}</CardTitle>
              </div>
              <Button asChild variant="outline" size="sm" className="cursor-pointer gap-2">
                <a href={artifact.driveUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open in Drive
                </a>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <iframe
              src={getEmbedUrl(artifact.driveUrl, artifact.type)}
              className={`w-full rounded-md border ${
                artifact.type === "slides" ? "h-[450px]" : "h-[350px]"
              }`}
              allowFullScreen
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### Workflow Stepper Component
```typescript
// 5-stage horizontal stepper: Transcript -> Brief -> Approved -> Assets -> Delivered
const STAGES = [
  { key: "transcript", label: "Transcript", statuses: ["pending", "generating"] },
  { key: "brief", label: "Brief", statuses: ["pending_approval", "pending_review", "changes_requested"] },
  { key: "approved", label: "Approved", statuses: ["approved"] },
  { key: "assets", label: "Assets", statuses: ["pending_asset_review"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
] as const;

function getActiveStage(status: string): number {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (STAGES[i].statuses.includes(status as any)) return i;
  }
  return 0;
}

function WorkflowStepper({ status }: { status: string }) {
  const activeIndex = getActiveStage(status);

  return (
    <div className="flex items-center gap-1">
      {STAGES.map((stage, i) => (
        <Fragment key={stage.key}>
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            i < activeIndex ? "bg-green-100 text-green-800" :
            i === activeIndex ? "bg-blue-100 text-blue-800" :
            "bg-slate-100 text-slate-400"
          }`}>
            {i < activeIndex && <CheckCircle className="h-3 w-3" />}
            {stage.label}
          </div>
          {i < STAGES.length - 1 && (
            <div className={`h-px w-4 ${i < activeIndex ? "bg-green-300" : "bg-slate-200"}`} />
          )}
        </Fragment>
      ))}
    </div>
  );
}
```

### Asset Approval Bar (with Role Selection)
```typescript
// Extended from BriefApprovalBar with role selector
const REVIEWER_ROLES = ["Seller", "SME", "Marketing", "Solutions"] as const;

function AssetApprovalBar({ onApprove, onReject, isSubmitting }: {
  onApprove: (name: string, role: string) => Promise<void>;
  onReject: (name: string, role: string, feedback: string) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerRole, setReviewerRole] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [feedback, setFeedback] = useState("");

  const canAct = reviewerName.trim().length > 0 && reviewerRole.length > 0;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Your Name</Label>
          <Input value={reviewerName} onChange={e => setReviewerName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Your Role</Label>
          <Select value={reviewerRole} onValueChange={setReviewerRole}>
            <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
            <SelectContent>
              {REVIEWER_ROLES.map(role => (
                <SelectItem key={role} value={role}>{role}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {/* Approve / Reject buttons -- same pattern as BriefApprovalBar */}
    </div>
  );
}
```

### Deal Card Pipeline Badge
```typescript
// Compact pipeline stage badge for deal dashboard cards
function getPipelineStage(interactions: InteractionRecord[]): string {
  const touch4 = interactions.find(i => i.touchType === "touch_4");
  if (!touch4) return "";

  switch (touch4.status) {
    case "pending": return "Transcript Pending";
    case "generating": return "Generating Brief";
    case "pending_approval": return "Brief Pending";
    case "changes_requested": return "Changes Requested";
    case "approved": return "Brief Approved";
    case "completed": return "Generating Assets"; // Post-approval, pre-asset-review
    case "pending_asset_review": return "Assets Ready";
    case "delivered": return "Delivered";
    default: return touch4.status;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 6 HITL-1: single reviewer name input | Phase 9 HITL-2: reviewer name + role selection | Phase 9 | Richer audit trail: "Approved by Jane Doe (Marketing)" |
| Phase 8: workflow completes at step 14 | Phase 9: workflow extends to step 17 with HITL-2 | Phase 9 | Workflow does not reach "completed" until asset review approval |
| Phase 6: brief review only | Phase 9: brief review + asset review | Phase 9 | Two HITL checkpoints in the same workflow |
| Touch 4 card: 9 form states | Phase 9: 12 form states (+ assetGenerating, awaitingAssetReview, delivered) | Phase 9 | Full lifecycle visibility in the deal page |

**Key status value additions for InteractionRecord:**
- `"pending_asset_review"` -- After assets generated, awaiting HITL-2 approval
- `"delivered"` -- After HITL-2 approval, final state

## Open Questions

1. **workflowRunId storage for HITL-2 resume**
   - What we know: Phase 6 stores workflowRunId on the Brief model for HITL-1 resume. For HITL-2, the runId is the same (same workflow execution), but the Brief model already has the runId from HITL-1 approval.
   - What's unclear: Whether the same runId persists across suspend/resume cycles in Mastra.
   - Recommendation: The runId IS persistent across the entire workflow execution -- it was set when the workflow was started and remains the same through all suspend/resume cycles. Use the same runId from the Brief model (or from the workflow status API) for HITL-2 resume. Confidence: HIGH -- this is how Mastra's LibSQLStore works (keyed by runId).

2. **Touch4Form polling after HITL-1 approval**
   - What we know: Currently, after brief approval, the Touch4Form shows "approved" state and stops. The user closes the form. But now, after approval, the workflow continues silently through steps 9-15.
   - What's unclear: Whether the Touch4Form should poll through asset generation or if the user discovers the asset review via other means (deal page refresh, alert banner).
   - Recommendation: The Touch4Form need NOT poll through asset generation in real-time. After brief approval, show the "approved" state with a message like "Assets will be generated. You'll see them in the review panel when ready." The deal page (which refreshes via revalidatePath) will show the asset review banner/button when status transitions to "pending_asset_review". This avoids complexity in the form and matches the existing pattern where the standalone review page is the primary review surface.

3. **Brand compliance check timing: SlideJSON vs live deck**
   - What we know: The SlideJSON is the intermediate representation before Google Slides API writes. After the deck is created, the actual slides may differ from SlideJSON if per-slide errors occurred (skipped slides).
   - Recommendation: Run compliance on SlideJSON for simplicity and speed. The deck-assembly engine logs per-slide errors but still creates all non-errored slides. SlideJSON accurately represents intended content. If a slide was skipped, the compliance check would flag missing sections (e.g., "No next steps slide") which is the correct behavior. Confidence: HIGH.

## Validation Architecture

> Validation section included (workflow.nyquist_validation not explicitly set to false in config.json).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual verification + smoke tests |
| Config file | None -- hackathon project, no test framework configured |
| Quick run command | `npx tsc --noEmit` (type check) |
| Full suite command | Manual smoke test per success criteria |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REVW-01 | Review panel shows all 3 artifacts with iframe previews | manual + type check | `npx tsc --noEmit` | N/A |
| REVW-02 | Direct Drive links in review panel | manual + type check | `npx tsc --noEmit` | N/A |
| REVW-03 | Brand compliance check on SlideJSON | unit-testable (pure function) | `npx tsc --noEmit` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` (type check across monorepo)
- **Per wave merge:** Manual smoke test: trigger full Touch 4 workflow, verify HITL-2 suspend, approve assets, verify delivered state
- **Phase gate:** Full end-to-end smoke test before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/agent/src/lib/brand-compliance.ts` -- pure function, unit-testable
- [ ] No formal test framework installed (hackathon project -- type checking is the automated gate)

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `apps/agent/src/mastra/workflows/touch-4-workflow.ts` (14-step workflow, suspend/resume patterns)
- Direct codebase analysis: `apps/agent/src/mastra/index.ts` (API route registration, brief approval endpoints)
- Direct codebase analysis: `apps/web/src/app/deals/[dealId]/review/[briefId]/` (standalone review page pattern)
- Direct codebase analysis: `apps/web/src/components/touch/brief-approval-bar.tsx` (approval bar pattern)
- Direct codebase analysis: `apps/web/src/components/touch/brief-display.tsx` (approval mode pattern)
- Direct codebase analysis: `apps/web/src/components/touch/touch-4-form.tsx` (9-state form machine)
- Direct codebase analysis: `apps/web/src/components/timeline/timeline-entry.tsx` (status labels/colors)
- Direct codebase analysis: `apps/web/src/components/deals/deal-card.tsx` (touch indicators, pending approval detection)
- Direct codebase analysis: `apps/agent/src/lib/deck-assembly.ts` (createSlidesDeckFromJSON, makePubliclyViewable)
- Direct codebase analysis: `apps/agent/src/lib/doc-builder.ts` (createGoogleDoc, makePubliclyViewable)
- Direct codebase analysis: `apps/agent/prisma/schema.prisma` (InteractionRecord, FeedbackSignal models)
- Direct codebase analysis: `packages/schemas/llm/slide-assembly.ts` (SlideAssembly type with sectionType/sourceType)

### Secondary (MEDIUM confidence)
- Google Docs iframe embed URL format: `/document/d/{ID}/preview` -- standard Google Docs embedding
- Google Slides iframe embed URL format: `/presentation/d/{ID}/embed` -- standard Google Slides embedding

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- all patterns directly cloned from Phase 6 with well-understood extensions
- Pitfalls: HIGH -- identified from direct codebase analysis of existing patterns and data flow
- Brand compliance: HIGH -- pure logic on already-available SlideJSON, checks are straightforward
- Workflow extension: HIGH -- Mastra .then() chain extension is well-established pattern (used in Phases 5, 6, 7, 8)

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable -- all patterns are internal to the codebase)
