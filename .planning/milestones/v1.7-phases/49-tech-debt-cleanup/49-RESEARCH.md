# Phase 49: Tech Debt Cleanup - Research

**Researched:** 2026-03-09
**Domain:** UI cleanup, test isolation, auth documentation
**Confidence:** HIGH

## Summary

Phase 49 addresses 8 tech debt items identified by the v1.7 milestone audit across Phases 42, 43, 45, and 46. All items are localized, well-scoped, and require no new libraries or architectural changes. The work falls into four categories: (1) removing or wiring orphaned UI placeholders, (2) fixing an env-coupled test import, (3) resolving a TODO around display modes, and (4) documenting the auth header contract.

The revert-stage route gap (item 8 from the audit) was already closed by Phase 48. The remaining 7 items are straightforward code changes that touch only existing files.

**Primary recommendation:** Tackle items in dependency order -- start with the isolated test fix and auth docs (no UI risk), then handle the four UI cleanup items together, and finally resolve the display mode TODO.

## Standard Stack

No new libraries needed. All changes use existing project dependencies:

| Library | Purpose | Already Installed |
|---------|---------|-------------------|
| React/Next.js | UI components | Yes |
| Vitest | Test runner | Yes |
| @t3-oss/env-core | Env validation | Yes (root cause of test issue) |
| sonner (toast) | Toast notifications being removed | Yes |

## Architecture Patterns

### File Locations

All files requiring changes are already identified:

```
apps/web/src/components/deals/briefing-chat-panel.tsx    # Items 1-2: orphaned panel
apps/agent/src/mastra/__tests__/agent-registry.test.ts   # Item 3: env-coupled test
apps/agent/src/lib/agent-executor.ts                     # Item 3: env import at top level
apps/web/src/components/touch/touch-stage-content.tsx     # Item 4: display mode TODO
apps/web/src/components/touch/touch-page-shell.tsx        # Item 5: right panel placeholder
apps/web/src/lib/api-client.ts                           # Item 6: auth header (docs)
apps/agent/src/mastra/index.ts                           # Item 6: auth header (docs)
```

### Pattern: Orphaned Component Removal

`BriefingChatPanel` is defined but never imported anywhere. The briefing page (`apps/web/src/app/(authenticated)/deals/[dealId]/briefing/page.tsx`) no longer uses it -- it was replaced by Phase 45's `PersistentDealChat` mounted in the deal layout. The entire component file can be safely deleted.

**Evidence:** Grep for `BriefingChatPanel` shows only hits inside its own file definition. No imports exist anywhere in the codebase.

### Pattern: Test Env Isolation with vi.mock

The agent-registry test's third test case (`"returns prompt version metadata"`) dynamically imports `agent-executor.ts`, which has a top-level `import { env } from "../env"`. The `env.ts` module uses `@t3-oss/env-core` `createEnv()` which eagerly validates all required env vars at import time. Tests 1 and 2 work because they only import `../agents` which mocks its dependency.

**Fix approach:** Add `vi.mock("../env")` at the test file level to prevent eager env validation, OR restructure `agent-executor.ts` to lazy-load env. The mock approach is simpler and follows Vitest patterns already used in this file.

### Pattern: PersistentDealChat Already Mounted

`PersistentDealChat` is rendered in the deal layout (`layout.tsx`) as a sibling to the main content area. It follows the user across all deal sub-pages. The touch-page-shell's right panel placeholder (line 111-115) is an empty `<div>` in split mode that was intended for Phase 45 chat integration. Since the chat is already mounted at the layout level, this placeholder div either needs to:
- Render the chat inline in split mode (would require restructuring PersistentDealChat mounting)
- Be removed entirely (simplest -- the docked chat already covers this)

