# Phase 47: Drive Artifact Integration - Research

**Researched:** 2026-03-08
**Domain:** Google Drive API (Picker, Permissions, folder management), Next.js client-side integrations
**Confidence:** HIGH

## Summary

Phase 47 replaces the hardcoded `GOOGLE_DRIVE_FOLDER_ID` env var and `makePubliclyViewable()` public sharing pattern with user-configurable root folder selection (via Google Drive Picker API) and org-scoped domain sharing (`@lumenalta.com` viewer access). The codebase has a well-established Drive integration layer (`drive-folders.ts`, `google-auth.ts`, `token-cache.ts`) that needs targeted modification rather than greenfield development.

The key technical challenges are: (1) integrating the Google Drive Picker API on the client side for folder selection, which requires a browser API key and the user's OAuth token; (2) upgrading the OAuth scope from `drive.readonly` to `drive` (full) since the current scope does not allow folder creation or permission management; and (3) updating all 5 workflow files (touch-1 through touch-4 plus pre-call) to resolve the parent folder dynamically from user settings instead of from `env.GOOGLE_DRIVE_FOLDER_ID`.

**Primary recommendation:** Use Google's official `@googleworkspace/drive-picker-react` component for folder selection, store the user's chosen root folder ID in a new `UserSetting` model (per-user key-value), and replace all `makePubliclyViewable()` calls with a new `shareWithOrg()` function that grants `@lumenalta.com` domain viewer access plus deal-owner editor access.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Auto-save on final HITL approval -- when user approves the final stage, artifact(s) save to Drive automatically with default settings
- No separate "Save to Drive" step needed in the happy path
- After auto-save, user can re-save to a different folder or update sharing via a "Save to Drive" action on the touch page
- No more hardcoded `GOOGLE_DRIVE_FOLDER_ID` -- users choose their own root Drive folder
- Default root folder set in Settings (one-time setup via Google Drive Picker API)
- Per-deal folder override available -- user can change the destination for a specific deal
- Google Drive Picker API for folder browsing (official picker widget, supports Shared Drives)
- Per-deal subfolders auto-created inside the chosen root: `{CompanyName} - {DealName}` pattern (keep existing `getOrCreateDealFolder()` pattern but with user-chosen root)
- No sharing UI in the save flow -- org-wide default applied automatically
- Default sharing: @lumenalta.com domain gets viewer access, deal owner gets editor access, service account gets editor access
- Replace `makePubliclyViewable()` with org-only domain-restricted sharing
- User adjusts sharing in Google Drive directly if needed (no in-app sharing panel)
- Touch 4: all 3 artifacts (Proposal, Talk Track, FAQ) save as a batch on single final approval
- All artifacts (Touches 1-4) go into the same per-deal folder -- file names distinguish them
- Re-generation versioning: when a touch is re-run, previous saved file is moved to an "Archive" subfolder within the deal folder, new file takes its place

### Claude's Discretion
- Drive status indicator design on touch pages (badge, row, etc.)
- Error handling for Drive save failures (toast + retry vs blocking approval)
- File naming convention for artifacts (e.g., `{DealName} - Touch 1 Pager`, timestamps, etc.)
- Archive subfolder naming convention
- Settings page UX for root folder setup
- Google Drive Picker integration details (API key, picker options)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DRIVE-01 | User can choose a destination folder in Google Drive when saving generated artifacts | Google Drive Picker API (`@googleworkspace/drive-picker-react`) for folder browsing; per-user root folder stored in `UserSetting` model; per-deal override via Deal model |
| DRIVE-02 | User can configure the sharing scope of newly generated documents | Replace `makePubliclyViewable()` with `shareWithOrg()` that applies domain + owner + service account permissions; no in-app UI needed per locked decisions |
| DRIVE-03 | Default sharing is entire org + the service account | `permissions.create` with type=domain, domain=lumenalta.com, role=reader; plus type=user for deal owner (editor) and service account (editor) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@googleworkspace/drive-picker-react` | latest | Google Drive folder picker widget for React/Next.js | Official Google Workspace React wrapper; SSR-compatible with `"use client"` directive; TypeScript support |
| `googleapis` | (already installed) | Drive API v3 for permissions, folder ops | Already in use throughout agent codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sonner` | (already installed) | Toast notifications for Drive save status | Error/success feedback after auto-save |
| `lucide-react` | (already installed) | Icons for Drive status badges | Status indicators on touch pages |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@googleworkspace/drive-picker-react` | `react-google-drive-picker` (community) | Community lib is older and less maintained; official Google package has first-party support |
| `@googleworkspace/drive-picker-react` | Raw `gapi.client` + `google.picker.PickerBuilder` | More control but much more boilerplate; official React wrapper handles script loading and lifecycle |

**Installation (web app only):**
```bash
cd apps/web && pnpm add @googleworkspace/drive-picker-react
```

## Architecture Patterns

### Recommended Changes

```
apps/agent/src/
  lib/
    drive-folders.ts          # MODIFY: add shareWithOrg(), archiveFile(), resolve root from user setting
    google-auth.ts            # NO CHANGE (already supports user + SA auth)
  mastra/
    workflows/
      touch-1-workflow.ts     # MODIFY: replace env.GOOGLE_DRIVE_FOLDER_ID with user root
      touch-2-workflow.ts     # MODIFY: same
      touch-3-workflow.ts     # MODIFY: same
      touch-4-workflow.ts     # MODIFY: same
      pre-call-workflow.ts    # MODIFY: same
  env.ts                      # MODIFY: make GOOGLE_DRIVE_FOLDER_ID optional (fallback only)

