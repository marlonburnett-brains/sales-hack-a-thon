# Phase 46: Touch Pages & HITL Workflow - Research

**Researched:** 2026-03-08
**Domain:** Multi-stage HITL workflow UI with AI chat refinement, Next.js App Router
**Confidence:** HIGH

## Summary

Phase 46 transforms the existing touch generation forms (inline card-based) into full-page, 3-stage human-in-the-loop workflows where users progress from Skeleton through Low-fi to High-fi artifacts. The existing codebase already has the foundational patterns: Mastra suspend/resume for HITL checkpoints, polling-based generation progress, approval/edit/reject flows, and stepper components. The primary work is (1) restructuring these patterns into stage-aware full-page experiences, (2) adding a HITL stage tracking model to InteractionRecord, (3) building the stage stepper with back-navigation, (4) creating layout mode toggling and user preference persistence, and (5) ensuring touch pages provide context to the Phase 45 deal-wide chat bar.

The existing touch workflows (touch-1 through touch-4) already use Mastra workflows with suspend points. The new 3-stage model maps naturally onto these: the first suspend produces Skeleton content, a second suspend produces Low-fi content, and the final step produces High-fi output. Touch 1-3 workflows need an additional suspend point inserted; Touch 4 already has 3 suspend points that map cleanly. The InteractionRecord model needs a `hitlStage` field to track which stage the workflow is in.

**Primary recommendation:** Extend existing Mastra workflows with additional suspend points to create the 3-stage model. Add `hitlStage` and `stageContent` fields to InteractionRecord via forward-only migration. Build a reusable `HitlStageStepper` component and `TouchPageShell` layout wrapper that all four touch pages share.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Each touch follows a 3-stage progression adapted to touch complexity:
  - Touch 1 (Pager): Skeleton = content outline, Low-fi = draft text, High-fi = Google Slides pager
  - Touch 2 (Intro Deck): Skeleton = slide selection rationale, Low-fi = draft slide order + notes, High-fi = Google Slides deck
  - Touch 3 (Capability Deck): Skeleton = slide selection rationale, Low-fi = draft slide order + notes, High-fi = Google Slides deck
  - Touch 4 (Proposal): Skeleton = full multi-pillar sales brief (extraction + pillars + ROI), Low-fi = full draft text of proposal deck content, talk track, and FAQ (rendered as readable text, not yet in Slides), High-fi = final Google Slides deck + Google Docs
