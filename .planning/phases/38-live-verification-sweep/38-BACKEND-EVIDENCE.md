# Phase 38 Backend Evidence

## Environment Lock

- Web origin: `https://lumenalta-hackathon.vercel.app`
- Agent origin: `https://lumenalta-agent-production.up.railway.app`
- Verification target: `touch_4/proposal` primary, with unchanged observations for `touch_4/talk_track` and `touch_4/faq`
- Evidence source: authenticated production browser session and Railway production logs provided by the Phase 38 orchestrator

## Outcome Snapshot

- `touch_4/proposal` cron re-inference was observed live and reflected in the production settings UI.
- Live artifact-qualified chat streaming was exercised through the deployed web proxy, but it failed with `404 Not Found` before any progressive stream reached the browser.
- Because chat failed at the proxy-to-agent hop, this plan does not provide a successful streaming proof set or a matching persisted `DeckChatMessage` confirmation.

## Live Streaming Verification

### Scenario

- Surface: `https://lumenalta-hackathon.vercel.app/settings/deck-structures/touch-4`
- Active tab: Proposal, then FAQ for a second artifact-qualified check
- Web proxy route: `POST /api/deck-structures/chat`

### Request 1 - `touch_4/faq`

- Timestamp: `2026-03-08T01:10:57.279965Z`
- Request URL: `https://lumenalta-hackathon.vercel.app/api/deck-structures/chat`
- Request body:

```json
{"touchType":"touch_4","artifactType":"faq","message":"Please draft a concise FAQ deck structure with 5 sections for a prospective client meeting."}
```

- Browser-visible outcome: `Sorry, I encountered an error: Chat failed: 404`
- Response status: `404`
- Response content-type: `application/json`

### Request 2 - `touch_4/proposal`

- Timestamp: `2026-03-08T01:11:46.712650Z`
- Request URL: `https://lumenalta-hackathon.vercel.app/api/deck-structures/chat`
- Request body:

```json
{"touchType":"touch_4","artifactType":"proposal","message":"Refine the proposal structure into 5 concise sales-oriented sections with a stronger narrative arc."}
```

- Browser-visible outcome: `Sorry, I encountered an error: Chat failed: 404`
- Response status: `404`
- Response content-type: `application/json`

### Direct In-Page Proxy Check

- Timestamp: `2026-03-08T01:13:09Z`
- Response body:

```json
{"error":"Agent chat failed","details":"404 Not Found"}
```

- Relevant response header: `x-matched-path: /api/deck-structures/chat`

### Transport Proof Result

- Negative result: no progressive chunks were observed because the browser never received a streaming response body.
- The authenticated production browser did reach the deployed Next.js proxy path, but the proxy returned a terminal `404` JSON error instead of a chunked text stream.
- This fails the original plan requirement to prove progressive response behavior for one exact `(touch_4, artifactType)` pair.

### Paired System Proof and Diagnosis

- System proof available: the deployed web proxy accepted artifact-qualified requests at `/api/deck-structures/chat` and surfaced upstream failure details from the agent hop.
- Source contract cross-check:
  - `apps/web/src/app/api/deck-structures/chat/route.ts` builds `${env.AGENT_SERVICE_URL}/api/deck-structures/${touchType}/chat?artifactType=...`
  - `apps/agent/src/mastra/index.ts` registers `registerApiRoute("/deck-structures/:touchType/chat", ...)`
- Diagnosis: production chat traffic is reaching the web proxy with the correct `touchType` and `artifactType`, but the proxy's upstream request is receiving `404 Not Found` from the deployed agent service. The production route registration or deployed agent path is therefore not behaving like the checked-in contract.
- Missing proof due to blocker:
  - No successful streamed response for `touch_4/proposal` or `touch_4/faq`
  - No paired Railway chat log excerpt was captured for the failed requests
  - No persisted `DeckChatMessage` or `DeckStructure.lastChatAt` evidence was captured because the refinement never completed

## Interim Assessment After Streaming Check

- Live artifact-qualified chat reached the deployed proxy but failed upstream with `404 Not Found`, so successful streaming behavior remains unverified in production.
- Cron evidence is documented separately in Task 2 to keep the proof trail atomic.

## Cron Verification

### Pre-Run UI State

Authenticated production browser state on `https://lumenalta-hackathon.vercel.app/settings/deck-structures/touch-4` before the cron evidence window:

- `touch_4/proposal`: `No examples - needs more examples / 0 examples`
- `touch_4/talk_track`: `No examples - needs more examples / 0 examples`
- `touch_4/faq`: `No examples - needs more examples / 0 examples`

### Railway Production Logs

Observed JSON log lines around the live run:

```text
2026-03-08T01:11:03.610710329Z [deck-infer-cron] Starting inference cycle...
2026-03-08T01:11:03.610725014Z [deck-infer-cron] Re-inferring touch_4/proposal (hash changed: e3b0c442 -> 60e56b69)
2026-03-08T01:11:08.468103580Z [deck-inference] Inferred structure for touch_4/proposal: 2 sections, 1 examples, confidence 30% (Low confidence)
2026-03-08T01:11:08.468108062Z [deck-infer-cron] touch_4/proposal: 2 sections inferred
2026-03-08T01:11:08.468112193Z [deck-infer-cron] Inference cycle complete
```

### Post-Run UI State

Authenticated production browser state after the cron run:

- `touch_4/proposal`: `Low confidence - needs more examples / 1 example`
- `touch_4/talk_track`: `No examples - needs more examples / 0 examples`
- `touch_4/faq`: `No examples - needs more examples / 0 examples`
- Proposal panel body displayed `30%`, `1 example`, and inferred structure content.

### Cron Result

- Positive result for `touch_4/proposal`: the production cron loop evaluated the artifact-qualified key, detected a hash change, and re-inferred the proposal structure.
- Evidence pairing for the same key is consistent:
  - Transport or UI proof: Proposal tab changed from `0 examples` to `1 example` and showed the inferred structure.
  - System proof: Railway logs explicitly named `touch_4/proposal`, the old and new hash prefixes, and the resulting `30%` low-confidence inference.

### Limits of Captured Proof

- No direct production row dump was captured for `DeckStructure.dataHash`, `DeckStructure.inferredAt`, or `DeckStructure.lastChatAt`.
- No active-chat skip event was observed in the supplied cron window, so this run confirms re-inference behavior but not skip semantics.
- `touch_4/talk_track` and `touch_4/faq` remained unchanged in the browser state during the captured window, and no matching cron log lines for those artifact keys were supplied.

## Final Assessment

- `touch_4/proposal` cron behavior is re-confirmed live in production.
- Live artifact-qualified chat reached the deployed proxy but failed upstream with `404 Not Found`, so successful streaming behavior remains unverified in production.
- This evidence closes the checkpoint with truthful production observations, but it does not satisfy the original plan's successful streaming proof criteria. The remaining blocker is the production agent chat route failure behind `POST /api/deck-structures/chat`.
