# Phase 67: Low-Complexity Tutorials - Research

**Researched:** 2026-03-19
**Domain:** Tutorial content authoring (scripts, fixtures, capture specs) on existing infrastructure
**Confidence:** HIGH

## Summary

Phase 67 is a pure content-authoring phase. All infrastructure is built (Phases 62-66): capture engine, mock server, TTS pipeline, Remotion composition with visual effects, and the render pipeline. This phase creates three introductory tutorials by authoring script JSON files, fixture overrides, and Playwright capture specs -- then running the existing pipelines to produce MP4s.

The primary technical risk is **mock server gaps** for the new routes these tutorials need. The Getting Started tutorial already has a working pilot (8-step script with validated selectors), but Google Drive Settings requires `user-settings` API routes that are missing from the mock server, and Action Center needs the `/actions` mock route to return realistic error-state fixture data instead of empty arrays. The secondary risk is the Google Drive Picker component (`DriveFolderPicker`) which depends on Google's `@googleworkspace/drive-picker-react` -- this cannot render in a mocked environment and will need browser-side route interception or a capture workaround.

**Primary recommendation:** Split into two plans: Plan 01 handles Getting Started refinement + Google Drive Settings (both simple navigation tutorials), Plan 02 handles Action Center (requires stage-switching for before/after resolution flows). Each plan authors scripts, fixtures, capture specs, then runs capture + TTS + render.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Getting Started (TUT-01): Keep as broad tour, ~8-10 steps. Quick orientation of dashboard, deals, templates, settings, integrations. Refine existing 8-step pilot script in place (update narration, add zoom/callout/cursor fields) -- do not regenerate from scratch
- Google Drive Settings (TUT-02): Happy path only, 5-7 steps. Start from unconfigured state (no folder selected), walk through selecting root folder, verifying access, confirming save. Error recovery lives in Action Center tutorial
- Action Center (TUT-03): Cover all issue types the system can surface (OAuth expired, Drive sharing issue, missing access). Show full before-and-after resolution flow using mockStage/sequence switching -- issue present -> click resolve -> show resolved state
- All 3 tutorials share the same fictional company from existing shared fixtures (users.json, companies.json, deals.json)
- Per-tutorial override files for specific needs: Action Center gets error state fixtures, Google Drive Settings gets unconfigured state
- Error state fixtures must be realistic -- mimic actual error payloads the app would receive
- Warmer intro tone for Getting Started. Google Drive Settings and Action Center shift to normal conversational pace
- Light cross-references to other tutorials
- Getting Started ends with open-ended exploration, does NOT direct to next tutorial
- Slightly longer holds (~1s extra) on first-time UI reveals
- Zoom effects on key moments only (~30-40% of steps)
- Selective callouts (~20-30% of steps)
- Cursor appears on ALL click/hover steps
- No "Next: [Tutorial Name]" on outro slates

### Claude's Discretion
- Exact step count per tutorial (within the ranges above)
- Which specific steps get zoom, callouts, and cursor targets
- Callout text and positioning
- Zoom scale overrides per step (default 1.5x from Phase 66)
- Action Center issue types to include (based on what the component actually supports)
- Fixture structure for Drive unconfigured state and Action Center error states

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TUT-01 | "Getting Started" tutorial -- sign in, initial setup, navigating the UI | Existing 8-step pilot script at `fixtures/getting-started/script.json` with validated selectors; refine narration, add zoom/callout/cursor fields per StepSchema |
| TUT-02 | "Google Drive Settings" tutorial -- select root folder, verify access | Web route at `/settings/drive`; needs mock server `user-settings` routes + unconfigured state overrides; DriveFolderPicker uses Google Picker API (requires capture workaround) |
| TUT-03 | "Action Center" tutorial -- resolve integration issues (OAuth, sharing, access) | Web route at `/actions`; ActionsClient renders 5 action types (reauth_needed, share_with_sa, drive_access, atlus_account_required, atlus_project_required); needs stage-based fixture switching for before/after resolution |

</phase_requirements>

## Standard Stack

### Core (all existing -- no new dependencies)
| Library | Version | Purpose | Already Installed |
|---------|---------|---------|-------------------|
| Playwright | (existing) | Capture screenshots per tutorial step | Yes |
| Remotion | 4.0.x | Compose screenshots + audio into MP4 | Yes |
| kokoro-js / Chatterbox | (existing) | TTS narration generation | Yes |
| Express | (existing) | Mock agent server for SSR API calls | Yes |
| Zod | (existing) | Script + fixture validation | Yes |

### No new installations needed
This phase is purely content authoring using existing infrastructure.

## Architecture Patterns