**Recommendation:** Remove the empty right panel div. The PersistentDealChat dock handles all deal pages including touches. Adding split-mode inline chat would be a feature, not debt cleanup.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Inline diff view | Custom diff renderer | Remove the TODO and the unused `displayMode` prop values | The `displayMode` prop accepts `"inline-diff"` and `"side-by-side"` but they render identically to `"inline"`. No caller passes these values. Remove dead code paths. |
| Auth docs | Inline code comments | A dedicated `AUTH-CONTRACT.md` in the project root or `.planning/` | A markdown doc is more discoverable than scattered code comments |

## Common Pitfalls

### Pitfall 1: Deleting BriefingChatPanel Without Checking All Import Paths
**What goes wrong:** Component might be lazily imported or referenced in a barrel export
**How to avoid:** Grep for all variations: `BriefingChatPanel`, `briefing-chat-panel`, path-based imports. Already done -- confirmed zero external imports.

### Pitfall 2: Breaking the Split Layout When Removing Right Panel
**What goes wrong:** Removing the right column in the grid layout changes the CSS grid template
**How to avoid:** When `layoutMode === "split"`, the grid is `grid-cols-[1fr_360px]`. Removing the second child collapses it. Either change to no grid, or keep the grid only when there is content for the right panel.
**Recommendation:** When removing the placeholder, also remove the split-mode grid class or switch to single column. The layout toggle button can be removed or kept for future use.

### Pitfall 3: Env Mock Leaking to Other Tests
**What goes wrong:** `vi.mock("../env")` might affect other test files if not properly scoped
**How to avoid:** Vitest mocks are file-scoped by default. The mock only affects `agent-registry.test.ts`. Safe to add.

### Pitfall 4: DisplayMode Prop Type Change Breaking Callers
**What goes wrong:** Changing the `displayMode` type from union to just `"inline"` might break callers
**How to avoid:** Check all callers of `TouchStageContent`. If no caller passes `"inline-diff"` or `"side-by-side"`, removing those type values is safe.

## Code Examples

### Item 3 Fix: Env Mock for Test Isolation

```typescript
// Add at top of agent-registry.test.ts, after existing vi.mock calls:
vi.mock("../../env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    DIRECT_URL: "postgresql://test:test@localhost:5432/test",
    GOOGLE_SERVICE_ACCOUNT_KEY: "{}",
    GOOGLE_TEMPLATE_PRESENTATION_ID: "test-template-id",
    GOOGLE_CLOUD_PROJECT: "test-project",
    GOOGLE_CLOUD_LOCATION: "us-central1",
    VERTEX_SERVICE_ACCOUNT_KEY: "{}",
    AGENT_API_KEY: "test-key-that-is-at-least-32-characters-long",
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    NODE_ENV: "test",
  },
}));
```

### Item 4 Fix: Remove Dead Display Modes

```typescript
// Before (touch-stage-content.tsx):
interface TouchStageContentProps {
  touchType: string;
  stage: HitlStage;
  content: unknown;
  displayMode: "inline" | "inline-diff" | "side-by-side";
}

// After:
interface TouchStageContentProps {
  touchType: string;
  stage: HitlStage;
  content: unknown;
  // displayMode removed -- only inline rendering is supported
}
```

### Item 6: Auth Header Contract Documentation

```markdown
## Auth Header Contract

### Current Behavior
- **Web app** (`api-client.ts`): Sends `Authorization: Bearer <AGENT_API_KEY>`
- **Agent service** (`index.ts`): Configures `SimpleAuth` with `headers: ["X-API-Key"]`
- **CORS config**: Allows both `Authorization` and `X-API-Key` headers
- **Runtime**: Works because Mastra internally maps Bearer tokens to SimpleAuth validation

### Risk
Fragile to Mastra version upgrades. If Mastra stops accepting Bearer as X-API-Key
fallback, all web-to-agent calls will fail with 401.

### Recommended Future Fix
Align on one header. Either:
1. Change web `fetchAgent()` to send `X-API-Key: <key>` (preferred -- matches SimpleAuth config)
2. Change agent SimpleAuth to `headers: ["Authorization"]`
```

## Detailed Item Analysis

