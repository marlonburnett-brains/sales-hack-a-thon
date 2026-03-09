---
phase: 45-persistent-ai-chat-bar
verified: 2026-03-09T00:40:45Z
status: passed
score: 5/5 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 1/5
  gaps_closed:
    - "Users can complete deal-chat interactions from the web UI to the protected agent runtime"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Run the persistent deal chat from Overview, Briefing, and a Touch page against the live agent service"
    expected: "The same thread stays mounted across navigation, bootstrap succeeds on each page, and note/history/knowledge turns return assistant text plus inline metadata cards or confirmations."
    why_human: "Automated code checks confirm the route chain and auth contract, but real browser navigation plus live protected-agent responses are not exercised here."
  - test: "Upload a supported transcript file, confirm a binding choice, and ask a similar-case question in the browser"
    expected: "The upload reaches the confirmation-first save flow, save confirmation persists with a success chip, and a knowledge query renders why-fit cards without auth failures."
    why_human: "End-to-end file handling, live streaming feel, and external knowledge/runtime behavior cannot be fully verified by static inspection."
---

# Phase 45: Persistent AI Chat Bar Verification Report

**Phase Goal:** Users can interact with an AI assistant on any deal sub-page for context, transcripts, and knowledge queries.
**Verified:** 2026-03-09T00:40:45Z
**Status:** passed
**Re-verification:** Yes - after gap closure

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | User can access a persistent AI chat bar on any deal sub-page and keep it mounted across navigation. | ✓ VERIFIED | `apps/web/src/app/(authenticated)/deals/[dealId]/layout.tsx:39` mounts `PersistentDealChat`, `apps/web/src/components/deals/persistent-deal-chat.tsx:56` derives route-aware context from navigation state, and `apps/web/src/app/(authenticated)/deals/[dealId]/__tests__/layout-chat-persistence.test.tsx:77` verifies the thread survives sub-route changes. |
| 2 | User can add context or notes to the deal via chat and confirm where they are saved. | ✓ VERIFIED | `apps/web/src/app/api/deals/[dealId]/chat/route.ts:16`, `apps/web/src/app/api/deals/[dealId]/chat/bindings/route.ts:26`, and `apps/web/src/lib/api-client.ts:32` now send `X-API-Key`, matching `apps/agent/src/mastra/index.ts:554`; save-confirmation UI remains inline in `apps/web/src/components/deals/deal-chat-thread.tsx:408`, and the agent binding route returns saved-source confirmation at `apps/agent/src/mastra/index.ts:865`. |
| 3 | User can upload or paste call transcripts and bind them to a specific touch step via chat. | ✓ VERIFIED | Upload payloads are accepted in `packages/schemas/deal-chat.ts:48` and `packages/schemas/deal-chat.ts:96`, sent from `apps/web/src/components/deals/deal-chat-thread.tsx:267` and `apps/web/src/components/deals/deal-chat-thread.tsx:195`, proxied by `apps/web/src/app/api/deals/[dealId]/chat/route.ts:102`, and consumed by the agent route at `apps/agent/src/mastra/index.ts:774` through `apps/agent/src/deal-chat/assistant.ts:264`. |
| 4 | User can ask grounded questions about the deal's data and history via chat. | ✓ VERIFIED | Grounding loads deal, interaction, source, and history context in `apps/agent/src/deal-chat/context.ts:48`, the assistant shapes grounded answers in `apps/agent/src/deal-chat/assistant.ts:327`, and the web-to-agent bridge is now authenticated end to end through `apps/web/src/app/api/deals/[dealId]/chat/route.ts:66` and `apps/web/src/lib/api-client.ts:347`. |
| 5 | User can query similar cases/use cases from the knowledge base via chat. | ✓ VERIFIED | Knowledge retrieval calls `searchSlides()` in `apps/agent/src/deal-chat/assistant.ts:234`, cards render inline in `apps/web/src/components/deals/deal-chat-thread.tsx:392`, and the protected runtime path is wired with `X-API-Key` in `apps/web/src/app/api/deals/[dealId]/chat/route.ts:16` and `apps/web/src/lib/api-client.ts:32`. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/schemas/deal-chat.ts` | Shared deal-chat request, binding, meta, and transcript-upload contracts | ✓ VERIFIED | Transcript upload and shared request validation exist at `packages/schemas/deal-chat.ts:48` and `packages/schemas/deal-chat.ts:96`. |
| `apps/web/src/components/deals/persistent-deal-chat.tsx` | Route-aware persistent shell with one mounted thread | ✓ VERIFIED | One shell derives route context and holds thread state at `apps/web/src/components/deals/persistent-deal-chat.tsx:47` and `apps/web/src/components/deals/persistent-deal-chat.tsx:82`. |
| `apps/web/src/components/deals/deal-chat-thread.tsx` | Stream-aware thread UI with upload, confirmation, and knowledge cards | ✓ VERIFIED | Upload handling, send path, binding controls, and knowledge cards are implemented at `apps/web/src/components/deals/deal-chat-thread.tsx:171`, `apps/web/src/components/deals/deal-chat-thread.tsx:267`, `apps/web/src/components/deals/deal-chat-thread.tsx:408`, and `apps/web/src/components/deals/deal-chat-thread.tsx:491`. |
| `apps/web/src/app/(authenticated)/deals/[dealId]/layout.tsx` | Shared layout mount point for persistent chat | ✓ VERIFIED | The layout mounts the persistent assistant once per deal at `apps/web/src/app/(authenticated)/deals/[dealId]/layout.tsx:39`. |
| `apps/agent/src/deal-chat/context.ts` | Grounding loader for deal data, interactions, prior sources, and chat history | ✓ VERIFIED | `loadDealChatContext()` loads deal, interactions, sources, and recent messages at `apps/agent/src/deal-chat/context.ts:48`. |
| `apps/agent/src/deal-chat/assistant.ts` | Governed orchestration for grounded answers, save confirmations, and knowledge search | ✓ VERIFIED | Named-agent execution, save-intent handling, and knowledge retrieval are implemented at `apps/agent/src/deal-chat/assistant.ts:196`, `apps/agent/src/deal-chat/assistant.ts:223`, and `apps/agent/src/deal-chat/assistant.ts:234`. |
| `apps/agent/src/mastra/index.ts` | Protected deal-chat runtime routes | ✓ VERIFIED | The protected auth contract is declared at `apps/agent/src/mastra/index.ts:554`, and chat/bootstrap/binding routes are registered at `apps/agent/src/mastra/index.ts:741`, `apps/agent/src/mastra/index.ts:769`, and `apps/agent/src/mastra/index.ts:831`. |
| `apps/web/src/app/api/deals/[dealId]/chat/route.ts` | Typed web proxy for bootstrap and streamed sends using `X-API-Key` | ✓ VERIFIED | Bootstrap and streaming requests now proxy with `X-API-Key` at `apps/web/src/app/api/deals/[dealId]/chat/route.ts:13` and `apps/web/src/app/api/deals/[dealId]/chat/route.ts:102`. |
| `apps/web/src/app/api/deals/[dealId]/chat/bindings/route.ts` | Typed web proxy for binding confirmation using `X-API-Key` | ✓ VERIFIED | Binding saves now proxy with `X-API-Key` at `apps/web/src/app/api/deals/[dealId]/chat/bindings/route.ts:23` and `apps/web/src/app/api/deals/[dealId]/chat/bindings/route.ts:61`. |
| `apps/web/src/lib/api-client.ts` | Shared server-side bridge that matches the protected agent auth contract | ✓ VERIFIED | `fetchAgent()` uses `X-API-Key` at `apps/web/src/lib/api-client.ts:26`, and bootstrap/send/binding helpers delegate through it at `apps/web/src/lib/api-client.ts:333`, `apps/web/src/lib/api-client.ts:352`, and `apps/web/src/lib/api-client.ts:365`. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `apps/web/src/app/(authenticated)/deals/[dealId]/layout.tsx` | `apps/web/src/components/deals/persistent-deal-chat.tsx` | layout render | WIRED | `PersistentDealChat` is mounted in the shared deal layout at `apps/web/src/app/(authenticated)/deals/[dealId]/layout.tsx:39`. |
| `apps/web/src/components/deals/persistent-deal-chat.tsx` | `apps/web/src/components/deals/deal-chat-thread.tsx` | persistent shell renders thread | WIRED | The shell renders one `DealChatThread` instance at `apps/web/src/components/deals/persistent-deal-chat.tsx:82`. |
| `packages/schemas/deal-chat.ts` | `apps/web/src/app/api/deals/[dealId]/chat/route.ts` | shared request validation | WIRED | The proxy validates request bodies with `dealChatSendRequestSchema` at `apps/web/src/app/api/deals/[dealId]/chat/route.ts:90`. |
| `apps/web/src/components/deals/deal-chat-thread.tsx` | `apps/web/src/app/api/deals/[dealId]/chat/route.ts` | client-side upload/text send payload | WIRED | The composer posts `message`, `transcriptUpload`, and `routeContext` to `/api/deals/${dealId}/chat` at `apps/web/src/components/deals/deal-chat-thread.tsx:195`. |
| `apps/web/src/app/api/deals/[dealId]/chat/route.ts` | `apps/agent/src/mastra/index.ts` | typed GET/POST proxy to protected chat routes | WIRED | The proxy uses `X-API-Key` at `apps/web/src/app/api/deals/[dealId]/chat/route.ts:16`, matching `SimpleAuth` in `apps/agent/src/mastra/index.ts:554`, and forwards to `/deals/:dealId/chat` at `apps/web/src/app/api/deals/[dealId]/chat/route.ts:66` and `apps/web/src/app/api/deals/[dealId]/chat/route.ts:102`. |
| `apps/web/src/app/api/deals/[dealId]/chat/bindings/route.ts` | `apps/agent/src/mastra/index.ts` | binding confirmation proxy | WIRED | The binding proxy now uses `X-API-Key` at `apps/web/src/app/api/deals/[dealId]/chat/bindings/route.ts:26` and forwards to the protected binding route at `apps/web/src/app/api/deals/[dealId]/chat/bindings/route.ts:61`. |
| `apps/web/src/lib/api-client.ts` | `apps/agent/src/mastra/index.ts` | server actions delegate to protected agent routes | WIRED | `fetchAgent()` uses `X-API-Key` at `apps/web/src/lib/api-client.ts:32`, and deal-chat helpers call the protected agent endpoints at `apps/web/src/lib/api-client.ts:347`, `apps/web/src/lib/api-client.ts:356`, and `apps/web/src/lib/api-client.ts:369`. |
| `apps/agent/src/mastra/index.ts` | `apps/agent/src/deal-chat/assistant.ts` | route handlers call orchestrator | WIRED | The chat POST route delegates to `runDealChatTurn()` at `apps/agent/src/mastra/index.ts:791`. |
| `apps/agent/src/deal-chat/assistant.ts` | `apps/agent/src/lib/agent-executor.ts` | named-agent execution | WIRED | The assistant runs through `deal-chat-assistant` at `apps/agent/src/deal-chat/assistant.ts:196`. |
| `apps/agent/src/deal-chat/assistant.ts` | `apps/agent/src/lib/atlusai-search.ts` | knowledge retrieval | WIRED | Similar-case queries call `searchSlides()` at `apps/agent/src/deal-chat/assistant.ts:235`. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| `CHAT-01` | `45-03-PLAN.md`, `45-06-PLAN.md`, `45-07-PLAN.md` | User can access a persistent AI chat bar on any deal sub-page | ✓ SATISFIED | Shared layout mounting and route-persistent thread behavior are present in `apps/web/src/app/(authenticated)/deals/[dealId]/layout.tsx:39` and `apps/web/src/app/(authenticated)/deals/[dealId]/__tests__/layout-chat-persistence.test.tsx:77`. |
| `CHAT-02` | `45-02-PLAN.md`, `45-03-PLAN.md`, `45-04-PLAN.md`, `45-05-PLAN.md`, `45-06-PLAN.md`, `45-07-PLAN.md` | User can add context or notes to the deal via chat | ✓ SATISFIED | Save-confirmation flows are implemented in `apps/agent/src/deal-chat/assistant.ts:264`, returned by `apps/agent/src/mastra/index.ts:865`, surfaced in `apps/web/src/components/deals/deal-chat-thread.tsx:408`, and now reach the protected runtime through `X-API-Key` in `apps/web/src/app/api/deals/[dealId]/chat/bindings/route.ts:26` and `apps/web/src/lib/api-client.ts:32`. |
| `CHAT-03` | `45-02-PLAN.md`, `45-03-PLAN.md`, `45-04-PLAN.md`, `45-05-PLAN.md`, `45-06-PLAN.md`, `45-07-PLAN.md` | User can upload/paste call transcripts and bind them to a specific touch step via chat | ✓ SATISFIED | Transcript upload is supported by `packages/schemas/deal-chat.ts:48`, `apps/web/src/components/deals/deal-chat-thread.tsx:267`, `apps/web/src/app/api/deals/[dealId]/chat/route.ts:102`, and `apps/agent/src/mastra/index.ts:778`, with the auth bridge corrected by `apps/web/src/app/api/deals/[dealId]/chat/route.ts:16`. |
| `CHAT-04` | `45-01-PLAN.md`, `45-02-PLAN.md`, `45-03-PLAN.md`, `45-05-PLAN.md`, `45-06-PLAN.md`, `45-07-PLAN.md` | User can ask questions about the deal's data and history via chat | ✓ SATISFIED | Grounded context loading and answer shaping exist in `apps/agent/src/deal-chat/context.ts:48` and `apps/agent/src/deal-chat/assistant.ts:327`, and the web bridge is now wired through `apps/web/src/app/api/deals/[dealId]/chat/route.ts:66` and `apps/web/src/lib/api-client.ts:347`. |
| `CHAT-05` | `45-01-PLAN.md`, `45-02-PLAN.md`, `45-03-PLAN.md`, `45-05-PLAN.md`, `45-06-PLAN.md`, `45-07-PLAN.md` | User can query similar cases/use cases from the knowledge base via chat | ✓ SATISFIED | Knowledge retrieval and inline rendering exist in `apps/agent/src/deal-chat/assistant.ts:234` and `apps/web/src/components/deals/deal-chat-thread.tsx:392`, and the protected runtime path is authenticated by `apps/web/src/app/api/deals/[dealId]/chat/route.ts:16` and `apps/web/src/lib/api-client.ts:32`. |

Orphaned requirements: none. The union of requirement IDs declared in `45-01-PLAN.md`, `45-02-PLAN.md`, `45-03-PLAN.md`, `45-04-PLAN.md`, `45-05-PLAN.md`, `45-06-PLAN.md`, and `45-07-PLAN.md` covers `CHAT-01` through `CHAT-05`, and `.planning/REQUIREMENTS.md:129` through `.planning/REQUIREMENTS.md:133` map those same IDs to Phase 45.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `apps/web/src/components/deals/briefing-chat-panel.tsx` | 78 | Orphaned placeholder toast (`"Chat coming soon"`) remains in the legacy briefing-local panel | ℹ️ Info | This stale page-local shell still exists in code, but the shared persistent assistant is mounted from the deal layout and is the verified Phase 45 surface. |

### Human Verification Completed

User approved the live web flow on 2026-03-09 after confirming cross-page persistence and transcript upload/knowledge-query behavior in the browser.

### Previously Required Human Checks

### 1. Persistent protected chat flow

**Test:** Open a deal on Overview, then navigate to Briefing and a Touch page while using the shared assistant.
**Expected:** The same thread remains visible, bootstrap succeeds on each page, and route-aware suggestions/context labels update without resetting history.
**Why human:** Static verification confirms mounting and auth wiring, but not real browser navigation with live protected-agent responses.

### 2. Transcript upload and knowledge query flow

**Test:** Upload a supported transcript file, complete a save confirmation, then ask for similar cases from the same thread.
**Expected:** The upload triggers refine/confirmation behavior before save, a success chip appears after confirmation, and knowledge results render with why-fit cards.
**Why human:** Live file handling, streamed UX quality, and external runtime/knowledge behavior are not exercised by code inspection.

### Gaps Summary

The prior auth-contract blocker is closed. The deal-chat web proxies and shared server-side agent client now use `X-API-Key`, matching the protected Mastra `SimpleAuth` contract in the agent runtime. The persistent layout mount, transcript upload path, save-confirmation flow, grounded answer flow, and knowledge-query rendering all still exist and are wired through the corrected bridge. No automated blocker remains, but browser-level end-to-end verification is still needed for the live protected runtime and file-upload experience.

---

_Verified: 2026-03-09T00:40:45Z_
_Verifier: Claude (gsd-verifier)_
