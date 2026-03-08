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
