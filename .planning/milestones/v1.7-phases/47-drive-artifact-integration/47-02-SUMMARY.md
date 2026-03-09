---
phase: 47-drive-artifact-integration
plan: 02
subsystem: ui, api, auth
tags: [google-drive, google-picker, oauth, settings, react]

# Dependency graph
requires:
  - phase: 47-01
    provides: UserSetting Prisma model, token-cache system, OAuth scope upgrade
  - phase: 22-google-token-storage
    provides: encrypted per-user Google refresh tokens
provides:
  - /api/drive/token route for fresh Google access tokens
  - getDriveRootFolder/setDriveRootFolder server actions
  - DriveFolderPicker component with Google Picker integration
  - Settings > Drive page for folder configuration
  - Agent-side /tokens/access/:userId and /user-settings/:userId/:key routes
affects: [47-03-workflow-migration, 47-04-picker-integration]

# Tech tracking
tech-stack:
  added: ["@googleworkspace/drive-picker-react"]
  patterns: [agent-proxy-token-route, user-setting-server-actions]

key-files:
  created:
    - apps/web/src/app/api/drive/token/route.ts
    - apps/web/src/lib/actions/settings-actions.ts
    - apps/web/src/app/(authenticated)/settings/drive/page.tsx
    - apps/web/src/components/settings/drive-folder-picker.tsx
  modified:
    - apps/web/src/env.ts
    - apps/web/src/app/(authenticated)/settings/layout.tsx
    - apps/agent/src/mastra/index.ts

key-decisions:
  - "Access token fetched via agent proxy route instead of stale Supabase provider_token (research pitfall #6)"
  - "UserSetting CRUD uses dedicated agent API routes rather than direct Prisma from web app"
  - "NEXT_PUBLIC_GOOGLE_API_KEY and NEXT_PUBLIC_GOOGLE_CLIENT_ID use empty-string defaults for graceful degradation"

patterns-established:
  - "Agent proxy pattern: web /api/drive/token -> agent /tokens/access/:userId for fresh access tokens"
  - "UserSetting server actions: getDriveRootFolder/setDriveRootFolder via agent API"

requirements-completed: [DRIVE-01]

# Metrics
duration: 5min
completed: 2026-03-08
---

# Phase 47 Plan 02: Drive Settings UI Summary

**Google Drive folder picker settings page with Picker API integration and fresh access token proxy route**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-08T23:19:25Z
- **Completed:** 2026-03-08T23:24:25Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- /api/drive/token route proxying to agent token-cache for fresh Google access tokens
- Settings > Drive page with current folder display and Google Picker for folder selection
- DriveFolderPicker component using official @googleworkspace/drive-picker-react library
- Agent-side routes for token access and UserSetting CRUD

## Task Commits

Each task was committed atomically:

1. **Task 1: Access token API route and settings server actions** - `b80e3a4` (feat)
2. **Task 2: Drive settings page with Google Picker folder selector** - `d666b87` (feat)

## Files Created/Modified
- `apps/web/src/app/api/drive/token/route.ts` - API route returning fresh Google access token for current user
- `apps/web/src/lib/actions/settings-actions.ts` - Server actions for reading/writing drive root folder settings
- `apps/web/src/app/(authenticated)/settings/drive/page.tsx` - Drive settings page with folder picker
- `apps/web/src/components/settings/drive-folder-picker.tsx` - Google Drive Picker wrapper for folder selection
- `apps/web/src/env.ts` - Added NEXT_PUBLIC_GOOGLE_API_KEY and NEXT_PUBLIC_GOOGLE_CLIENT_ID
- `apps/web/src/app/(authenticated)/settings/layout.tsx` - Added Drive nav item with HardDrive icon
- `apps/agent/src/mastra/index.ts` - Added /tokens/access/:userId and /user-settings/:userId/:key routes

## Decisions Made
- Access token fetched via agent proxy route instead of stale Supabase provider_token (research pitfall #6)
- UserSetting CRUD uses dedicated agent API routes rather than direct Prisma from web app
- NEXT_PUBLIC_GOOGLE_API_KEY and NEXT_PUBLIC_GOOGLE_CLIENT_ID use empty-string defaults for graceful degradation when not configured

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

Users must configure the following environment variables in `apps/web/.env.local`:
- `NEXT_PUBLIC_GOOGLE_API_KEY` - Google Cloud API key restricted to Picker API
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` - OAuth 2.0 client ID (same as used for login)

Additionally, the Google Picker API must be enabled in Google Cloud Console (APIs & Services > Library > search "Picker API" > Enable).

## Next Phase Readiness
- Settings UI ready for users to configure Drive root folder
- /api/drive/token route available for any future Drive API integration in the browser
- UserSetting server actions reusable for other per-user preferences

---
*Phase: 47-drive-artifact-integration*
*Completed: 2026-03-08*
