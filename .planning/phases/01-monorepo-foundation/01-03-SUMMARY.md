---
phase: 01-monorepo-foundation
plan: "03"
subsystem: infra
tags: [google-slides, google-drive, googleapis, service-account, batchUpdate, spike]

# Dependency graph
requires:
  - phase: 01-01
    provides: apps/agent skeleton with all npm dependencies installed (googleapis, @t3-oss/env-core)
  - phase: 01-02
    provides: getSlidesClient(), getDriveClient(), verifyGoogleAuth() factory functions and T3 Env validation
provides:
  - apps/agent/src/spike/slides-spike.ts: Runnable spike demonstrating copy-template + read-live-objectIds + batchUpdate pattern
  - Validated Google service account auth flow against live Lumenalta Drive and Slides APIs
  - Confirmed objectId format for Lumenalta template elements (g35b593a0db0_0_XXXX style)
  - Confirmed template uses generic shapes (placeholder type: none) not TITLE/BODY typed placeholders
  - Confirmed supportsAllDrives: true required for Shared Drive file.copy operations
  - Confirmed insertText at index 0 with dynamic objectId works end-to-end
affects: [07-slides, 08-output, 04-touch1-3]

# Tech tracking
tech-stack:
  added:
    - tsx (devDependency in apps/agent — required to run TypeScript spike without compile step)
  patterns:
    - Spike pattern: copy template -> presentations.get (read live objectIds) -> batchUpdate (never hardcode IDs)
    - supportsAllDrives: true required on all Drive API calls targeting Shared Drive folders
    - Service account must be shared directly on the target file or its Shared Drive (folder inheritance alone may not propagate)

key-files:
  created:
    - apps/agent/src/spike/slides-spike.ts (full copy + read objectIds + batchUpdate demonstration)
  modified:
    - apps/agent/.env (populated with real GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_DRIVE_FOLDER_ID, GOOGLE_TEMPLATE_PRESENTATION_ID — gitignored, not committed)

key-decisions:
  - "objectIds are Google-generated (g35b593a0db0_0_XXXX format) — never hardcode; always read from presentations.get response"
  - "Lumenalta template uses generic shapes (placeholder.type = none) not semantic placeholders (TITLE/BODY) — selection must be by objectId or element inspection, not by placeholder type"
  - "supportsAllDrives: true is mandatory on files.copy when the target folder is a Shared Drive — omitting it causes silent 404"
  - "Service account requires direct file share on the template (not just folder-level access) OR must own the copy destination"

patterns-established:
  - "Read-before-write: always call presentations.get and extract objectIds before any batchUpdate — no hardcoded IDs anywhere in production code"
  - "Shared Drive pattern: all Drive API calls use supportsAllDrives: true; service account is added as Editor on each file that needs to be accessible"

requirements-completed: []

# Metrics
duration: 45min
completed: 2026-03-03
---

# Phase 1 Plan 03: Google Slides API Spike Summary

**Google Slides API de-risked: service account authenticates, copies Lumenalta template to Shared Drive, reads live g35b593a0db0_0_XXXX objectIds, and inserts text via batchUpdate — template uses generic shapes (no TITLE/BODY placeholders)**

## Performance

- **Duration:** ~45 min (including credential setup checkpoint)
- **Started:** 2026-03-03T18:00:00Z
- **Completed:** 2026-03-03T18:45:00Z
- **Tasks:** 2 automated (plus 2 checkpoint gates)
- **Files modified:** 2

## Accomplishments

- Google service account authenticated successfully against live Google Slides and Drive APIs
- Lumenalta branded template (11 slides) copied to shared Lumenalta Drive folder via files.copy with supportsAllDrives: true
- Live objectIds read from presentations.get response — no IDs hardcoded anywhere in spike script
- batchUpdate with insertText at index 0 executed successfully using dynamically-read objectId
- Confirmed Slide 1 has 5 text elements; all use placeholder type "none" (generic shapes, not TITLE/BODY typed placeholders)
- Confirmed element objectId format is Google-generated: g35b593a0db0_0_XXXX style (not p4_i0 shorthand)

## Task Commits

Each task was committed atomically:

1. **Pre-gate: Write spike script** - `d8ca9dd` (feat)
2. **Task 2: Run spike successfully** - verified via terminal output (no additional commit — script pre-existed)
3. **Task 3: Human verify spike output** - "spike verified" by user

**Plan metadata:** `[pending]` (docs: complete plan)

## Key Findings

### Element objectId Format

The live Lumenalta template returns Google-generated objectIds in the format `g35b593a0db0_0_XXXX` (e.g., `g35b593a0db0_0_5`, `g35b593a0db0_0_10`). These are opaque, template-specific, and will differ from any development copy. **Production code must never hardcode these values.**