- User advances between stages by clicking "Approve" or by refining via chat first, then approving
- No separate "reject" action -- user iterates via chat refinement until satisfied, then approves
- User can go back to any previous stage at any time by clicking it in the stepper -- downstream stages regenerate
- Final High-fi approval marks the artifact as "Ready" in-app (no auto-save to Drive -- that's Phase 47)
- Multiple generation runs per touch are supported; previous runs are preserved and viewable (matches existing "Generate Another" pattern)
- The Phase 45 deal-wide chat bar is the single chat interface -- no separate touch-specific refinement UI
- When on a touch page, the chat automatically receives touch context (current stage, artifact content, touch type)
- Same chat capabilities available at every stage -- no artificial restrictions per stage
- Chat is passive (waits for user to ask) -- no proactive suggestions after stage generation
- Update display mode (in-place with diff, in-place without diff, or side-by-side comparison) is user-selectable with saved preference
- User can toggle between full-width mode and split mode with saved preference
- Initial state (before first generation): AI-guided start -- page shows deal context and AI suggests what it can generate based on available data, user confirms via chat or simple "Generate" button
- Generation history: collapsible section -- current/active run is the focus, previous runs available via expandable "History" section
- Touch 4 multi-artifact display: tabbed interface (Proposal, Talk Track, FAQ) within the stage view

### Claude's Discretion
- Stage indicator label style (touch-specific descriptive vs universal)
- Stepper visual design and placement
- Loading states during generation
- Back-navigation UX (warning dialog vs instant)
- AI-guided start page content and suggestions per touch type
- History section visual treatment
- Mobile/responsive behavior for layout mode toggle
- Tab design for Touch 4 multi-artifact view

### Deferred Ideas (OUT OF SCOPE)
- Drive artifact saving (folder selection, sharing controls) -- Phase 47
- Cross-touch intelligence (AI references prior touch interactions) -- v2 (CROSS-01, CROSS-02)
- Proactive chat suggestions at each stage -- could revisit if sellers request guided experience
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TOUCH-01 | User can access a dedicated page for each touch (1-4) within the deal detail | Touch page route already exists at `deals/[dealId]/touch/[touchNumber]/page.tsx` -- needs content implementation |
| TOUCH-02 | Touch 1 page generates a two-pager/first contact pager through HITL workflow | Existing `touch-1-workflow.ts` has generate+suspend+assemble pattern; needs second suspend point for 3-stage model |
| TOUCH-03 | Touch 2 page generates a Meet Lumenalta deck through HITL workflow | Existing `touch-2-workflow` has select-slides+assemble pattern; needs suspend points for Skeleton and Low-fi stages |
| TOUCH-04 | Touch 3 page generates a capability alignment deck through HITL workflow | Mirrors Touch 2 pattern; existing `touch-3-workflow` needs same suspend point additions |
| TOUCH-05 | Touch 4 page generates a sales proposal, talk track, and FAQ through HITL workflow | Existing Touch 4 workflow already has 3 suspend points (field review, brief approval, asset review) that map to 3 stages; needs tabbed multi-artifact display |
| TOUCH-06 | Each touch follows a 3-stage HITL workflow: Skeleton > Low-fi sketch > High-fi presentation | New `HitlStageStepper` component + `hitlStage` field on InteractionRecord + workflow suspend points |
| TOUCH-07 | User can interact with each HITL stage via AI chat to refine before approving | Phase 45 chat bar receives touch context; touch pages expose current stage + content via context provider |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.x (App Router) | Page routing and layouts | Already in use; touch pages are nested routes |
| React | 19.x | UI components | Already in use |
| shadcn/ui | latest | UI primitives (Tabs, Badge, Button, Card, Separator) | Already used throughout the app |
| Tailwind CSS | 4.x | Styling | Already in use |
| Mastra Core | latest | Workflow suspend/resume | Already used for all touch workflows |
| Prisma | 6.19.x | Database ORM | Already in use; stay on 6.19.x per blocker note |
| Zod | latest | Schema validation | Already in use for workflow schemas |
| Lucide React | latest | Icons | Already in use |
| sonner | latest | Toast notifications | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@lumenalta/schemas` | workspace | Shared Zod schemas for structured outputs | Touch content schemas |
| `next/navigation` | built-in | useRouter, usePathname for client navigation | Touch page routing |
| localStorage API | built-in | User preference persistence | Layout mode and update display mode |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| localStorage for preferences | Prisma UserPreference model | localStorage is simpler, no schema migration needed for ~20 users; server-side persistence not needed |
| Custom stepper | Existing WorkflowStepper | WorkflowStepper is status-mapped and read-only; new HitlStageStepper needs clickable stages with back-navigation |
| Per-touch chat | Phase 45 deal-wide chat | Locked decision: single deal-wide chat receives touch context |

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/
  components/
    touch/
      hitl-stage-stepper.tsx          # 3-stage clickable stepper (new)
      touch-page-shell.tsx            # Shared layout: stepper + content area + layout toggle (new)
      touch-stage-content.tsx         # Stage content renderer per touch type (new)
      touch-guided-start.tsx          # AI-guided initial state before generation (new)
      touch-generation-history.tsx    # Collapsible history of previous runs (new)
      touch-4-artifact-tabs.tsx       # Tabbed Proposal/Talk Track/FAQ view (new)
      stage-approval-bar.tsx          # Approve button + refine-via-chat hint (new)
      touch-context-provider.tsx      # React context exposing current touch state to chat bar (new)
      # Existing files retained:
      generation-progress.tsx         # Reuse for in-stage generation loading
      pipeline-stepper.tsx            # Reuse for within-stage sub-step progress
      pipeline-steps.ts              # Extend with stage-aware step definitions
      brief-display.tsx              # Reuse in Touch 4 Skeleton stage
      field-review.tsx               # Reuse in Touch 4 Skeleton stage
      asset-review-panel.tsx         # Adapt for Touch 4 High-fi stage
  app/(authenticated)/deals/[dealId]/
    touch/[touchNumber]/
      page.tsx                        # Refactor to full touch page with HITL stages
  lib/
    actions/
      touch-actions.ts               # Add stage-transition actions
    hooks/
      use-touch-preferences.ts       # localStorage hook for layout/display preferences (new)
apps/agent/src/
  mastra/workflows/
    touch-1-workflow.ts              # Add second suspend point for 3-stage model
    touch-2-workflow.ts              # Add suspend points for Skeleton and Low-fi
    touch-3-workflow.ts              # Add suspend points for Skeleton and Low-fi
    touch-4-workflow.ts              # Map existing 3 suspends to stage model
```

### Pattern 1: Touch Context Provider
**What:** A React context that exposes current touch state (touchNumber, currentStage, stageContent, runId) to parent components, particularly the Phase 45 chat bar.
**When to use:** Mounted inside the touch page, read by the deal layout's chat bar.
**Example:**
```typescript
// touch-context-provider.tsx
interface TouchContext {
  touchNumber: number;
  touchType: string;          // "touch_1" | "touch_2" etc.
  currentStage: HitlStage;   // "skeleton" | "lowfi" | "highfi" | "idle"
  stageContent: unknown;      // Current stage's generated content
  runId: string | null;
  interactionId: string | null;
}

const TouchContextValue = createContext<TouchContext | null>(null);

export function TouchContextProvider({ children, value }: {
  children: React.ReactNode;
  value: TouchContext;
}) {
  return (
    <TouchContextValue.Provider value={value}>
      {children}
    </TouchContextValue.Provider>
  );
}

export function useTouchContext() {
  return useContext(TouchContextValue);
}
```

### Pattern 2: Stage-Aware Workflow with Multiple Suspends
**What:** Each Mastra workflow gets additional suspend points to create the 3-stage HITL model. The workflow pauses after each stage, letting the user review, refine via chat, and approve before continuing.
**When to use:** All touch workflows.
**Example:**
```typescript
// Conceptual pattern for touch-1-workflow.ts additions
const awaitSkeletonApproval = createStep({
  id: "await-skeleton-approval",
  resumeSchema: z.object({
    decision: z.enum(["approved", "refined"]),
    refinedContent: SkeletonSchema.optional(),
  }),
  suspendSchema: z.object({
    stage: z.literal("skeleton"),
    content: SkeletonSchema,
    dealId: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return await suspend({
        stage: "skeleton",
        content: inputData.skeletonContent,
        dealId: inputData.dealId,
      });
    }
    // Resumed with approval or refined content
    return {
      ...inputData,
      approvedSkeleton: resumeData.refinedContent ?? inputData.skeletonContent,
    };
  },
});
```

### Pattern 3: localStorage Preferences Hook
**What:** A custom hook that persists user preferences to localStorage with SSR safety.
**When to use:** Layout mode toggle (full-width vs split) and update display mode.
**Example:**
```typescript
// use-touch-preferences.ts
function useTouchPreferences() {
  const [layoutMode, setLayoutMode] = useState<"full" | "split">(() => {
    if (typeof window === "undefined") return "full";
    return (localStorage.getItem("touch-layout-mode") as "full" | "split") ?? "full";
  });

  const updateLayoutMode = useCallback((mode: "full" | "split") => {
    setLayoutMode(mode);
    localStorage.setItem("touch-layout-mode", mode);
  }, []);

  // Similar for updateDisplayMode
  return { layoutMode, updateLayoutMode, displayMode, updateDisplayMode };
}
```

### Pattern 4: InteractionRecord Stage Tracking
**What:** Add `hitlStage` field to InteractionRecord to track which HITL stage the workflow is currently in.
**When to use:** Every interaction that uses the 3-stage model.
**Example:**
```prisma
model InteractionRecord {
  // ... existing fields ...
  hitlStage        String?           // "skeleton" | "lowfi" | "highfi" | "ready" | null
  stageContent     String?           // JSON: content at current stage for display
}
```

### Anti-Patterns to Avoid
- **Separate chat per touch:** Locked decision says Phase 45's deal-wide chat is the single interface. Do not build a touch-specific chat component.
- **Auto-saving to Drive on High-fi approval:** Drive saving is Phase 47. High-fi approval marks as "Ready" in-app only.
- **Rebuilding existing workflow logic:** The existing Mastra workflows have the right structure. Add suspend points, do not rewrite from scratch.
- **Using server-side state for UI preferences:** localStorage is the existing pattern and is sufficient for ~20 users. No need for a database migration for preferences.
- **Building inline content editing:** The chat bar handles refinement. Stage content display should be read-only with an "Approve" action. Chat-driven edits update the content server-side and refresh the display.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stage stepper UI | Custom SVG stepper from scratch | Adapt existing `WorkflowStepper` pattern with click handlers | Existing pattern has accessibility (aria-current, role=list), consistent styling |
| Generation progress | Custom polling mechanism | Reuse existing `pollStatus` pattern from `touch-1-form.tsx` | Already handles timeout, error states, step-level progress |
| Multi-artifact tabs | Custom tab management | shadcn/ui `Tabs` component | Already used in the project, handles a11y |
| Toast notifications | Custom notification system | `sonner` toast | Already in use project-wide |
| Form validation | Manual validation | Zod schemas from `@lumenalta/schemas` | Already integrated with workflow input/output schemas |
| Content display cards | Bespoke layout components | Existing `Card`, `Badge`, `Separator` from shadcn/ui | Consistent with the rest of the app |

**Key insight:** Nearly every UI primitive needed already exists in the codebase. The work is composition and state management, not building new primitives.

## Common Pitfalls

### Pitfall 1: Stage Regression Without Regeneration
**What goes wrong:** User clicks back to Stage 1 in the stepper, modifies content, but downstream stages still show stale content from the previous run.
**Why it happens:** Stage content is cached client-side and not invalidated when going backwards.
**How to avoid:** When user navigates back to an earlier stage, clear all downstream stage content and mark downstream stages as "pending." The CONTEXT.md explicitly states "downstream stages regenerate."
**Warning signs:** Inconsistent content between stages, user confusion about which version is current.

### Pitfall 2: Workflow Run ID Confusion with Multiple Runs
**What goes wrong:** User starts a new generation while a previous run exists. The UI shows content from the wrong run.
**Why it happens:** Multiple InteractionRecords exist for the same touch type on the same deal.
**How to avoid:** Track the "active" run explicitly. The history section shows previous runs; the main UI always shows the most recent run's state.
**Warning signs:** Content flickering, wrong approval actions firing.

### Pitfall 3: Chat Context Stale After Stage Transition
**What goes wrong:** User approves Stage 1 and moves to Stage 2, but the chat bar still has Stage 1 context.
**Why it happens:** TouchContextProvider value not updated when stage transitions.
**How to avoid:** TouchContextProvider must derive its value from the current InteractionRecord state, not from cached component state. Use the InteractionRecord's `hitlStage` and `stageContent` as source of truth.
**Warning signs:** Chat responses reference outdated stage content.

### Pitfall 4: Prisma Migration on Shared Database
**What goes wrong:** Using `prisma db push` or `prisma migrate reset` to add new fields.
**Why it happens:** Developer habit.
**How to avoid:** Per CLAUDE.md, always use `prisma migrate dev --name <name>`. Use `--create-only` to inspect SQL first. Never reset the database.
**Warning signs:** Migration history drift, missing migration files in commit.

### Pitfall 5: Touch 4 Tab State Loss
**What goes wrong:** User is reviewing the Talk Track tab, approves the stage, and gets sent back to the Proposal tab.
**Why it happens:** Tab state resets on re-render after stage transition.
**How to avoid:** Persist active tab in component state and only reset on stage changes, not on content updates within a stage.
**Warning signs:** Tab jumps unexpectedly.

### Pitfall 6: Layout Mode Hydration Mismatch
**What goes wrong:** Server renders full-width mode, but client reads split-mode from localStorage, causing a hydration mismatch.
**Why it happens:** localStorage is only available client-side.
**How to avoid:** Use `useState` with a lazy initializer that only reads localStorage on the client. Accept that the initial server render uses the default (full-width) and the client will correct on mount. Use `suppressHydrationWarning` if needed, or defer the layout mode read to a `useEffect`.
**Warning signs:** React hydration warnings in console.

## Code Examples

### Stage Stepper with Back-Navigation
```typescript
// Adapted from existing WorkflowStepper pattern
const STAGES = [
  { key: "skeleton", label: "Outline" },
  { key: "lowfi", label: "Draft" },
  { key: "highfi", label: "Final" },
] as const;

type HitlStage = typeof STAGES[number]["key"];

interface HitlStageStepperProps {
  currentStage: HitlStage;
  completedStages: Set<HitlStage>;
  onStageClick: (stage: HitlStage) => void;
  disabled?: boolean;
}

function HitlStageStepper({
  currentStage,
  completedStages,
  onStageClick,
  disabled,
}: HitlStageStepperProps) {
  const currentIndex = STAGES.findIndex((s) => s.key === currentStage);

  return (
    <div className="flex items-center gap-0" role="list" aria-label="HITL stages">
      {STAGES.map((stage, index) => {
        const isCompleted = completedStages.has(stage.key);
        const isActive = stage.key === currentStage;
        const isClickable = isCompleted || isActive;

        return (
          <Fragment key={stage.key}>
            {index > 0 && (
              <div
                className={`h-px w-6 ${isCompleted ? "bg-green-400" : "bg-slate-200"}`}
                aria-hidden="true"
              />
            )}
            <button
              role="listitem"
              aria-current={isActive ? "step" : undefined}
              disabled={disabled || !isClickable}
              onClick={() => isClickable && onStageClick(stage.key)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
                isCompleted
                  ? "bg-green-100 text-green-800 cursor-pointer hover:bg-green-200"
                  : isActive
                    ? "bg-blue-100 text-blue-800"
                    : "bg-slate-100 text-slate-400"
              }`}
            >
              {isCompleted && <CheckCircle className="h-3 w-3" />}
              {stage.label}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