apps/agent/prisma/
  schema.prisma               # ADD: UserSetting model

apps/web/src/
  app/(authenticated)/settings/
    drive/page.tsx             # NEW: Drive settings page with folder picker
    layout.tsx                 # MODIFY: add "Drive" nav item
  components/settings/
    drive-folder-picker.tsx    # NEW: Picker wrapper component
  components/touch/
    drive-status-badge.tsx     # NEW: Status indicator for saved artifacts
  env.ts                      # MODIFY: add NEXT_PUBLIC_GOOGLE_API_KEY, NEXT_PUBLIC_GOOGLE_CLIENT_ID
```

### Pattern 1: Dynamic Root Folder Resolution
**What:** Replace hardcoded `env.GOOGLE_DRIVE_FOLDER_ID` with user-setting lookup at workflow execution time.
**When to use:** Every workflow step that creates folders or files in Drive.
**Example:**
```typescript
// In drive-folders.ts -- new function
export async function resolveRootFolderId(userId?: string): Promise<string> {
  if (userId) {
    const setting = await prisma.userSetting.findUnique({
      where: { userId_key: { userId, key: "drive_root_folder_id" } },
    });
    if (setting?.value) return setting.value;
  }
  // Fallback to env var for backward compatibility
  return env.GOOGLE_DRIVE_FOLDER_ID;
}
```

### Pattern 2: Org-Scoped Sharing (replaces makePubliclyViewable)
**What:** Grant domain-wide viewer, deal-owner editor, and service-account editor permissions.
**When to use:** After any file/presentation is created in Drive.
**Example:**
```typescript
// In drive-folders.ts -- replaces makePubliclyViewable
export async function shareWithOrg(params: {
  fileId: string;
  ownerEmail?: string;
}): Promise<void> {
  const drive = getDriveClient();

  // 1. Domain-wide viewer access (lumenalta.com)
  await drive.permissions.create({
    fileId: params.fileId,
    requestBody: {
      role: "reader",
      type: "domain",
      domain: "lumenalta.com",
    },
    supportsAllDrives: true,
    sendNotificationEmail: false,
  });

  // 2. Deal owner gets editor access
  if (params.ownerEmail) {
    await drive.permissions.create({
      fileId: params.fileId,
      requestBody: {
        role: "writer",
        type: "user",
        emailAddress: params.ownerEmail,
      },
      supportsAllDrives: true,
      sendNotificationEmail: false,
    });
  }

  // Service account already has access as file creator
}
```

### Pattern 3: Archive-on-Regeneration
**What:** When a touch is re-run and a new file is generated, move the old file to an `Archive` subfolder.
**When to use:** When `InteractionRecord.driveFileId` already exists for a deal+touchType.
**Example:**
```typescript
export async function archiveExistingFile(params: {
  dealFolderId: string;
  fileId: string;
}): Promise<void> {
  const drive = getDriveClient();
  // Get or create Archive subfolder
  const archiveFolderId = await getOrCreateSubfolder(params.dealFolderId, "Archive");
  // Move file to Archive
  await drive.files.update({
    fileId: params.fileId,
    addParents: archiveFolderId,
    removeParents: params.dealFolderId,
    supportsAllDrives: true,
  });
}
```

### Pattern 4: Google Drive Picker for Folder Selection
**What:** Use the official Google Picker React component configured for folder-only selection.
**When to use:** Settings page for root folder selection; optionally on deal page for per-deal override.
**Example:**
```typescript
// In drive-folder-picker.tsx
import { DrivePicker, DrivePickerDocsView } from "@googleworkspace/drive-picker-react";