### Template Structure: Generic Shapes, Not Typed Placeholders

All elements on the Lumenalta template slides return `placeholder.type = "none"` (or the placeholder field is absent). The template was not built using Google Slides' semantic placeholder slots (TITLE, SUBTITLE, BODY). This means:

- Phase 7/8 slide assembly cannot use `getPlaceholderIdByType` utilities that filter by placeholder type
- Element selection must be done by inspecting element order, text content, or shape position from the presentations.get response
- The `insertText` batchUpdate request works correctly on generic shape elements

### Drive Folder Sharing Pattern

The pattern that worked: the service account's `client_email` was added as Editor directly on the Shared Drive folder. The `files.copy` call must include `supportsAllDrives: true` — omitting this flag causes the API to return a 404 even when credentials are otherwise correct.

Key constraint for production: the service account must either be an Editor on the destination Shared Drive folder, or the destination must be the service account's own "My Drive". Folder-level permissions in a Shared Drive may not automatically propagate to newly copied files — direct file sharing may be required for template read access.

### batchUpdate Ordering: No Pitfalls Encountered

A single `insertText` request at `insertionIndex: 0` executed without error. No ordering pitfalls were encountered in this spike (single-request batch). Multi-request batches (e.g., delete-then-insert sequences) should be tested in Phase 7/8 development.

## Files Created/Modified

- `apps/agent/src/spike/slides-spike.ts` - Runnable spike: verifyGoogleAuth -> files.copy (supportsAllDrives: true) -> presentations.get (read objectIds) -> batchUpdate (insertText with dynamic objectId). Logs full slide element inventory to console.
- `apps/agent/.env` - Populated with real credentials (GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_DRIVE_FOLDER_ID, GOOGLE_TEMPLATE_PRESENTATION_ID, DATABASE_URL, NODE_ENV, MASTRA_PORT). Gitignored — not committed.

## Decisions Made

- **objectIds must always be dynamic**: The g35b593a0db0_0_XXXX format confirms that template element IDs are Google-generated and unpredictable. Phase 7/8 must always call presentations.get first and extract IDs from the response before any batchUpdate.
- **Generic shapes require positional/content-based selection**: Since all elements return placeholder type "none", Phase 7/8 slide assembly must identify target elements by their order in pageElements, text content inspection, or bounding box position — not by semantic placeholder type.
- **supportsAllDrives: true is non-negotiable**: All Drive API calls in production code that target Shared Drive resources must include this flag.
- **tsx added as devDependency**: The spike required a way to run TypeScript directly. tsx was added to apps/agent devDependencies; this does not affect production builds.

## Deviations from Plan

None - plan executed exactly as written. The human-action checkpoint for credential setup and the human-verify checkpoint for spike output both completed as specified.

## Issues Encountered

- Drive sharing: The service account required direct Editor access on the Shared Drive folder. The spike confirmed that `supportsAllDrives: true` must be present on all Shared Drive operations; without it, the API silently returns a 404. This is a known googleapis v3 requirement, not a bug — it is now documented and established as a pattern for all downstream Drive code.

## User Setup Required

Google credentials were provisioned during the human-action checkpoint (pre-gate task). The following were configured in apps/agent/.env (gitignored):
- `GOOGLE_SERVICE_ACCOUNT_KEY` — full JSON as single-line string from Google Cloud Console
- `GOOGLE_DRIVE_FOLDER_ID` — ID of shared Lumenalta Drive folder
- `GOOGLE_TEMPLATE_PRESENTATION_ID` — ID of Lumenalta branded presentation template

Additionally: the service account's `client_email` was added as Editor on the shared Lumenalta Drive folder via Drive UI.

## Next Phase Readiness

Phase 1 is now complete. All five Phase 1 success criteria are verified:

1. `turbo run dev` starts both apps — verified by 01-01
2. Service account authenticates and creates files in shared Drive — verified by this spike
3. Slides API spike duplicates template + inserts text using live objectIds — verified by this spike
4. Prisma migrations run cleanly — verified by 01-02
5. Env var validation rejects startup on missing vars — verified by 01-02

Phase 7 (RAG Retrieval) and Phase 8 (Google Workspace Output Generation) can proceed with these confirmed patterns:
- Always call presentations.get, never hardcode objectIds
- Lumenalta template uses generic shapes — select elements by position/content, not by placeholder type
- All Drive API calls targeting Shared Drive must use supportsAllDrives: true
- batchUpdate with insertText works correctly on generic shape elements

## Self-Check: PASSED

- `apps/agent/src/spike/slides-spike.ts` exists on disk (committed at d8ca9dd)
- Spike ran successfully (user verified: "spike verified")
- No hardcoded objectIds in spike script — all IDs read from presentations.get response

---
*Phase: 01-monorepo-foundation*
*Completed: 2026-03-03*