```

### Touch Page Shell Layout
```typescript
// Shared wrapper for all touch pages
interface TouchPageShellProps {
  touchNumber: number;
  touchName: string;
  dealId: string;
  children: React.ReactNode;
  currentStage: HitlStage | null;
  completedStages: Set<HitlStage>;
  onStageClick: (stage: HitlStage) => void;
  historySection?: React.ReactNode;
}

function TouchPageShell({
  touchNumber,
  touchName,
  dealId,
  children,
  currentStage,
  completedStages,
  onStageClick,
  historySection,
}: TouchPageShellProps) {
  const { layoutMode, updateLayoutMode } = useTouchPreferences();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Touch {touchNumber}: {touchName}
          </h1>
        </div>
        <LayoutModeToggle mode={layoutMode} onChange={updateLayoutMode} />
      </div>

      {/* Stage Stepper */}
      {currentStage && (
        <HitlStageStepper
          currentStage={currentStage}
          completedStages={completedStages}
          onStageClick={onStageClick}
        />
      )}

      {/* Main Content */}
      <div className={layoutMode === "split" ? "flex gap-4" : ""}>
        <div className={layoutMode === "split" ? "flex-1" : "w-full"}>
          {children}
        </div>
        {/* Split mode: chat panel area reserved for Phase 45 */}
      </div>

      {/* History */}
      {historySection}
    </div>
  );
}
```

### Stage Transition Action
```typescript
// Server action for advancing/reverting stages
export async function transitionStageAction(
  interactionId: string,
  targetStage: HitlStage,
  action: "approve" | "revert",
  refinedContent?: unknown,
): Promise<{ success: boolean; runId: string }> {
  // If reverting, clear downstream stage content
  if (action === "revert") {
    // Update interaction record to target stage
    // Clear stageContent for downstream stages
    // The workflow will regenerate from this point
  }

  // If approving, resume the workflow with approval
  if (action === "approve") {
    // Resume the suspended workflow step
    // Update hitlStage on the interaction record
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline form-based generation (touch-1-form.tsx) | Full-page HITL with stepper stages | Phase 46 | All generation moves to dedicated touch pages |
| Single suspend point per workflow | Multiple suspend points (3-stage model) | Phase 46 | Workflows pause at each stage boundary |
| Per-touch chat refinement | Deal-wide chat with touch context injection | Phase 45+46 | No separate touch chat UI |
| Direct Drive save on approval | In-app "Ready" status, Drive save deferred | Phase 46 (47 for Drive) | Decouples approval from Drive operations |

**Deprecated/outdated:**
- `touch-{1-4}-form.tsx`: These inline form components will be superseded by the full-page touch experience. They can be refactored or archived, but their polling/status logic should be extracted and reused.
- `TouchFlowCard`: The card-based overview with generate buttons will be replaced by navigating to the touch page. The status badge logic should be reused.

## Open Questions

1. **Exact chat context interface with Phase 45**
   - What we know: Phase 45 builds the deal-wide chat bar. Touch pages must provide context.
   - What's unclear: The exact interface contract between the TouchContextProvider and the Phase 45 chat bar has not been built yet.
   - Recommendation: Define a `TouchContext` interface now and export it. Phase 45 can import and consume it. If Phase 45 hasn't started, define the interface in Phase 46 and Phase 45 adapts to it.

2. **InteractionRecord vs. new model for stage content**
   - What we know: InteractionRecord currently stores final generatedContent. The 3-stage model needs per-stage content storage.
   - What's unclear: Whether to add fields to InteractionRecord or create a separate `StageSnapshot` model.
   - Recommendation: Add `hitlStage` and `stageContent` (JSON) fields to InteractionRecord. This is simpler and avoids a new join. Stage content is overwritten as the user progresses; the final content goes into `generatedContent` as before. If history of all stage content is needed, store it in `stageContent` as a JSON object keyed by stage name.

3. **Workflow modification scope for Touch 2/3**
   - What we know: Touch 2/3 workflows currently have no suspend points (select-slides -> assemble-deck -> save-to-drive).
   - What's unclear: Whether adding 2 suspend points to these workflows will require significant backend refactoring.
   - Recommendation: The Mastra `createStep`/`createWorkflow` API supports any number of suspend points. Adding them is straightforward (same pattern as Touch 1). The main work is defining what "Skeleton" and "Low-fi" content looks like for Touch 2/3 (slide selection rationale, then draft slide order + notes).

## Validation Architecture

> `workflow.nyquist_validation` is not present in config.json -- treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via existing project setup) |
| Config file | Check `apps/web/vitest.config.*` or root config |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOUCH-01 | Touch page renders for each touchNumber 1-4 | smoke | `npx vitest run apps/web/src/app/**/touch/**/*.test.tsx -x` | No -- Wave 0 |
| TOUCH-02 | Touch 1 workflow suspends at Skeleton and Low-fi stages | integration | `npx vitest run apps/agent/src/mastra/__tests__/touch-1-stages.test.ts -x` | No -- Wave 0 |
| TOUCH-03 | Touch 2 workflow suspends at correct stages | integration | `npx vitest run apps/agent/src/mastra/__tests__/touch-2-stages.test.ts -x` | No -- Wave 0 |
| TOUCH-04 | Touch 3 workflow suspends at correct stages | integration | `npx vitest run apps/agent/src/mastra/__tests__/touch-3-stages.test.ts -x` | No -- Wave 0 |
| TOUCH-05 | Touch 4 multi-artifact tabs render Proposal/TalkTrack/FAQ | unit | `npx vitest run apps/web/src/components/touch/__tests__/touch-4-artifact-tabs.test.tsx -x` | No -- Wave 0 |
| TOUCH-06 | HitlStageStepper renders stages, handles click, shows completion | unit | `npx vitest run apps/web/src/components/touch/__tests__/hitl-stage-stepper.test.tsx -x` | No -- Wave 0 |
| TOUCH-07 | TouchContextProvider exposes correct context to consumers | unit | `npx vitest run apps/web/src/components/touch/__tests__/touch-context-provider.test.tsx -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/web/src/components/touch/__tests__/hitl-stage-stepper.test.tsx` -- covers TOUCH-06
- [ ] `apps/web/src/components/touch/__tests__/touch-context-provider.test.tsx` -- covers TOUCH-07
- [ ] `apps/agent/src/mastra/__tests__/touch-1-stages.test.ts` -- covers TOUCH-02
- [ ] Test infrastructure already exists (Vitest config, existing test files in `__tests__/` directories)

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `apps/agent/src/mastra/workflows/touch-1-workflow.ts` -- Mastra suspend/resume pattern, workflow structure
- Codebase inspection: `apps/web/src/components/touch/` -- all existing touch UI components, stepper patterns, approval flows
- Codebase inspection: `apps/web/src/lib/actions/touch-actions.ts` -- server action patterns for workflow orchestration
- Codebase inspection: `apps/agent/prisma/schema.prisma` -- InteractionRecord model, Deal model, existing field structure
- Codebase inspection: `apps/web/src/app/(authenticated)/deals/[dealId]/layout.tsx` -- deal layout shell pattern
- Phase 46 CONTEXT.md -- all locked decisions and implementation constraints

### Secondary (MEDIUM confidence)
- Phase 45 CONTEXT.md -- chat bar integration requirements, deal-wide conversation scope
- Existing `BriefingChatPanel` -- pattern reference for AI-guided start experience
- Existing `touch-1-form.tsx` -- polling, state machine, and generation UX patterns to extract and reuse

### Tertiary (LOW confidence)
- None -- all findings based on direct codebase inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies needed
- Architecture: HIGH -- patterns derive from existing codebase patterns with clear extension points
- Pitfalls: HIGH -- identified from direct analysis of existing code paths and data model constraints
- Workflow modifications: MEDIUM -- Mastra suspend/resume pattern is proven for 1 suspend, but 3 sequential suspends per workflow needs validation at implementation time

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable stack, no external dependency changes expected)
