# Phase 47: Drive Artifact Integration - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can save generated artifacts to Google Drive with folder selection, configurable sharing controls, and org-default permissions. This phase replaces the hardcoded `GOOGLE_DRIVE_FOLDER_ID` and `makePubliclyViewable()` pattern with user-chosen root folders, org-scoped sharing, and the Google Drive Picker API. Phase 46 marks artifacts as "Ready" — this phase handles the Drive save that follows.

</domain>

<decisions>
## Implementation Decisions

### Save Trigger & Flow
- Auto-save on final HITL approval — when user approves the final stage, artifact(s) save to Drive automatically with default settings
- No separate "Save to Drive" step needed in the happy path
- After auto-save, user can re-save to a different folder or update sharing via a "Save to Drive" action on the touch page
- Drive status indicator style is Claude's discretion (inline badge, status row, etc.)
- Error handling approach is Claude's discretion (toast + retry vs blocking)

### Folder Destination
- No more hardcoded `GOOGLE_DRIVE_FOLDER_ID` — users choose their own root Drive folder
- Default root folder set in Settings (one-time setup via Google Drive Picker API)
- Per-deal folder override available — user can change the destination for a specific deal
- Google Drive Picker API for folder browsing (official picker widget, supports Shared Drives)
- Per-deal subfolders auto-created inside the chosen root: `{CompanyName} - {DealName}` pattern (keep existing `getOrCreateDealFolder()` pattern but with user-chosen root)

### Sharing Controls
- No sharing UI in the save flow — org-wide default applied automatically
- Default sharing: @lumenalta.com domain gets viewer access, deal owner gets editor access, service account gets editor access
- Replace `makePubliclyViewable()` with org-only domain-restricted sharing
- User adjusts sharing in Google Drive directly if needed (no in-app sharing panel)

### Multi-Artifact Handling
- Touch 4: all 3 artifacts (Proposal, Talk Track, FAQ) save as a batch on single final approval
- All artifacts (Touches 1-4) go into the same per-deal folder — file names distinguish them
- Re-generation versioning: when a touch is re-run, previous saved file is moved to an "Archive" subfolder within the deal folder, new file takes its place

### Claude's Discretion
- Drive status indicator design on touch pages (badge, row, etc.)
- Error handling for Drive save failures (toast + retry vs blocking approval)
- File naming convention for artifacts (e.g., `{DealName} - Touch 1 Pager`, timestamps, etc.)
- Archive subfolder naming convention
- Settings page UX for root folder setup
- Google Drive Picker integration details (API key, picker options)

</decisions>

<specifics>
## Specific Ideas

- Root folder is per-user, set in Settings — replaces the env-level `GOOGLE_DRIVE_FOLDER_ID`
- Org-wide sharing uses domain restriction (@lumenalta.com) not "anyone with link" — more secure than current `makePubliclyViewable()` approach
- Service account retains editor access for potential future automation/re-generation
- Archive subfolder pattern for re-generated artifacts keeps deal folder clean while preserving history

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/agent/src/lib/drive-folders.ts`: `getOrCreateDealFolder()` — adapt to use user-chosen root instead of env var; `makePubliclyViewable()` — replace with org-scoped sharing
- `apps/agent/src/lib/google-auth.ts`: Dual-mode auth (user token + service account fallback) — reuse for Drive operations
- `Deal.driveFolderId` Prisma field — already exists for per-deal folder tracking
- `InteractionRecord.driveFileId` / `outputRefs` — existing fields for tracking saved artifacts
- `apps/web/src/components/settings/` — Settings page exists with sidebar nav and vertical tabs

### Established Patterns
- User-delegated OAuth with service account fallback (`getPooledGoogleAuth()`)
- AES-256-GCM encrypted token storage (`UserGoogleToken` model)
- `supportsAllDrives: true` for Shared Drive compatibility
- Idempotent folder creation (check-before-create pattern)
- Touch workflows (1-4) all call `getOrCreateDealFolder()` then `makePubliclyViewable()` — both need updating

### Integration Points
- All 4 touch workflows need updating: replace `GOOGLE_DRIVE_FOLDER_ID` with user's root folder, replace `makePubliclyViewable()` with org-scoped sharing
- Settings page needs new "Drive" section for root folder picker
- Touch pages need Drive status indicator after save
- Deal model may need field for user's root folder preference (or use a user-level setting)
- Google Drive Picker API needs client-side API key and OAuth token

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 47-drive-artifact-integration*
*Context gathered: 2026-03-08*