### Item 1: BriefingChatPanel "Chat coming soon" toast (line 78)
- **File:** `apps/web/src/components/deals/briefing-chat-panel.tsx`
- **Current state:** `handleChatSend()` shows `toast.info("Chat coming soon")` and clears input
- **Resolution:** Delete entire file. Component is orphaned -- no imports exist. Phase 45's `PersistentDealChat` replaced all chat functionality.
- **Confidence:** HIGH

### Item 2: Placeholder suggestion buttons (lines 72-73)
- **File:** Same as Item 1
- **Current state:** Two suggestion buttons show `"Coming in a future update"` toast
- **Resolution:** Covered by Item 1 (entire file deletion)
- **Confidence:** HIGH

### Item 3: Env-coupled test import (agent-registry.test.ts:74-84)
- **File:** `apps/agent/src/mastra/__tests__/agent-registry.test.ts`
- **Current state:** Third test dynamically imports `agent-executor.ts` which imports `env.ts` at top level. `createEnv()` eagerly validates all required env vars. Tests 1-2 pass because they only import `../agents` (properly mocked).
- **Root cause:** `agent-executor.ts` line 5: `import { env } from "../env"` -- top-level side-effecting import
- **Resolution:** Add `vi.mock("../../env")` with stub values at top of test file
- **Verified:** Ran test locally -- confirmed failure is `Error: Invalid environment variables` from `env.ts:16`
- **Confidence:** HIGH

### Item 4: inline-diff/side-by-side TODO (touch-stage-content.tsx:17)
- **File:** `apps/web/src/components/touch/touch-stage-content.tsx`
- **Current state:** `displayMode` prop accepts three values but all render identically. TODO comment at line 17 says these will be enhanced "when chat refinement integration lands." Chat refinement (Phase 45) has landed but these modes were never implemented.
- **Resolution:** Remove `displayMode` from props interface. Remove the TODO comment. Update callers to stop passing the prop.
- **Confidence:** HIGH

### Item 5: Right panel placeholder (touch-page-shell.tsx:111)
- **File:** `apps/web/src/components/touch/touch-page-shell.tsx`
- **Current state:** Empty div in split-mode grid: `{/* Phase 45 chat bar renders here */}`. PersistentDealChat is mounted at layout level, not here.
- **Resolution:** Remove the empty placeholder div. Evaluate whether split/full layout toggle still serves a purpose without the right panel -- if not, remove the toggle button and `useTouchPreferences` hook usage.
- **Confidence:** HIGH

### Item 6: Auth header contract documentation
- **Current state:** Web sends `Authorization: Bearer`, agent expects `X-API-Key`. Works via Mastra internals. Documented in STATE.md decisions but not in a developer-facing location.
- **Resolution:** Create a short auth contract doc and add code comments in both `api-client.ts` and `index.ts`
- **Confidence:** HIGH

## Open Questions

1. **Should the split/full layout toggle be removed from TouchPageShell?**
   - What we know: The toggle currently controls a grid layout where the right panel is empty. Without content in the right panel, the toggle does nothing useful.
   - Recommendation: Remove the toggle and always render full-width. If a future phase needs split mode, it can be re-added with actual content.

2. **Should the auth mismatch be fixed (not just documented)?**
   - What we know: The Phase 49 success criteria says "documented" not "fixed". Fixing it (changing web to send X-API-Key) would be a one-line change in `fetchAgent()` but is technically out of scope.
   - Recommendation: Document it. Optionally fix it if time allows -- it is a single line change with clear benefit.

## Sources

### Primary (HIGH confidence)
- Direct file inspection of all 6 affected files
- Local test execution confirming env validation failure
- Codebase grep confirming BriefingChatPanel is orphaned
- v1.7-MILESTONE-AUDIT.md for item inventory

### Secondary (MEDIUM confidence)
- STATE.md Phase 45 decisions documenting auth header workaround

## Metadata

**Confidence breakdown:**
- Item inventory: HIGH - directly from audit + file inspection
- Fix approaches: HIGH - all verified against actual code
- Side effects: HIGH - grep-verified import trees

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- no external dependencies)