export function DriveFolderPicker({ onSelect, accessToken }: Props) {
  return (
    <DrivePicker
      appId={process.env.NEXT_PUBLIC_GOOGLE_CLOUD_PROJECT!}
      clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}
      developerKey={process.env.NEXT_PUBLIC_GOOGLE_API_KEY!}
      oauthToken={accessToken}
      onPicked={(e) => {
        const folder = e.detail.docs?.[0];
        if (folder) onSelect({ id: folder.id, name: folder.name });
      }}
    >
      <DrivePickerDocsView
        mimeTypes="application/vnd.google-apps.folder"
        selectFolderEnabled
        includeFolders
        mode="grid"
      />
    </DrivePicker>
  );
}
```

### Anti-Patterns to Avoid
- **Removing GOOGLE_DRIVE_FOLDER_ID env var entirely:** Ingestion scripts (pilot-ingestion, run-ingestion, ingest-brand-guidelines, build-image-registry) still need it for content library access. Only touch/pre-call workflows should switch to user-selected root.
- **Calling makePubliclyViewable AND shareWithOrg:** Replace, do not supplement. The old pattern must be fully removed from all call sites.
- **Fetching user settings on every permission call:** Resolve root folder once at workflow start and pass it through steps, not per-step lookups.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Folder browsing UI | Custom Drive folder tree component | `@googleworkspace/drive-picker-react` | Google Picker handles auth, Shared Drives, folder hierarchy natively |
| OAuth token for Picker | Custom token fetch flow | Supabase session `provider_token` | Already captured during Google OAuth login flow |
| Permission batching | Custom batch permission API | Sequential `permissions.create` calls | Only 2-3 permissions per file; batching adds complexity for no real gain |

**Key insight:** The Picker API and Drive API are the hard parts of this integration, and both are already solved by Google's official libraries. The work is wiring them into the existing patterns, not building new abstractions.

## Common Pitfalls

### Pitfall 1: OAuth Scope Upgrade Required
**What goes wrong:** The app currently requests `drive.readonly` scope. The Picker API needs at least `drive.file` scope, and folder creation/permission management needs `drive` (full) scope.
**Why it happens:** Original login flow only needed read access for content library ingestion.
**How to avoid:** Update all three OAuth scope strings in the web app (login page, actions-client, user-nav) from `drive.readonly` to `drive`. Existing users will need to re-consent (sign out and back in).
**Warning signs:** Picker shows empty/no folders; permission.create returns 403.
**Files to update:**
- `apps/web/src/app/login/page.tsx` (line 54)
- `apps/web/src/app/(authenticated)/actions/actions-client.tsx` (line 166)
- `apps/web/src/components/user-nav.tsx` (line 60)

### Pitfall 2: Picker API Key vs OAuth Token
**What goes wrong:** The Picker requires both a browser API key (for loading the JS) AND an OAuth access token (for accessing user's Drive).
**Why it happens:** These are two different credential types often confused.
**How to avoid:** Create a browser API key in Google Cloud Console with Picker API enabled. Pass as `developerKey`. The OAuth token comes from the Supabase session `provider_token`.
**Warning signs:** Picker loads but shows "access denied" or does not render.

### Pitfall 3: Shared Drives Require `supportsAllDrives`
**What goes wrong:** Folders in Shared Drives are invisible without the flag.
**Why it happens:** Google defaults to "My Drive" only.
**How to avoid:** The existing codebase already sets `supportsAllDrives: true` everywhere. Maintain this pattern for any new Drive API calls. The Picker component also needs `enableDrives` and `includeFolders` props.
**Warning signs:** Users see only "My Drive" folders even though they use Shared Drives.

### Pitfall 4: GOOGLE_DRIVE_FOLDER_ID Must Stay for Ingestion
**What goes wrong:** Removing the env var breaks content ingestion scripts.
**Why it happens:** 6+ ingestion scripts reference this env var for content library access (not artifact output).
**How to avoid:** Make it `.optional()` in env.ts for the touch-workflow use case, but keep it required for ingestion scripts. Or keep it required and use it as the system-wide fallback.
**Warning signs:** Agent startup validation fails; ingestion scripts crash.

### Pitfall 5: sendNotificationEmail on Permission Create
**What goes wrong:** Every file save sends email notifications to the entire lumenalta.com domain.
**Why it happens:** Default behavior for `permissions.create` is to send notification emails.
**How to avoid:** Always pass `sendNotificationEmail: false` in the permission create request.
**Warning signs:** Users get flooded with "X shared a document with you" emails.

### Pitfall 6: provider_token Availability
**What goes wrong:** The Supabase `provider_token` (Google OAuth access token) is only available immediately after login, not persisted in the session.
**Why it happens:** Supabase does not store provider tokens in the session by default after the initial callback.
**How to avoid:** Use the agent's token-cache system (which stores encrypted refresh tokens in `UserGoogleToken`) to get a fresh access token for the Picker. Add an API route that returns the access token for the current user.
**Warning signs:** Picker works right after login but fails on page refresh.

## Code Examples

### UserSetting Prisma Model
```prisma
// New model for per-user key-value settings
model UserSetting {
  id        String   @id @default(cuid())
  userId    String
  key       String   // "drive_root_folder_id", "drive_root_folder_name"
  value     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, key])
  @@index([userId])
}
```

### Workflow Root Folder Resolution
```typescript
// Before (all 5 workflows):
const folderId = await getOrCreateDealFolder({
  companyName: deal.company.name,
  dealName: deal.name,
  parentFolderId: env.GOOGLE_DRIVE_FOLDER_ID,
});

