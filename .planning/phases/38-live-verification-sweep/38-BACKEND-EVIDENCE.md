# Phase 38 Backend Evidence

## Environment Lock

- Web origin: `https://lumenalta-hackathon.vercel.app`
- Agent origin: `https://lumenalta-agent-production.up.railway.app`
- Verification target: `touch_4/proposal` primary, with the earlier `touch_4/faq` and `touch_4/proposal` 404s retained below as historical context
- Evidence sources used for the successful rerun: authenticated production web request, direct production agent detail read, and Railway-linked production metadata

## 38-04 Deployment Confirmation Gate

- Confirmation received before rerun: `deployed`
- Deployment workflow: `sales-hack-a-thon / deploy`
- Branch: `main`
- Commit: `b3d805c`
- Commit message: `docs(roadmap): align v1.6 audit gap closure`
- Overall status: `Success`
- Passed jobs: `lint-and-build #180`, `migrate #181`, `deploy-agent #182`, `deploy-web #183`, `notify-success #184`
- User-reported rollout timing: pushed about `2m` before checkpoint release
- Locked-origin attestation for this plan: the user confirmed the 38-04 fix was deployed on both `https://lumenalta-hackathon.vercel.app` and `https://lumenalta-agent-production.up.railway.app` before any new production proof was attempted

## Outcome Snapshot

- `touch_4/proposal` production settings-chat now succeeds through the deployed `POST /api/deck-structures/chat` proxy.
- The successful rerun produced progressive streaming text before the final `---STRUCTURE_UPDATE---` payload.
- Matching persisted backend proof shows the same `touch_4/proposal` row advanced `lastChatAt` and appended the expected user and assistant `DeckChatMessage` entries.
- The earlier production 404 remains documented below as pre-fix historical context, not the current state.

## Successful Production Artifact-Qualified Chat Proof

### Scenario

- Surface: `https://lumenalta-hackathon.vercel.app/settings/deck-structures/touch-4`
- Active artifact key: `touch_4/proposal`
- Web proxy route: `POST /api/deck-structures/chat`
- Request body:

```json
{
  "touchType": "touch_4",
  "artifactType": "proposal",
  "message": "Refine the proposal structure into 5 concise sales-oriented sections with a stronger narrative arc."
}
```

### Transport Proof - Progressive Streaming

- Request start: `2026-03-08T13:14:00Z`
- Response status: `200`
- Response content-type: `text/plain; charset=utf-8`
- Vercel matched path: `/api/deck-structures/chat`
- Vercel request id: `gru1::iad1::gczwb-1772975640950-488aa9650661`
- First streamed chunk observed at `+2415ms`
- Final `---STRUCTURE_UPDATE---` marker observed at `+13113ms`
- Total streamed read events captured: `18`

First captured stream chunks showed progressive text before the structure payload:

```text
+2415ms: The user wants to transform the current deck, which is essentially a title slide and a large number of divider slides...
+2730ms: I recommend restructuring the deck into five core sections: 1) Problem/Opportunity ...
+3038ms: ... 4) Social Proof/Case Studies ... 5) Call to Action ...
+3352ms: ... remove the majority of the existing "Divider/Transition Slides" ...
+13113ms: ... persuasive sales presentation.

---STRUCTURE_UPDATE---
```

The final streamed payload included a `STRUCTURE_UPDATE` object rather than terminating with an error JSON body.

### Successful Response Payload Highlights

- Assistant response explained the requested transformation into a more sales-oriented proposal narrative.
- The final streamed payload included `updatedStructure` plus `diff`, preserving the production stream contract from `apps/agent/src/mastra/index.ts`.
- Returned section names in the final payload:
  - `Title Slide`
  - `Transition/Divider Slides`
- Returned diff:
  - `added`: `Transition/Divider Slides`
  - `modified`: `Title Slide`
  - `removed`: `Divider / Transition Slides`

## Paired Backend Proof - Persisted Production State

System proof was captured by reading the production agent detail endpoint for the same artifact-qualified key before and after the successful web-proxy request.

### Before Request

- Detail route key: `touch_4/proposal`
- Read status: `200`
- `lastChatAt`: `2026-03-08T13:10:03.063Z`
- Persisted `chatMessages` count: `2`
- Latest persisted roles: `user`, `assistant`

### After Request

- Detail route key: `touch_4/proposal`
- Read status: `200`
- `lastChatAt`: `2026-03-08T13:14:13.614Z`
- Persisted `chatMessages` count: `4`
- Latest persisted roles: `user`, `assistant`, `user`, `assistant`
- Latest persisted user message exactly matched the streamed request:

```text
Refine the proposal structure into 5 concise sales-oriented sections with a stronger narrative arc.
```

- Latest persisted assistant message begins with the same response text captured in the successful stream:

```text
The user wants to transform the current deck, which is essentially a title slide and a large number of divider slides, into a concise, sales-oriented deck with a strong narrative arc.
```

### Pairing Assessment

- The web proof and backend proof target the same artifact-qualified key: `touch_4/proposal`.
- The web request started at `2026-03-08T13:14:00Z` and the persisted row advanced `lastChatAt` to `2026-03-08T13:14:13.614Z` in the same request window.
- Persisted chat history increased from `2` to `4`, which is exactly consistent with one successful user message plus one successful assistant response being saved by `streamChatRefinement()`.
- This satisfies the Phase 38 evidence-pairing rule without relying on inferred success or stale pre-fix logs.

## Historical Context - Pre-Fix Failure Preserved

The failed production state observed before the 38-04 route fix remains part of the record so the successful rerun is explicitly tied to the shipped deployment change.

### Historical Failed Requests

- `2026-03-08T01:10:57.279965Z` - `touch_4/faq` via `POST /api/deck-structures/chat` returned `404` with browser-visible `Chat failed: 404`
- `2026-03-08T01:11:46.712650Z` - `touch_4/proposal` via `POST /api/deck-structures/chat` returned `404` with browser-visible `Chat failed: 404`
- `2026-03-08T01:13:09Z` - direct in-page proxy check returned `{"error":"Agent chat failed","details":"404 Not Found"}`

### Historical Root Cause and Fix Link

- Root cause captured in `38-04`: the checked-in web proxy targeted `${AGENT_SERVICE_URL}/api/deck-structures/:touchType/chat`, while the deployed Mastra custom route is registered at the service root as `/deck-structures/:touchType/chat`.
- Shipped fix in `38-04`: update `apps/web/src/app/api/deck-structures/chat/route.ts` to call `${AGENT_SERVICE_URL}/deck-structures/:touchType/chat`, preserve `artifactType` in `URLSearchParams`, and add regression coverage on both the web and agent sides.
- The successful `2026-03-08T13:14:00Z` rerun above is the post-deploy proof that the locked production Vercel and Railway pair now honors that artifact-qualified chat contract.

## Final Assessment

- `touch_4/proposal` production settings-chat now succeeds through the locked Vercel web origin and streams progressively before the final structure update payload.
- Matching backend state for the same artifact-qualified key confirms persisted chat messages and a fresh `lastChatAt` in the same request window.
- This plan now satisfies the backend proof goal that was previously blocked by the production 404.
