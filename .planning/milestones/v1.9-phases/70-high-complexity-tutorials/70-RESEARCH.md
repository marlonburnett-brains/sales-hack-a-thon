# Phase 70: High-Complexity Tutorials - Research

**Researched:** 2026-03-19
**Domain:** Tutorial content authoring -- HITL touch workflows + asset review capture, narration, rendering
**Confidence:** HIGH

## Summary

Phase 70 is pure content authoring on top of fully-built infrastructure. The capture engine, mock server, TTS pipeline, Remotion composition, and visual effects are all complete (Phases 62-66). The existing `touch-4-hitl` tutorial (6 steps) serves as a working template but needs complete replacement with an expanded ~15-20 step version. Four new tutorials (Touch 1-3, Asset Review) follow the identical pattern: script.json + overrides.json + stages/*.json + capture spec.

The primary technical challenge is fixture authoring -- each tutorial needs 6-10 stage fixture files with realistic `stageContent` JSON that matches what the real HITL workflow produces at each gate. The mock server already handles stage-aware interaction loading, workflow start/resume, and asset review endpoints. Two mock server extensions are needed: (1) make the `/interactions/:id/asset-review` route stage-aware (currently hardcoded), and (2) potentially add stage-aware responses for touch-specific SSR routes.

**Primary recommendation:** Structure as two plans -- Plan 01 for scripts, fixtures, capture specs, and mock server extensions for all 5 tutorials; Plan 02 for TTS audio generation and MP4 rendering. This matches the Phase 67/68 pattern exactly.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full HITL gates at every stage (Skeleton, Low-fi, High-fi) for all touch tutorials -- each gate gets its own step showing content + explicit approve action
- One refine demo per touch tutorial -- show request change then AI regenerates then approve at the most meaningful gate per touch (Claude picks which gate)
- All other gates are review + approve only
- Touch 1 includes manual upload override demonstration as a separate flow after HITL workflow completes (adds 2-3 steps)
- Touch 4: existing pilot script (6 steps) is replaced entirely -- the expanded tutorial IS the Touch 4 tutorial
- Touch 4: dedicated steps per artifact -- proposal deck, talk track, and FAQ each get their own step(s) for content review
- Touch 4: show paste action for transcript input -- tutorial shows clicking text area, stage switch simulates pasted text, then submit
- Touch 4: final step shows Drive links for each artifact as a "here's where to find them" moment after Saved-to-Drive confirmation
- Cross-touch structure: tutorials adapted per touch, not formulaic
  - Touch 1: pager generation + manual upload override
  - Touch 2: strategy resolution + slide selection + reordering (demonstrate reordering via drag/UI controls)
  - Touch 3: multi-capability area selection (select 2-3 areas) + structure-driven assembly
  - Touch 4: full 6-phase pipeline with 3 output artifacts + transcript paste entry
- All 4 touch tutorials use the same deal as Phase 68 ("Meridian Health Partnership") -- full narrative arc across all 4 touches
- TUT-17 covers artifacts from all 4 touches in the review queue -- comprehensive view
- TUT-17: full brand compliance walkthrough with flagged issues, severity levels, demonstrate one fix and re-check
- TUT-17: demonstrate reject + regeneration flow -- reject one artifact, show regeneration, re-review updated version
- Conversational tone, standard pacing -- consistent with Phase 67/68
- Light cross-references where natural
- Standalone outro slates -- "Tutorial Complete" only, no next-tutorial direction
- Standard timing for navigation, slightly longer holds on first UI reveals
- Zoom ~30-40% of steps, callouts ~20-30%, cursor on all click/hover steps
- No "Next: [Tutorial Name]" on outro slates
- All 5 tutorials use the same deal ("Meridian Health Partnership") from shared fixtures
- Stage fixtures needed per touch: idle, generating, skeleton, lowfi, hifi, completed (plus touch-specific stages as needed)
- Asset Review fixtures need artifacts from all 4 touches in the review queue, plus at least one with compliance issues

### Claude's Discretion
- Exact step count per tutorial (Touch 1-3 likely ~12-18 steps each; Touch 4 likely ~15-20 steps; Asset Review likely ~15-20 steps)
- Which gate gets the refine demo per touch
- Which specific steps get zoom, callouts, and cursor targets
- Callout text and positioning
- Zoom scale overrides per step (default 1.5x from Phase 66)
- Touch-specific stage names and fixture file structure
- Asset Review narrative framing (standalone vs. series continuation)
- Fixture content details (transcript text, compliance issue types, artifact content)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TUT-13 | "Touch 1: First-Contact Pager" tutorial -- 3-stage HITL, review/approve/refine at each gate, manual upload override | Full HITL gate pattern with stages/ fixtures, existing capture loop supports mockStage transitions; touch page at `/deals/[dealId]/touch/1`; need idle/generating/skeleton/lowfi/hifi/completed + manual-upload stages |
| TUT-14 | "Touch 2: Intro Deck" tutorial -- strategy resolution, slide selection, ordering, final Google Slides assembly | Same HITL gate infrastructure; touch page at `/deals/[dealId]/touch/2`; stageContent must include slide selection/reordering UI data; need strategy-related stage fixtures |
| TUT-15 | "Touch 3: Capability Deck" tutorial -- capability area selection, structure-driven assembly, approval flow | Same HITL gate infrastructure; touch page at `/deals/[dealId]/touch/3`; stageContent includes capability areas and structure data |
| TUT-16 | "Touch 4: Transcript-to-Proposal" tutorial -- full 6-phase pipeline with 3 output artifacts | Replaces existing 6-step pilot; existing `fixtures/touch-4-hitl/` directory expanded; need transcript paste step, per-artifact review steps, Drive links final step |
| TUT-17 | "Asset Review & Approval" tutorial -- review generated artifacts, brand compliance checks, approve/reject workflows | Asset review page at `/deals/[dealId]/asset-review/[interactionId]`; mock server `/interactions/:id/asset-review` needs stage-awareness; compliance warnings fixture data needed |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Playwright | (workspace dep) | Screenshot capture via generic loop | Complete |
| Remotion | 4.0.x | Video composition from screenshots + audio | Complete |
| kokoro-js | (workspace dep) | Draft TTS narration | Complete |
| Chatterbox-Turbo | Python sidecar | Production TTS narration | Complete |
| Express | (workspace dep) | Mock agent server | Complete |
| Zod | (workspace dep) | Script and fixture validation | Complete |

### No New Dependencies
This phase adds zero new libraries. All work is content authoring (JSON scripts, JSON fixtures, TypeScript capture specs) using established infrastructure.

## Architecture Patterns

### Established Tutorial Directory Structure
```
apps/tutorials/
  fixtures/
    touch-1-pager/           # NEW
      script.json            # Tutorial steps (12-18 steps)
      overrides.json         # Interaction fixtures for touch_1
      stages/
        idle.json            # No interaction yet
        generating.json      # Workflow running
        skeleton.json        # Outline gate
        lowfi.json           # Draft gate
        hifi.json            # Final gate
        completed.json       # Done + Drive links
        manual-upload.json   # Manual override demo
        refine-*.json        # Refine demo stage(s)
    touch-2-intro-deck/      # NEW
      script.json
      overrides.json
      stages/
        idle.json
        generating.json
        skeleton.json
        lowfi.json
        hifi.json
        completed.json
        refine-*.json
    touch-3-capability-deck/ # NEW
      script.json
      overrides.json
      stages/
        idle.json
        generating.json
        skeleton.json
        lowfi.json
        hifi.json
        completed.json
        refine-*.json
    touch-4-hitl/            # EXPANDED (replace existing 6-step pilot)
      script.json            # Replaced entirely (~15-20 steps)
      overrides.json         # May need expansion
      stages/                # Existing 6 files, may need additions
        idle.json
        generating.json
        skeleton.json
        lowfi.json
        hifi.json
        completed.json
        refine-*.json        # NEW for refine demo
    asset-review/            # NEW
      script.json            # 15-20 steps
      overrides.json         # Interactions from all 4 touches
      stages/
        review-queue.json    # All 4 touches' artifacts
        compliance-check.json
        compliance-issues.json
        reject-artifact.json
        regenerating.json
        re-review.json
        approved.json
  capture/
    touch-1-pager.spec.ts          # NEW
    touch-2-intro-deck.spec.ts     # NEW
    touch-3-capability-deck.spec.ts # NEW
    touch-4-hitl.spec.ts           # EXISTS (no changes needed)
    asset-review.spec.ts           # NEW
```

### Pattern 1: HITL Stage Gate Script Pattern
**What:** Each HITL gate gets a minimum of 2 steps: (1) arrive at gate and see content, (2) approve. The refine demo gate gets 3-4 steps: (1) see content, (2) request changes, (3) see regenerated content, (4) approve.
**When to use:** All touch tutorials (TUT-13 through TUT-16)
**Example (from existing briefing tutorial, adapted for HITL):**
```json
{
  "id": "step-005",
  "url": "/deals/deal-001/touch/1",
  "narration": "The AI has generated an outline of your pager content. Review the key sections...",
  "mockStage": "skeleton",
  "waitForText": "Outline",
  "delayMs": 500,
  "zoomTarget": { "selector": "main", "scale": 1.5, "x": 0.5, "y": 0.45 },
  "callout": { "text": "Review before approving", "x": 0.35, "y": 0.3 }
}
```

### Pattern 2: Stage-Aware Interaction Fixture
**What:** Each `stages/{name}.json` file provides a partial `FixtureSet` override (primarily `interactions` array). The mock server merges this with base fixtures when stage is set.
**When to use:** Every stage transition step
**Example (skeleton stage fixture):**
```json
{
  "interactions": [
    {
      "id": "int-touch1-001",
      "dealId": "deal-001",
      "touchType": "touch_1",
      "status": "in_progress",
      "inputs": "{\"companyName\":\"Meridian Health Partnership\"}",
      "hitlStage": "skeleton",
      "stageContent": "{\"sections\":[{\"title\":\"Challenge\",\"content\":\"...\"},{\"title\":\"Solution\",\"content\":\"...\"}]}"
    }
  ]
}
```

### Pattern 3: Capture Spec (Exact Template)
**What:** Every capture spec follows the identical boilerplate -- only `TUTORIAL_ID` and the test description change.
**When to use:** All 4 new capture specs
**Key insight:** The capture loop is 100% generic. The `touch-4-hitl.spec.ts` and `briefing.spec.ts` are byte-for-byte identical except for `TUTORIAL_ID` and the test.describe string. New specs follow this template exactly.

### Pattern 4: Refine Demo via Stage Switching
**What:** The "request changes" refine flow is simulated by: (1) show content at gate, (2) set mockStage to a "refine-requesting" stage showing a feedback form or action, (3) set mockStage to "refine-regenerating" (brief loading state), (4) set mockStage back to the same gate with updated stageContent.
**When to use:** Once per touch tutorial at the most meaningful gate.
**Implementation:** Create additional stage fixture files (e.g., `refine-skeleton.json` or `skeleton-refined.json`) with updated stageContent showing the regenerated version.

### Pattern 5: Asset Review Stage-Aware Mock Extension
**What:** The mock server's `/interactions/:id/asset-review` route currently returns a hardcoded response. For TUT-17, this route needs to become stage-aware (like `/deals/:dealId/interactions` already is) to return different compliance results, review statuses, and artifact sets per stage.
**When to use:** TUT-17 only
**Implementation:** In `mock-server.ts`, modify the asset-review GET handler to check `loadStageFixtures()` for an `assetReview` field, falling back to the current hardcoded response.

### Anti-Patterns to Avoid
- **Reusing the touch-4-hitl pilot directly:** The CONTEXT.md explicitly says replace it entirely. Don't try to extend the 6-step script -- write a new ~15-20 step script from scratch.
- **Identical scripts across touches:** Each tutorial must be adapted to what's unique about that touch. Touch 2 emphasizes slide curation, Touch 3 emphasizes capability selection. Don't copy-paste the same gate pattern.
- **Hardcoded mock responses for asset review:** The current asset-review mock returns static data. TUT-17 needs multiple stages (compliance issues, rejection, regeneration) that require stage-aware responses.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Capture loop logic | Custom capture code per tutorial | Existing generic loop in `touch-4-hitl.spec.ts` | Template is identical across all tutorials |
| Stage transitions | Manual fetch calls to set stages | `mockStage` field on step in script.json | Infrastructure handles this automatically |
| Visual effects | Custom Remotion components | `zoomTarget`, `callout`, `cursorTarget` fields in script.json | Phase 66 composition reads these fields |
| TTS generation | Manual audio file creation | `pnpm --filter tutorials tts <tutorial-name>` | Pipeline processes any script.json |
| MP4 rendering | Custom ffmpeg scripts | `pnpm --filter tutorials render <tutorial-name>` | Render pipeline handles composition |

## Common Pitfalls

### Pitfall 1: Company Name Mismatch
**What goes wrong:** CONTEXT.md says "Meridian Health Partnership" but shared fixtures use "Meridian Dynamics" with `comp-meridian-001`.
**Why it happens:** Phase 68 medium-complexity tutorials used "Meridian Dynamics" (the existing fixture). The CONTEXT.md for Phase 70 says "same deal as Phase 68."
**How to avoid:** Use the existing shared fixture company name "Meridian Dynamics" -- the CONTEXT.md reference to "Meridian Health Partnership" appears to be the deal narrative name, not the company name. Verify by checking Phase 68 CONTEXT.md. The deal name in fixtures is "Q2 Digital Transformation Initiative" on deal-001.
**Warning signs:** Company name in narration doesn't match what appears on screen.

### Pitfall 2: touchType String Format
**What goes wrong:** TouchType uses underscore format in the database (`touch_1`, `touch_2`) but the URL uses slash format (`/touch/1`, `/touch/2`).
**Why it happens:** Two different naming conventions in the codebase.
**How to avoid:** In fixture `interactions` arrays, always use `touch_1`, `touch_2`, etc. In script.json URLs, use `/deals/deal-001/touch/1`. In script.json `touchType` field, use `touch-1` (hyphenated).
**Warning signs:** Mock server not matching stage fixtures because touchType filter doesn't match.

### Pitfall 3: Asset Review Route Needs interactionId
**What goes wrong:** Asset review page URL requires both dealId AND interactionId: `/deals/[dealId]/asset-review/[interactionId]`.
**Why it happens:** The page component calls `getAssetReviewAction(interactionId)` to fetch review data.
**How to avoid:** Use a stable mock interaction ID in the URL (e.g., `int-touch4-001`) that matches the fixture data. The overrides.json needs interactions from all 4 touches with appropriate IDs.
**Warning signs:** Asset review page shows 404 because interactionId doesn't match any fixture.

### Pitfall 4: Mock Server Asset Review Not Stage-Aware
**What goes wrong:** All asset review steps show the same response (passed compliance, no warnings).
**Why it happens:** The current mock server handler for `/interactions/:id/asset-review` is hardcoded, not stage-aware.
**How to avoid:** Extend mock-server.ts to check `loadStageFixtures()` for an `assetReview` key before falling back to the default response. This is a small code change (~10 lines).
**Warning signs:** Compliance issues never appear on screen despite being in the narration.

### Pitfall 5: Same-URL Reload Behavior
**What goes wrong:** When mockStage changes but the URL stays the same, the page doesn't pick up the new stage data.
**Why it happens:** Playwright navigation skips if URL matches current URL.
**How to avoid:** The existing capture spec handles this -- when `step.url === currentUrl`, it calls `page.reload()`. This pattern is already built into the touch-4-hitl spec. New specs inherit this behavior.
**Warning signs:** Screenshots show stale data from a previous stage.

### Pitfall 6: Stage Fixture stageContent Must Be JSON String
**What goes wrong:** Stage content fails to parse on the frontend.
**Why it happens:** The `stageContent` field in the interaction fixture is a JSON string (stringified JSON inside a string field), not a nested object.
**How to avoid:** Always `JSON.stringify()` the stage content object when writing it into the fixture's `stageContent` field. Look at existing `touch-4-hitl/stages/skeleton.json` for the pattern.
**Warning signs:** Frontend shows "Error parsing stage content" or blank content area.

## Code Examples

### New Capture Spec Template (Touch 1 example)
```typescript
// Source: apps/tutorials/capture/touch-4-hitl.spec.ts (identical pattern)
import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { TutorialScriptSchema } from "../src/types/tutorial-script.js";
import type { TutorialStep } from "../src/types/tutorial-script.js";
import { ensureAuthState } from "../src/helpers/auth.js";
import { mockBrowserAPIs } from "../src/helpers/route-mocks.js";
import { captureStep } from "../src/helpers/screenshot.js";
import { loadFixtures } from "../fixtures/loader.js";
import { waitForText } from "../src/helpers/determinism.js";

const TUTORIAL_ID = "touch-1-pager"; // Only this line changes
const MOCK_SERVER_URL = `http://localhost:${process.env.MOCK_SERVER_PORT ?? "4112"}`;
// ... rest is identical to touch-4-hitl.spec.ts
```

### Stage-Aware Asset Review Mock Extension
```typescript
// Modification to mock-server.ts asset-review route
app.get("/interactions/:id/asset-review", (req: Request, res: Response) => {
  const stageFixtures = loadStageFixtures(tutorialName, currentStage);
  const stageAssetReview = (stageFixtures as Record<string, unknown>)?.assetReview;
  if (stageAssetReview) {
    res.json(stageAssetReview);
    return;
  }
  // Existing hardcoded fallback
  res.json({
    interaction: { id: req.params.id, status: "completed", outputRefs: { /* ... */ } },
    deal: { /* ... */ },
    brief: null,
    complianceResult: { passed: true, warnings: [] },
  });
});
```

### HITL Gate Step Pattern (3-step refine demo)
```json
[
  {
    "id": "step-007",
    "url": "/deals/deal-001/touch/1",
    "narration": "At the draft stage you can request changes. Click Request Changes to ask the AI to refine specific sections.",
    "mockStage": "lowfi",
    "waitForText": "Draft",
    "cursorTarget": { "x": 0.7, "y": 0.85 },
    "callout": { "text": "Request targeted improvements", "x": 0.5, "y": 0.8 }
  },
  {
    "id": "step-008",
    "url": "/deals/deal-001/touch/1",
    "narration": "The AI is regenerating the draft based on your feedback. This typically takes a few seconds.",
    "mockStage": "lowfi-refining",
    "waitForText": "Regenerating",
    "delayMs": 500
  },
  {
    "id": "step-009",
    "url": "/deals/deal-001/touch/1",
    "narration": "The refined draft is ready. Notice the updated sections reflecting your feedback. Once satisfied, approve to move to the final review.",
    "mockStage": "lowfi-refined",
    "waitForText": "Draft",
    "zoomTarget": { "selector": "main", "scale": 1.4, "x": 0.5, "y": 0.5 }
  }
]
```

### Asset Review Multi-Touch Overrides
```json
{
  "interactions": [
    {
      "id": "int-touch1-001",
      "dealId": "deal-001",
      "touchType": "touch_1",
      "status": "completed",
      "hitlStage": "ready",
      "stageContent": "{\"pagerUrl\":\"https://docs.google.com/document/d/mock-pager\"}"
    },
    {
      "id": "int-touch2-001",
      "dealId": "deal-001",
      "touchType": "touch_2",
      "status": "completed",
      "hitlStage": "ready",
      "stageContent": "{\"deckUrl\":\"https://docs.google.com/presentation/d/mock-intro\"}"
    },
    {
      "id": "int-touch3-001",
      "dealId": "deal-001",
      "touchType": "touch_3",
      "status": "completed",
      "hitlStage": "ready",
      "stageContent": "{\"deckUrl\":\"https://docs.google.com/presentation/d/mock-capability\"}"
    },
    {
      "id": "int-touch4-001",
      "dealId": "deal-001",
      "touchType": "touch_4",
      "status": "completed",
      "hitlStage": "ready",
      "stageContent": "{\"deckUrl\":\"...\",\"talkTrackUrl\":\"...\",\"faqUrl\":\"...\"}"
    }
  ]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed mockStage enum | `z.string()` for arbitrary stage names | Phase 67 | Enables refine-*, manual-upload, compliance-*, etc. without schema changes |
| Hardcoded mock responses | Stage-aware fixture loading | Phase 63 | Stage files override base fixtures per endpoint |
| Per-tutorial capture code | Generic capture loop | Phase 62 | New tutorials need only script.json + fixtures |

## Open Questions

1. **Exact deal name for "Meridian Health Partnership"**
   - What we know: Shared fixtures use company "Meridian Dynamics" and deal "Q2 Digital Transformation Initiative" on deal-001. CONTEXT.md says "Meridian Health Partnership."
   - What's unclear: Whether the deal name in shared fixtures should change, or the CONTEXT.md name is just a narrative reference.
   - Recommendation: Keep existing shared fixture data (Meridian Dynamics / Q2 Digital Transformation Initiative) since Phase 67/68 already captured tutorials with it. The "Meridian Health Partnership" reference in CONTEXT is likely informal -- use what's in the fixtures for consistency.

2. **Asset review page route for queue view vs. single artifact**
   - What we know: The asset-review page takes a single interactionId: `/deals/[dealId]/asset-review/[interactionId]`. TUT-17 wants to show artifacts from ALL 4 touches.
   - What's unclear: Whether there's a queue/list view or if the tutorial navigates between 4 different asset-review URLs.
   - Recommendation: Script should navigate to each touch's asset-review URL sequentially (4 different interactionIds), showing the review queue as a narrative progression rather than a single page. Alternatively, if the touch page shows completed artifacts with review links, start there.

3. **Mock server modification scope**
   - What we know: Asset review route needs stage-awareness. Touch workflow routes already support all needed operations (start, run status, resume, regenerate-stage).
   - What's unclear: Whether any other routes need stage-aware extensions for the new tutorials.
   - Recommendation: Modify only the asset-review GET route. All other routes already handle stage transitions via the existing infrastructure. If additional needs surface during implementation, extend incrementally.

## Sources

### Primary (HIGH confidence)
- `apps/tutorials/capture/touch-4-hitl.spec.ts` -- existing capture spec, verified pattern
- `apps/tutorials/fixtures/touch-4-hitl/` -- existing fixture structure with 6 stages
- `apps/tutorials/src/types/tutorial-script.ts` -- StepSchema with all supported fields
- `apps/tutorials/fixtures/types.ts` -- FixtureSet, StageFixture, Sequence schemas
- `apps/tutorials/fixtures/loader.ts` -- loadFixtures, loadStageFixtures, loadSequences
- `apps/tutorials/scripts/mock-server.ts` -- all mock routes including asset-review
- `apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/page.tsx` -- touch page server component
- `apps/web/src/app/(authenticated)/deals/[dealId]/asset-review/[interactionId]/page.tsx` -- asset review page
- `apps/web/src/lib/api-client.ts` -- AssetReviewData interface (lines 825-847)
- `apps/web/src/components/touch/hitl-stage-stepper.tsx` -- HITL_STAGES: skeleton, lowfi, highfi

### Secondary (MEDIUM confidence)
- Phase 68 CONTEXT.md -- cross-referenced for deal/fixture continuity decisions
- Phase 67/68 patterns -- consistent plan structure (Plan 01 = scripts/fixtures/capture, Plan 02 = TTS/render)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all dependencies already installed and verified
- Architecture: HIGH -- patterns fully established in Phases 62-68 with working examples
- Pitfalls: HIGH -- identified from direct code inspection of mock server, fixtures, and web app routes
- Content scope: MEDIUM -- step counts and fixture content details are estimates based on CONTEXT.md guidance

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable -- infrastructure is frozen, only content changes)