### Recommended File Structure (per new tutorial)
```
apps/tutorials/
  fixtures/
    google-drive-settings/
      script.json            # 5-7 step tutorial script
      overrides.json         # Unconfigured Drive state fixtures
    action-center/
      script.json            # 7-10 step tutorial script
      overrides.json         # Error state action items
      stages/
        errors.json          # Stage: active error items
        resolved.json        # Stage: all items resolved
  capture/
    google-drive-settings.spec.ts
    action-center.spec.ts
```

### Pattern 1: Script JSON Authoring
**What:** Each tutorial is defined by a `script.json` following TutorialScriptSchema
**When to use:** Every tutorial follows this pattern
**Key fields per step:**
```json
{
  "id": "step-001",
  "url": "/settings/drive",
  "narration": "Conversational text...",
  "waitFor": "h2",
  "actions": [{ "type": "hover", "selector": "main" }],
  "zoomTarget": { "selector": "main", "scale": 1.5, "x": 0.5, "y": 0.4 },
  "callout": { "text": "Label text", "x": 0.5, "y": 0.3 },
  "cursorTarget": { "x": 0.5, "y": 0.5 },
  "mockStage": "errors",
  "emotion": "cheerful",
  "delayMs": 1000
}
```

### Pattern 2: Generic Capture Loop (reuse existing)
**What:** Capture specs follow the exact pattern from `getting-started.spec.ts`
**Structure:** Load script -> beforeEach sets auth + browser mocks -> test iterates steps -> navigate, wait, act, capture
**Key:** The loop is fully generic. New tutorials only change TUTORIAL_ID and script.json.

### Pattern 3: Stage-Based Fixture Switching (Action Center)
**What:** Use `mockStage` on steps to switch mock server state between "error" and "resolved"
**How it works:**
1. Step has `mockStage: "errors"` -- capture loop POSTs to `/mock/set-stage`
2. Mock server's `/actions` route checks `currentStage` and returns stage-specific fixtures
3. Next step has `mockStage: "resolved"` -- mock server now returns resolved/empty state
**Requires:** Stage fixture files at `fixtures/action-center/stages/errors.json` and `stages/resolved.json`
**Also requires:** Mock server `/actions` route to be stage-aware (currently returns hardcoded empty array)

### Anti-Patterns to Avoid
- **Re-generating Getting Started from scratch:** The existing 8-step script has validated selectors from Phase 62/66 work. Refine in place.
- **Mocking the Google Drive Picker popup:** The DriveFolderPicker renders a Google Picker iframe that cannot work in mocked environment. Instead, capture the Drive settings page in "not configured" and "configured" states via fixture switching -- do NOT attempt to click the picker button.
- **Hardcoding fixture data in capture specs:** All data belongs in fixture JSON files. Capture specs should only reference TUTORIAL_ID.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Capture automation | Custom screenshot logic | Existing generic capture loop in `getting-started.spec.ts` | Already handles navigation, waiting, actions, stage switching |
| TTS generation | New TTS code | `pnpm --filter tutorials tts <tutorial-name>` | Pipeline handles audio gen + timing manifests |
| Video rendering | New composition code | `pnpm --filter tutorials render <tutorial-name>` | Remotion compositions handle all visual effects |
| Fixture loading | Manual JSON reading | `loadFixtures(tutorialId)` from `fixtures/loader.ts` | Handles shared + override merging with validation |
| Stage switching | Custom mock logic | `mockStage` field on steps + `/mock/set-stage` endpoint | Already built in Phase 63 |

## Common Pitfalls

### Pitfall 1: Missing Mock Server Routes for Drive Settings
**What goes wrong:** Google Drive Settings page calls Server Actions that hit `user-settings/{userId}/drive_root_folder_id` and `drive_root_folder_name` routes. These routes DO NOT EXIST in the mock server.
**Why it happens:** Phase 62 mock server covers all api-client.ts routes but settings-actions.ts hits additional user-settings endpoints.
**How to avoid:** Add `GET /user-settings/:userId/:key` and `PUT /user-settings/:userId/:key` routes to mock-server.ts. For unconfigured state, return `{ value: null }`. For configured state (stage fixture), return the folder values.
**Warning signs:** Drive settings page shows "Loading settings..." forever or throws in SSR.

### Pitfall 2: DriveFolderPicker Cannot Work in Mock Environment
**What goes wrong:** The DriveFolderPicker component opens a Google Picker iframe that requires real Google OAuth tokens and a valid Google API key.
**Why it happens:** The Picker is a Google-hosted widget, not something that can be intercepted by page.route().
**How to avoid:** Do NOT attempt to interact with the picker. Instead use two approaches:
1. Capture the "unconfigured" state (shows "Not configured" / "Choose Folder" button)
2. Use fixture switching to show the "configured" state (folder already selected) without clicking the picker
The tutorial narration should say something like "Click Choose Folder to open the Google Drive picker" while showing the button, then transition to a configured state.