// After:
const rootFolderId = await resolveRootFolderId(userId);
const folderId = await getOrCreateDealFolder({
  companyName: deal.company.name,
  dealName: deal.name,
  parentFolderId: rootFolderId,
});
```

### Permission Replacement
```typescript
// Before (6 call sites):
await makePubliclyViewable(fileId);

// After:
await shareWithOrg({ fileId, ownerEmail: deal.ownerEmail ?? undefined });
```

### Env Var Change
```typescript
// In env.ts -- make optional with fallback
GOOGLE_DRIVE_FOLDER_ID: z.string().min(1).optional().default(''),
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw `google.picker.PickerBuilder` JS API | `@googleworkspace/drive-picker-react` official component | 2024-2025 | No manual script loading; React-native props API |
| `type: "anyone"` public sharing | `type: "domain"` org-restricted sharing | Always available | More secure; restricts access to `@lumenalta.com` domain |
| `gapi.load('picker')` script injection | npm package with SSR support | 2024 | Works with Next.js App Router out of the box |

## Open Questions

1. **Provider Token for Picker**
   - What we know: Supabase captures `provider_token` on login callback but does not persist it in the session.
   - What's unclear: Whether the agent's token-cache (UserGoogleToken refresh token) can be used to mint an access token and pass it to the client for Picker use.
   - Recommendation: Add an API route (`/api/drive/token`) that uses the agent's token cache to return a fresh access token for the current user. This is more reliable than depending on Supabase session tokens.

2. **Google Cloud API Key for Picker**
   - What we know: The Picker needs a browser API key with Picker API enabled.
   - What's unclear: Whether the project already has one or needs a new one.
   - Recommendation: Check Google Cloud Console. If none exists, create one with HTTP referrer restrictions. Expose as `NEXT_PUBLIC_GOOGLE_API_KEY`.

3. **Domain Sharing on Shared Drives**
   - What we know: Domain sharing with `type: "domain"` works on regular Drive files.
   - What's unclear: Whether domain-type permissions work on Shared Drive files (which have their own permission model).
   - Recommendation: If files are in a Shared Drive, the drive-level sharing may already cover org access. Test with `supportsAllDrives: true`. If domain permissions fail on Shared Drive files, fall back to inheriting Shared Drive permissions.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `apps/agent/src/lib/drive-folders.ts`, `google-auth.ts`, `token-cache.ts` -- full Drive integration patterns
- Existing codebase: `apps/agent/src/mastra/workflows/touch-{1,2,3,4}-workflow.ts` -- all GOOGLE_DRIVE_FOLDER_ID call sites
- Existing codebase: `apps/web/src/app/login/page.tsx` -- OAuth scope configuration
- [Google Drive Permissions API](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/create) -- `type: "domain"` with `domain` field
- [Google Picker API Overview](https://developers.google.com/drive/picker/guides/overview) -- setup and configuration
- [DocsView.setSelectFolderEnabled](https://developers.google.com/workspace/drive/picker/reference/picker.docsview.setselectfolderenabled) -- folder selection in Picker
- [@googleworkspace/drive-picker-react](https://www.npmjs.com/package/@googleworkspace/drive-picker-react) -- official React wrapper

### Secondary (MEDIUM confidence)
- [React Wrapper for Google Drive Picker](https://dev.to/googleworkspace/react-wrapper-for-google-drive-picker-1api) -- usage patterns and Next.js SSR handling

### Tertiary (LOW confidence)
- Provider token persistence behavior in Supabase -- based on general Supabase OAuth knowledge, needs verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- using official Google libraries already in the ecosystem
- Architecture: HIGH -- modifying well-understood existing patterns, not greenfield
- Pitfalls: HIGH -- based on direct codebase analysis showing exact files/lines to change
- Picker integration: MEDIUM -- official React component is relatively new; API surface verified via npm/docs but not hands-on tested

**Research date:** 2026-03-08
**Valid until:** 30 days (stable Google APIs, well-established patterns)
