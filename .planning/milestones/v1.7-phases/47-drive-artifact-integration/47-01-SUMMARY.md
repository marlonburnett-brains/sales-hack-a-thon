---
phase: 47-drive-artifact-integration
plan: 01
subsystem: database, api, auth
tags: [prisma, google-drive, oauth, drive-api, permissions]

# Dependency graph
requires:
  - phase: 22-google-token-storage
    provides: encrypted per-user Google refresh tokens for Drive API calls
provides:
  - UserSetting Prisma model for per-user key-value preferences
  - resolveRootFolderId function (UserSetting -> env fallback)
  - shareWithOrg function (domain-wide + owner editor permissions)
  - getOrCreateSubfolder function (generic idempotent subfolder creation)
  - archiveExistingFile function (move file to Archive subfolder)
  - OAuth scope upgraded to full Drive access (auth/drive)
  - GOOGLE_DRIVE_FOLDER_ID made optional in env.ts
affects: [47-02-settings-ui, 47-03-workflow-migration, 47-04-picker-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [user-setting-kv-store, org-scoped-drive-sharing, archive-before-overwrite]

key-files:
  created:
    - apps/agent/prisma/migrations/20260309000100_add_user_setting/migration.sql
  modified:
    - apps/agent/prisma/schema.prisma
    - apps/agent/src/lib/drive-folders.ts
    - apps/agent/src/env.ts
    - apps/web/src/app/login/page.tsx
    - apps/web/src/app/(authenticated)/actions/actions-client.tsx
    - apps/web/src/components/user-nav.tsx

key-decisions:
  - "Used manual migration + resolve --applied for UserSetting due to existing DB drift"
  - "OAuth scope upgraded to full drive (not drive.readonly) for folder creation and permission management"
  - "makePubliclyViewable kept as deprecated export until Plan 03 migrates all call sites"

patterns-established:
  - "UserSetting KV store: @@unique([userId, key]) for per-user preferences"
  - "Org-scoped sharing: domain viewer + owner editor + sendNotificationEmail: false"

requirements-completed: [DRIVE-02, DRIVE-03]

# Metrics
duration: 4min
completed: 2026-03-08
---

# Phase 47 Plan 01: Drive Foundation Summary

**UserSetting Prisma model, org-scoped Drive sharing, root folder resolution, archive utility, and OAuth scope upgrade from drive.readonly to drive**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-08T23:12:40Z
- **Completed:** 2026-03-08T23:16:40Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- UserSetting model with @@unique([userId, key]) for per-user Drive root folder overrides
- 4 new drive-folders.ts exports: resolveRootFolderId, shareWithOrg, getOrCreateSubfolder, archiveExistingFile
- OAuth scope upgraded from drive.readonly to drive in all 3 login/reconnect paths
- GOOGLE_DRIVE_FOLDER_ID made optional so users can rely on UserSetting instead

## Task Commits

Each task was committed atomically:

1. **Task 1: UserSetting Prisma model and migration** - `e8c649e` (feat)
2. **Task 2: Drive utility functions, env.ts update, and OAuth scope upgrade** - `a6bba0c` (feat)

## Files Created/Modified
- `apps/agent/prisma/schema.prisma` - Added UserSetting model
- `apps/agent/prisma/migrations/20260309000100_add_user_setting/migration.sql` - Forward-only migration
- `apps/agent/src/lib/drive-folders.ts` - 4 new exports + prisma import
- `apps/agent/src/env.ts` - GOOGLE_DRIVE_FOLDER_ID now z.string().default('')
- `apps/web/src/app/login/page.tsx` - OAuth scope: drive.readonly -> drive
- `apps/web/src/app/(authenticated)/actions/actions-client.tsx` - Same scope upgrade
- `apps/web/src/components/user-nav.tsx` - Same scope upgrade

## Decisions Made
- Used manual migration + resolve --applied for UserSetting due to existing DB drift (consistent with Phases 41, 43, 45, 46)
- OAuth scope upgraded to full drive (not drive.readonly) for folder creation and permission management
- makePubliclyViewable kept as deprecated export until Plan 03 migrates all call sites

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Prisma migrate dev blocked by DB drift (DeckStructure.artifactType and Template.artifactType columns removed in DB but present in migration history). Resolved with manual SQL migration + resolve --applied pattern per CLAUDE.md.

## User Setup Required

Users must sign out and sign back in to get the upgraded OAuth scope (auth/drive instead of auth/drive.readonly). Existing refresh tokens with the old scope will not have write access to Drive.

## Next Phase Readiness
- All 4 new drive-folders.ts functions ready for Plan 02 (Settings UI) and Plan 03 (workflow migration)
- UserSetting model available for Drive root folder picker in Plan 02
- OAuth scope upgrade enables Picker API and folder creation in Plan 04

---
*Phase: 47-drive-artifact-integration*
*Completed: 2026-03-08*
