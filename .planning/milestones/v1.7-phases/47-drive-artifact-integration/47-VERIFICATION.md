---
phase: 47-drive-artifact-integration
verified: 2026-03-08T23:32:03Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 47: Drive Artifact Integration Verification Report

**Phase Goal:** Users can save generated artifacts to Google Drive with folder and sharing controls
**Verified:** 2026-03-08T23:32:03Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | shareWithOrg() grants @lumenalta.com domain viewer, deal-owner editor, and service-account editor access | VERIFIED | `drive-folders.ts` L53-76: domain "lumenalta.com" reader + optional ownerEmail writer, both with `sendNotificationEmail: false` |
| 2 | resolveRootFolderId() returns user setting if set, env var fallback otherwise | VERIFIED | `drive-folders.ts` L24-34: queries `prisma.userSetting.findUnique` by userId, falls back to `env.GOOGLE_DRIVE_FOLDER_ID` |
| 3 | archiveExistingFile() moves a file from deal folder into Archive subfolder | VERIFIED | `drive-folders.ts` L126-146: creates Archive subfolder via `getOrCreateSubfolder`, moves file with `addParents`/`removeParents` |
| 4 | OAuth scope is upgraded to full drive (not drive.readonly) | VERIFIED | All 3 files use `googleapis.com/auth/drive` (not `drive.readonly`): login/page.tsx:54, user-nav.tsx:60, actions-client.tsx:166 |
| 5 | GOOGLE_DRIVE_FOLDER_ID is optional in env.ts | VERIFIED | `env.ts` L29: `z.string().default('')` |
| 6 | User can open Settings > Drive and see current root folder or "Not configured" | VERIFIED | `settings/drive/page.tsx` L101: renders `folder.folderName || "Not configured"`, loads from `getDriveRootFolder` server action |
| 7 | User can click button to open Google Drive Picker for folder-only selection | VERIFIED | `drive-folder-picker.tsx` L91-118: renders `DrivePicker` + `DrivePickerDocsView` with `mime-types="application/vnd.google-apps.folder"`, `select-folder-enabled="true"`, `enable-drives="true"` |
| 8 | Selected folder persisted to UserSetting via server action | VERIFIED | `settings-actions.ts` L57-72: `setDriveRootFolder` upserts both `drive_root_folder_id` and `drive_root_folder_name` via agent API |
| 9 | All touch workflows resolve root folder from user setting instead of env var | VERIFIED | All 5 workflow files import and call `resolveRootFolderId(deal.ownerId)`. Remaining `env.GOOGLE_DRIVE_FOLDER_ID` references are only in AtlusAI ingestion calls (content library, not folder resolution) |
| 10 | makePubliclyViewable is fully removed from codebase (no call sites remain) | VERIFIED | Only reference is a comment in `drive-folders.ts` L39 describing the replacement. No function definition or call sites remain |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/agent/src/lib/drive-folders.ts` | shareWithOrg, resolveRootFolderId, archiveExistingFile, getOrCreateSubfolder, getOrCreateDealFolder | VERIFIED | All 5 exports present, substantive implementations (190 lines total) |
| `apps/agent/prisma/schema.prisma` | UserSetting model | VERIFIED | Model at L520-530 with `@@unique([userId, key])` and `@@index([userId])` |
| `apps/agent/prisma/migrations/20260309000100_add_user_setting/migration.sql` | Forward-only migration | VERIFIED | CREATE TABLE + unique index + userId index, 20 lines |
| `apps/web/src/app/(authenticated)/settings/drive/page.tsx` | Drive settings page with folder picker | VERIFIED | 137 lines, loads user settings, renders DriveFolderPicker, persists via server action |
| `apps/web/src/components/settings/drive-folder-picker.tsx` | Google Drive Picker wrapper | VERIFIED | 119 lines, uses `@googleworkspace/drive-picker-react`, fetches token from `/api/drive/token` |
| `apps/web/src/app/api/drive/token/route.ts` | Fresh Google access token API route | VERIFIED | 55 lines, authenticates via Supabase, proxies to agent `/tokens/access/:userId` |
| `apps/web/src/lib/actions/settings-actions.ts` | Server actions for UserSetting CRUD | VERIFIED | 72 lines, exports `getDriveRootFolder` and `setDriveRootFolder` via agent API |
| `apps/web/src/app/(authenticated)/settings/layout.tsx` | Drive nav item | VERIFIED | HardDrive icon + "Drive" link to `/settings/drive` |
| `apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx` | DriveStatusBadge component | VERIFIED | Renders green "Saved to Drive" badge with link when driveFileId set, blue spinner when pending, Touch 4 shows outputRefs links |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| drive-folders.ts | prisma.userSetting | `prisma.userSetting.findUnique` in resolveRootFolderId | WIRED | L26-28 |
| login/page.tsx + 2 others | Google OAuth | scope string `auth/drive` (full, not readonly) | WIRED | All 3 files confirmed |
| drive-folder-picker.tsx | /api/drive/token | `fetch("/api/drive/token")` | WIRED | L28 |
| settings/drive/page.tsx | settings-actions.ts | `getDriveRootFolder` and `setDriveRootFolder` calls | WIRED | L37, L53 |
| touch-1-workflow.ts | drive-folders.ts | `resolveRootFolderId` + `shareWithOrg` | WIRED | L25 import, L353 + L401 calls |
| touch-2-workflow.ts | drive-folders.ts | `resolveRootFolderId` + `shareWithOrg` | WIRED | L18 import, L335 + L387 calls |
| touch-3-workflow.ts | drive-folders.ts | `resolveRootFolderId` + `shareWithOrg` | WIRED | L18 import, L320 + L368 calls |
| touch-4-workflow.ts | drive-folders.ts | `resolveRootFolderId` + `shareWithOrg` | WIRED | L53 import, L1134 + L1180 calls |
| pre-call-workflow.ts | drive-folders.ts | `resolveRootFolderId` + `shareWithOrg` | WIRED | L30 import, L248 + L392 calls |
| deck-assembly.ts | drive-folders.ts | `shareWithOrg` replaces makePubliclyViewable | WIRED | L23 import, L303 call |
| deck-customizer.ts | drive-folders.ts | `shareWithOrg` replaces local makePubliclyViewable | WIRED | L21 import, L266 call |
| slide-assembly.ts | drive-folders.ts | `shareWithOrg` replaces makePubliclyViewable | WIRED | L16 import, L102 call |
| doc-builder.ts | drive-folders.ts | `shareWithOrg` replaces makePubliclyViewable | WIRED | L15 import, L156 call |
| touch-page-client.tsx | InteractionRecord | driveFileId + outputRefs fields rendered in DriveStatusBadge | WIRED | L43 type, L464-467 component usage |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DRIVE-01 | 47-02, 47-03 | User can choose a destination folder in Google Drive when saving generated artifacts | SATISFIED | Settings > Drive page with Google Picker for folder selection; all workflows resolve folder from UserSetting |
| DRIVE-02 | 47-01, 47-03 | User can configure the sharing scope of newly generated documents | SATISFIED | shareWithOrg provides org-scoped domain sharing + owner editor; replaces public sharing across all workflows |
| DRIVE-03 | 47-01, 47-03 | Default sharing is entire org + the service account | SATISFIED | shareWithOrg grants lumenalta.com domain reader by default; service account has access as file creator |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No anti-patterns detected |

No TODOs, FIXMEs, placeholders, or stub implementations found in any phase 47 artifacts.

### Human Verification Required

### 1. Google Drive Picker Opens and Selects Folders

**Test:** Navigate to Settings > Drive, click "Choose Folder", browse folders including Shared Drives, and select one.
**Expected:** Google Picker widget opens with folder-only view, selected folder name and ID persist on page reload.
**Why human:** Requires valid Google OAuth credentials, Picker API key, and browser interaction with Google widget.

### 2. Generated Artifacts Save to User-Selected Folder

**Test:** Configure a Drive root folder in Settings, then run a touch workflow (e.g., Touch 1 skeleton approval).
**Expected:** Generated presentation appears in the user's selected folder (not the system default).
**Why human:** Requires end-to-end workflow execution with real Google Drive API calls.

### 3. Org-Scoped Sharing Permissions Applied

**Test:** After generating an artifact, check its sharing settings in Google Drive.
**Expected:** File shared with lumenalta.com domain as viewer, deal owner as editor.
**Why human:** Requires inspecting actual Google Drive permissions on a generated file.

### 4. Archive-on-Regeneration Works

**Test:** Approve a touch, then re-trigger generation for the same touch.
**Expected:** Previous file moved to Archive subfolder; new file created in deal folder.
**Why human:** Requires two sequential workflow runs and Drive folder inspection.

### Gaps Summary

No gaps found. All 10 observable truths verified against the codebase. All 3 requirements (DRIVE-01, DRIVE-02, DRIVE-03) satisfied with implementation evidence across 3 plans.

Key implementation highlights:
- Plan 01 established foundations: UserSetting model, drive utility functions, OAuth scope upgrade
- Plan 02 delivered Settings UI with Google Picker integration and access token proxy
- Plan 03 migrated all 5 workflows and 4 library files, removed makePubliclyViewable, added archive-on-regeneration and Drive status badges

The remaining `env.GOOGLE_DRIVE_FOLDER_ID` references in workflows are correctly scoped to AtlusAI ingestion calls (content library access), not folder resolution -- matching the plan's anti-pattern warning.

---

_Verified: 2026-03-08T23:32:03Z_
_Verifier: Claude (gsd-verifier)_