### Pitfall 3: Action Center Empty State in Default Mock
**What goes wrong:** The mock server's `/actions` route returns an empty array `[]`, so the Action Center page shows "No actions required" with a green checkmark.
**Why it happens:** The default mock was built for tutorials where actions aren't relevant.
**How to avoid:** Two options:
1. Make the `/actions` route stage-aware (like `/deals/:dealId/interactions`)
2. Use per-tutorial overrides that change what `/actions` returns
Recommended: Make `/actions` stage-aware so Action Center tutorial can show errors -> resolved flow.

### Pitfall 4: Actions Page Uses Server-Side Data Loading
**What goes wrong:** The Actions page is a Server Component that calls `listActionsAction()` at SSR time. This calls `fetchActions(userId)` which hits the mock server's `/actions` endpoint.
**Why it happens:** Server Actions go through the mock server (not page.route()). The response at SSR time determines initial render.
**How to avoid:** The mock server must return the correct actions based on `currentStage` at the time the page loads. Set the stage BEFORE navigating to `/actions`.

### Pitfall 5: Getting Started Narration Accuracy
**What goes wrong:** Narration describes UI elements that don't match what's actually rendered with the fixture data.
**Why it happens:** Phase 66 Plan 03 specifically fixed this pattern -- narration must match real UI.
**How to avoid:** After capture, visually verify each screenshot matches its narration. The existing script was validated but zoom/callout additions may reference specific elements that need checking.

## Code Examples

### Example 1: New Capture Spec (follows existing pattern exactly)
```typescript
// capture/google-drive-settings.spec.ts
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

const TUTORIAL_ID = "google-drive-settings";
// ... rest follows getting-started.spec.ts pattern exactly
```

### Example 2: Stage-Aware /actions Mock Route Enhancement
```typescript
// In mock-server.ts, replace the hardcoded empty /actions handler:
app.get("/actions", (_req: Request, res: Response) => {
  const stageFixtures = loadStageFixtures(tutorialName, currentStage);
  if (stageFixtures && (stageFixtures as Record<string, unknown>).actions) {
    res.json((stageFixtures as Record<string, unknown>).actions);
  } else {
    res.json(fixtures.actions ?? []);
  }
});
```

### Example 3: Action Center Error Fixtures Shape
```json
// fixtures/action-center/stages/errors.json
{
  "actions": [
    {
      "id": "action-001",
      "userId": "00000000-0000-0000-0000-000000000001",
      "actionType": "reauth_needed",
      "title": "Google OAuth Token Expired",
      "description": "Your Google connection has expired. Re-authenticate to continue generating decks.",
      "resourceId": null,
      "resourceName": null,
      "resolved": false,
      "resolvedAt": null,
      "silenced": false,
      "seenAt": null,
      "createdAt": "2026-03-18T10:00:00.000Z",
      "updatedAt": "2026-03-18T10:00:00.000Z"
    }
  ]
}
```

