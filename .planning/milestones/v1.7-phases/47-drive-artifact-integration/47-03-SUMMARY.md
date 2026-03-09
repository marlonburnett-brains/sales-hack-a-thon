---
phase: 47-drive-artifact-integration
plan: 03
subsystem: api, workflows, ui
tags: [google-drive, org-sharing, archive, workflows, hitl, drive-status]

# Dependency graph
requires:
  - phase: 47-drive-artifact-integration
    provides: resolveRootFolderId, shareWithOrg, archiveExistingFile, getOrCreateSubfolder functions and UserSetting model
provides:
  - All 5 workflows migrated from env var to per-user Drive folder resolution
  - Org-scoped sharing replaces public sharing across all file creation
  - Archive-on-regeneration for all touch types and pre-call
  - Drive status badge on touch pages with artifact links
  - makePubliclyViewable fully removed from codebase
affects: [47-04-picker-integration, 47-05-e2e-testing]

# Tech tracking
tech-stack:
  added: []
  patterns: [user-rooted-drive-folders, archive-before-regeneration, drive-status-badge]

key-files:
  created: []
  modified:
    - apps/agent/src/mastra/workflows/touch-1-workflow.ts
    - apps/agent/src/mastra/workflows/touch-2-workflow.ts
    - apps/agent/src/mastra/workflows/touch-3-workflow.ts
    - apps/agent/src/mastra/workflows/touch-4-workflow.ts
    - apps/agent/src/mastra/workflows/pre-call-workflow.ts
    - apps/agent/src/mastra/index.ts
    - apps/agent/src/lib/deck-assembly.ts
    - apps/agent/src/lib/deck-customizer.ts
    - apps/agent/src/lib/slide-assembly.ts
    - apps/agent/src/lib/doc-builder.ts
    - apps/agent/src/lib/drive-folders.ts
    - apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx

key-decisions:
  - "Ingestion calls (ingestDocument, ingestGeneratedDeck) keep env.GOOGLE_DRIVE_FOLDER_ID for content library access per anti-pattern warning"
  - "Library files call shareWithOrg({ fileId }) for domain sharing; workflows add ownerEmail for editor access"
  - "Archive-on-regeneration is non-blocking (try/catch with warn log) to avoid failing workflows on archive errors"
  - "Local makePubliclyViewable copy in deck-customizer.ts removed and replaced with shared shareWithOrg import"

patterns-established:
  - "User-rooted folders: resolveRootFolderId(deal.ownerId) replaces env.GOOGLE_DRIVE_FOLDER_ID in all workflow getOrCreateDealFolder calls"
  - "Archive-before-create: check InteractionRecord for existing driveFileId, archive if found, then create new"
  - "Drive status badge: green saved + link when driveFileId set, blue spinner when pending"

requirements-completed: [DRIVE-01, DRIVE-02, DRIVE-03]

# Metrics
duration: 8min
completed: 2026-03-08
---

# Phase 47 Plan 03: Workflow Migration Summary

**All 5 workflows migrated from hardcoded env var to per-user Drive root folder, makePubliclyViewable fully replaced with org-scoped shareWithOrg, archive-on-regeneration added, and Drive status badge on touch pages**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-08T23:19:30Z
- **Completed:** 2026-03-08T23:28:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- All 5 workflows (touch-1 through touch-4 + pre-call) use resolveRootFolderId instead of env.GOOGLE_DRIVE_FOLDER_ID for parent folder resolution
- All 6 makePubliclyViewable call sites (4 libraries + mastra/index.ts + drive-folders.ts definition) replaced with shareWithOrg
- Archive-on-regeneration added to all workflows -- checks existing InteractionRecord.driveFileId before creating new files
- Touch pages show Drive save status with clickable links; Touch 4 displays all 3 artifact links (deck, talk track, FAQ)
- Local makePubliclyViewable duplicate in deck-customizer.ts removed

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate all workflows and library files from env var to user setting + org sharing** - `fabacfa` (feat)
2. **Task 2: Drive status indicator on touch pages** - `29d69ac` (feat)

## Files Created/Modified
- `apps/agent/src/lib/drive-folders.ts` - Removed deprecated makePubliclyViewable export
- `apps/agent/src/lib/deck-assembly.ts` - shareWithOrg replaces makePubliclyViewable
- `apps/agent/src/lib/deck-customizer.ts` - Removed local makePubliclyViewable, imports shareWithOrg from drive-folders
- `apps/agent/src/lib/slide-assembly.ts` - shareWithOrg replaces makePubliclyViewable
- `apps/agent/src/lib/doc-builder.ts` - shareWithOrg replaces makePubliclyViewable
- `apps/agent/src/mastra/index.ts` - shareWithOrg replaces makePubliclyViewable in deck upload route
- `apps/agent/src/mastra/workflows/touch-1-workflow.ts` - resolveRootFolderId + shareWithOrg + archiveExistingFile
- `apps/agent/src/mastra/workflows/touch-2-workflow.ts` - resolveRootFolderId + shareWithOrg + archiveExistingFile
- `apps/agent/src/mastra/workflows/touch-3-workflow.ts` - resolveRootFolderId + shareWithOrg + archiveExistingFile
- `apps/agent/src/mastra/workflows/touch-4-workflow.ts` - resolveRootFolderId + shareWithOrg + archiveExistingFile
- `apps/agent/src/mastra/workflows/pre-call-workflow.ts` - resolveRootFolderId + shareWithOrg + archiveExistingFile
- `apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx` - DriveStatusBadge component

## Decisions Made
- Ingestion calls (ingestDocument, ingestGeneratedDeck) keep env.GOOGLE_DRIVE_FOLDER_ID for content library access per the research anti-pattern warning
- Library files call shareWithOrg({ fileId }) for domain sharing only; workflows add ownerEmail for editor access where deal context is available
- Archive-on-regeneration is non-blocking (try/catch with warn log) to avoid failing workflows on archive errors
- Local makePubliclyViewable copy in deck-customizer.ts removed instead of kept as a separate concern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing env import in touch-4-workflow.ts**
- **Found during:** Task 1
- **Issue:** touch-4-workflow.ts referenced env.GOOGLE_DRIVE_FOLDER_ID without importing env (pre-existing bug)
- **Fix:** Replaced with resolveRootFolderId which doesn't need env import; env reference eliminated
- **Files modified:** apps/agent/src/mastra/workflows/touch-4-workflow.ts
- **Committed in:** fabacfa (Task 1 commit)

**2. [Rule 1 - Bug] Updated test mocks for new drive-folders exports**
- **Found during:** Task 1
- **Issue:** deal-chat-routes.test.ts mocked makePubliclyViewable which no longer exists
- **Fix:** Updated mock to include shareWithOrg, resolveRootFolderId, archiveExistingFile
- **Files modified:** apps/agent/src/mastra/__tests__/deal-chat-routes.test.ts
- **Committed in:** fabacfa (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. Users who have already signed in with the upgraded OAuth scope (from Plan 01) will automatically benefit from the new Drive folder resolution.

## Next Phase Readiness
- All workflows ready for Plan 04 (Drive folder picker integration)
- Drive status badge ready for Plan 05 (E2E testing)
- shareWithOrg and resolveRootFolderId fully integrated across the codebase

---
*Phase: 47-drive-artifact-integration*
*Completed: 2026-03-08*
