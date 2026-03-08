---
phase: 13-implement-ui-for-visualizing-and-deletin
plan: 01
subsystem: deck-structure-memory
tags: [deck-structures, memory-management, chat-context, ui]
dependency_graph:
  requires: []
  provides: [deck-memory-visualization, deck-memory-deletion]
  affects: [deck-structure-detail-view, chat-bar]
tech_stack:
  added: []
  patterns: [collapsible-panel, per-item-delete, server-action-wrapper]
key_files:
  created: []
  modified:
    - apps/agent/src/mastra/index.ts
    - apps/web/src/lib/api-client.ts
    - apps/web/src/lib/actions/deck-structure-actions.ts
    - apps/web/src/components/settings/touch-type-detail-view.tsx
    - apps/web/src/components/settings/chat-bar.tsx
    - apps/web/src/components/settings/deck-structure-view.tsx
    - apps/web/src/components/settings/__tests__/deck-structure-view.test.tsx
    - apps/web/src/components/settings/__tests__/touch-4-artifact-tabs.test.tsx
    - apps/web/src/components/settings/__tests__/touch-type-detail-view.test.tsx
    - apps/web/src/lib/__tests__/api-client.deck-structures.test.ts
decisions:
  - Skipped Next.js proxy routes since fetchJSON calls agent directly server-side with AGENT_SERVICE_URL
metrics:
  duration: 5m 11s
  completed: "2026-03-08T19:25:34Z"
---

# Quick Task 13: Implement UI for Visualizing and Deleting Deck Structure Memories

Backend DELETE endpoints for clearing chat context/messages, plus a collapsible Conversation Memory panel in the deck structure detail view with per-message delete buttons.

## One-liner

Collapsible memory panel showing accumulated chatContext and chat history with per-message and clear-all delete capabilities.

## What was done

### Task 1: Agent DELETE endpoints + chatContext in GET response
- Added `chatContext` field (parsed from `chatContextJson`) to the GET `/deck-structures/:touchType` response across all three response branches (unsupported, not-found, normal)
- Added `DELETE /deck-structures/:touchType/memories` endpoint that uses a Prisma transaction to delete all DeckChatMessage records and null out chatContextJson + lastChatAt, returning the full updated detail
- Added `DELETE /deck-structures/:touchType/messages/:messageId` endpoint for single message deletion with P2025 error handling

### Task 2: API client, server actions, type updates
- Added `chatContext: unknown` to the `DeckStructureDetail` interface
- Added `deleteDeckMemories()` and `deleteDeckMessage()` functions to the API client
- Added `deleteDeckMemoriesAction()` and `deleteDeckMessageAction()` server actions
- Updated 5 test fixture files to include the new `chatContext: null` field
- Skipped proxy routes -- `fetchJSON` already calls the agent directly with auth headers

### Task 3: Memory panel UI + per-message delete
- Added collapsible "Conversation Memory" panel with Brain icon between sequence rationale and chat bar
- Purple "Active" badge when chatContext exists
- Accumulated context displayed in purple-tinted box
- Message count indicator
- "Clear All Memories" danger button with loading state
- Per-message delete (X) button on hover in ChatBar
- Both actions call server actions and refresh data via `loadData()`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript errors in test fixtures**
- **Found during:** Task 2
- **Issue:** Adding `chatContext` as required field to `DeckStructureDetail` broke 5 test files that construct mock detail objects
- **Fix:** Added `chatContext: null` to all test fixture `makeDetail` functions and fallback objects in `deck-structure-view.tsx`
- **Files modified:** 5 test files + `deck-structure-view.tsx`

**2. [Rule 1 - Bug] Fixed unknown type rendering in JSX**
- **Found during:** Task 3
- **Issue:** `{structure.chatContext && (...)}` returns `unknown` when chatContext is `unknown` type, not assignable to ReactNode
- **Fix:** Changed to `{structure.chatContext != null && (...)}` for the badge, and used `String(JSON.stringify(...))` for content rendering
- **Files modified:** `touch-type-detail-view.tsx`

### Scope Decision: Proxy Routes Skipped
The plan suggested creating Next.js proxy routes at `apps/web/src/app/api/deck-structures/memories/route.ts` and `messages/route.ts`. Investigation showed `fetchJSON` already calls the agent service directly with the API key (server-side via server actions), making proxy routes unnecessary. The chat route proxy exists only because it needs streaming passthrough to the browser.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 4d58700 | Agent DELETE endpoints + chatContext in GET |
| 2 | 58179fd | API client, server actions, test fixes |
| 3 | cf5d191 | Memory panel UI + per-message delete |

## Self-Check: PASSED