### Example 4: User-Settings Mock Route (missing, must be added)
```typescript
// Add to mock-server.ts
const userSettings: Record<string, Record<string, string | null>> = {};

app.get("/user-settings/:userId/:key", (req: Request, res: Response) => {
  const { userId, key } = req.params;
  // Stage-aware: check stage fixtures for Drive settings state
  const stageFixtures = loadStageFixtures(tutorialName, currentStage);
  const stageSettings = (stageFixtures as Record<string, unknown>)?.userSettings as Record<string, string | null> | undefined;
  if (stageSettings && key in stageSettings) {
    res.json({ value: stageSettings[key] });
    return;
  }
  const val = userSettings[userId]?.[key] ?? null;
  res.json({ value: val });
});

app.put("/user-settings/:userId/:key", (req: Request, res: Response) => {
  const { userId, key } = req.params;
  if (!userSettings[userId]) userSettings[userId] = {};
  userSettings[userId][key] = req.body?.value ?? null;
  res.json({ value: userSettings[userId][key] });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded capture scripts | Generic capture loop driven by JSON | Phase 62 | New tutorials only need script.json |
| Manual fixture setup | loadFixtures with shared + overrides | Phase 62 | Consistent data across tutorials |
| Static mock responses | Stage-aware mock server | Phase 63 | Enables before/after state transitions |
| No visual effects | Zoom, callout, cursor, transitions | Phase 66 | Scripts now include effect metadata |

## Open Questions

1. **DriveFolderPicker visual state**
   - What we know: The picker button renders as "Choose Folder" when unconfigured. The actual picker popup cannot be mocked.
   - What's unclear: Whether to capture a "loading" intermediate state or just show unconfigured -> configured via stage switch
   - Recommendation: Show unconfigured state, narrate "Click Choose Folder", then cut to configured state via stage/fixture switch. This is honest about the tutorial's capabilities.

2. **Action Center issue types to include**
   - What we know: The component supports 5 types: `reauth_needed`, `share_with_sa`, `drive_access`, `atlus_account_required`, `atlus_project_required`
   - What's unclear: Whether all 5 should appear simultaneously or be shown in groups
   - Recommendation: Show 3 most relevant (reauth_needed, share_with_sa, drive_access) as simultaneous issues. The Atlus types are less common for first-time users. Mention them in narration if desired.

3. **Actions `/actions/count` route for sidebar badge**
   - What we know: The sidebar likely shows an action count badge via `/actions/count`. This needs to be stage-aware too.
   - What's unclear: Whether the badge affects screenshot quality significantly
   - Recommendation: Make `/actions/count` stage-aware alongside `/actions` route. Return correct count for current stage.

## Mock Server Gaps Summary

These routes must be added/modified before tutorials can capture:

| Route | Current State | Needed State |
|-------|--------------|--------------|
| `GET /user-settings/:userId/:key` | Missing | Returns `{ value: null }` default, stage-aware for configured state |
| `PUT /user-settings/:userId/:key` | Missing | Stores value in-memory |
| `GET /actions` | Returns `[]` | Stage-aware: returns error fixtures when stage="errors" |
| `GET /actions/count` | Returns `{ count: 0 }` | Stage-aware: returns count matching stage fixture |
| `GET /actions` (override via fixtures) | N/A | Needs `actions` field added to FixtureSet or handled via stage passthrough |

## Validation Architecture

> Config does not explicitly set nyquist_validation to false; treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (capture specs as functional tests) |
| Config file | `apps/tutorials/playwright.config.ts` |
| Quick run command | `pnpm --filter tutorials capture <tutorial-name>` |
| Full suite command | `pnpm --filter tutorials capture getting-started && pnpm --filter tutorials capture google-drive-settings && pnpm --filter tutorials capture action-center` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TUT-01 | Getting Started captures 8-10 screenshots + renders MP4 | smoke | `pnpm --filter tutorials capture getting-started` | Exists (refine) |
| TUT-02 | Google Drive Settings captures 5-7 screenshots + renders MP4 | smoke | `pnpm --filter tutorials capture google-drive-settings` | Wave 0 |
| TUT-03 | Action Center captures 7-10 screenshots + renders MP4 | smoke | `pnpm --filter tutorials capture action-center` | Wave 0 |

### Sampling Rate
- **Per task commit:** Capture the tutorial being authored and verify screenshot count
- **Per wave merge:** Run all three captures and verify MP4 output exists
- **Phase gate:** All three tutorials render as MP4 with correct step counts

### Wave 0 Gaps
- [ ] `capture/google-drive-settings.spec.ts` -- covers TUT-02
- [ ] `capture/action-center.spec.ts` -- covers TUT-03
- [ ] `fixtures/google-drive-settings/script.json` -- tutorial script
- [ ] `fixtures/google-drive-settings/overrides.json` -- unconfigured Drive state
- [ ] `fixtures/action-center/script.json` -- tutorial script
- [ ] `fixtures/action-center/overrides.json` -- error state action items
- [ ] `fixtures/action-center/stages/errors.json` -- before-resolution state
- [ ] `fixtures/action-center/stages/resolved.json` -- after-resolution state
- [ ] Mock server routes: `user-settings`, stage-aware `actions` + `actions/count`

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `apps/tutorials/` infrastructure (capture specs, mock server, fixtures, types)
- Direct code inspection of `apps/web/src/app/(authenticated)/actions/` (ActionsClient component, action types)
- Direct code inspection of `apps/web/src/app/(authenticated)/settings/drive/` (DriveSettingsPage, DriveFolderPicker)
- Direct code inspection of `apps/web/src/lib/actions/settings-actions.ts` (user-settings API routes)
- Direct code inspection of `apps/web/src/lib/api-client.ts` (ActionRequiredItem interface)
- Phase 62-66 decisions from STATE.md

### Secondary (MEDIUM confidence)
- Drive Picker behavior inference (Google hosted widget cannot be mocked in Playwright)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all infrastructure exists
- Architecture: HIGH - established patterns from Phases 62-66, just needs replication
- Pitfalls: HIGH - identified through direct code inspection of mock server gaps and component dependencies

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable -- content authoring on frozen infrastructure)
