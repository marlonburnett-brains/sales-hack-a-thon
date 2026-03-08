# Phase 38 Live Verification Runbook

## Objective

Lock one reachable verification environment for all Phase 38 work so backend live evidence and browser UAT both run against the same deployed stack.

## Reachable Environment Lock

- Reachable environment: production deploy only.
- Web origin: `https://lumenalta-hackathon.vercel.app`
- Agent origin: `https://lumenalta-agent-production.up.railway.app`
- Localhost status: banned for Phase 38 evidence collection.
- Do not mix preview URLs, localhost URLs, or ad hoc tunnels into the evidence set.

## Locked Scope

- Verification target: v1.6 Touch 4 artifact-qualified behavior only.
- Artifact keys allowed in evidence: `proposal`, `talk_track`, `faq`.
- Deck-structure keys used for live checks:
  - `touch_4/proposal`
  - `touch_4/talk_track`
  - `touch_4/faq`
- Browser scenarios copied unchanged from Phase 37 verification debt:
  1. Cross-surface Touch 4 classification reload behavior.
  2. Touch 4 settings tab behavior, including artifact-scoped chat on zero-example tabs.

## Hard Bans

- No `localhost` URLs in screenshots, logs, curl output, or notes.
- No screenshots or notes that omit `artifactType` or the explicit artifact label.
- No temporary debug code, debug routes, admin pages, or one-off verification UI.
- No generic "Touch 4 works" conclusion without artifact-qualified proof.

## Prerequisites Before Any Live Check

### Auth State

- Browser session is authenticated in the web app with a valid `@lumenalta.com` Google login.
- Vercel CLI is authenticated for deploy metadata if needed.
- Railway CLI is authenticated for production logs and variable inspection.
- Supabase access exists for row-level verification of persisted `DeckStructure` evidence.

### Runtime Readiness

- Use the locked production web and agent origins above only.
- Confirm the same production environment is configured end to end:
  - Agent `WEB_APP_URL` points to `https://lumenalta-hackathon.vercel.app`
  - Web `AGENT_SERVICE_URL` points to `https://lumenalta-agent-production.up.railway.app`
- Verify at least one existing template can be opened in both the Templates list and slide viewer before starting browser UAT.
- Do not start Phase 38 live checks if focused regression preflight fails.

## Evidence Sources

- Browser/UI evidence: authenticated browser session on `https://lumenalta-hackathon.vercel.app`
- Network evidence: browser devtools network capture or `curl -N` against the reachable web route
- Agent runtime evidence: Railway production logs for `lumenalta-agent`
- Persistence evidence: production `DeckStructure` and `DeckChatMessage` rows in Supabase/Postgres

## Evidence Pairing Rule

Every scenario needs two proofs captured for the same artifact-qualified action:

1. User-visible or transport proof from the reachable web surface.
2. System proof from Railway logs or persisted database rows.

A scenario is incomplete unless both proofs name the same artifact key and can be matched by timestamp or request window.

## Scenario Ledger

### Scenario A - Live streaming refinement for `touch_4/proposal`

- Surface: `/settings/deck-structures/touch-4` with Proposal tab active.
- Action: send one refinement message that explicitly targets the proposal structure.
- UI proof required:
  - Proposal tab is active.
  - Network request body includes `touchType: "touch_4"` and `artifactType: "proposal"`.
  - Response arrives progressively before the final `---STRUCTURE_UPDATE---` payload.
- System proof required:
  - Railway logs show the artifact-qualified Touch 4 chat/refinement path for proposal.
  - Production `DeckStructure` row for `(touch_4, proposal)` shows updated chat or inference evidence such as `lastChatAt`, `chatContextJson`, `inferredAt`, or changed structure payload.

### Scenario B - Background cron sweep for Touch 4 artifact keys

- Keys under test:
  - `touch_4/proposal`
  - `touch_4/talk_track`
  - `touch_4/faq`
- Action: wait for the production cron interval and inspect the exact production sweep.
- Transport/UI proof required:
  - Record the pre-run and post-run state from the Settings page summaries for the artifact tabs being verified.
  - If any key is skipped, capture the reason and stop calling it a pass.
- System proof required:
  - Railway logs show the cron loop evaluated the artifact-qualified key.
  - Production `DeckStructure` rows for the same key(s) show timestamp or hash movement, or an explicit skip reason such as active chat protection.
- Guardrail:
  - Because cron skips keys with recent chat activity, record the starting row state first and avoid using a key with a fresh `lastChatAt` if the goal is re-inference proof.

### Scenario C - Cross-surface Touch 4 classification reload behavior

- Surface 1: Templates list classify entry point.
- Surface 2: Slide viewer classify entry point for the same template.
- Action:
  1. Choose the same existing template in both surfaces.
  2. Classify as `Example + Touch 4` with a single artifact choice.
  3. Refresh each surface.
- UI proof required:
  - Artifact selector appears only for `Example + Touch 4`.
  - Saved badge still shows the chosen artifact label after reload on both surfaces.
- System proof required:
  - Persisted template classification row retains the selected `artifactType`.
  - Reloaded UI is reading saved state, not transient dialog state.

### Scenario D - Touch 4 settings tab and artifact-scoped chat behavior

- Surface: `/settings/deck-structures/touch-4`
- Action:
  1. Open Touch 4 settings.
  2. Confirm Proposal is the default tab.
  3. Switch through Proposal, Talk Track, and FAQ.
  4. Send a chat refinement from a zero-example tab if available.
- UI proof required:
  - Proposal opens by default.
  - Each trigger shows its own confidence and example-count context.
  - Chat remains enabled and scoped to the active artifact tab.
- System proof required:
  - Network request includes the active artifact key.
  - Railway logs or DB evidence tie the chat/refinement to the same `(touchType, artifactType)` row.

## Operational Notes

- Prefer `railway logs` for runtime evidence and Supabase row inspection for persistence evidence.
- Prefer browser network tools for the live stream because Phase 38 must prove the existing browser -> Next.js proxy -> Railway agent stream path, not just the final text.
- Record exact timestamps for every captured artifact so browser, log, and DB evidence can be paired cleanly.

## Preflight Regression Gate

Focused suites must be green immediately before Phase 38 live verification starts.

### Backend targeted suites

```bash
pnpm --filter agent exec vitest run src/deck-intelligence/__tests__/auto-infer-cron.test.ts src/mastra/__tests__/deck-structure-routes.test.ts
```

### Frontend targeted suites

```bash
pnpm --filter web exec vitest run src/components/settings/__tests__/touch-4-artifact-tabs.test.tsx src/components/slide-viewer/__tests__/classification-panel.test.tsx src/app/api/deck-structures/chat/__tests__/route.test.ts
```

If any targeted suite fails, stop the live sweep and document the regression instead of collecting runtime evidence.

## Preflight Results

- Run timestamp: `2026-03-08T00:28Z`
- Backend command:

```bash
pnpm --filter agent exec vitest run src/deck-intelligence/__tests__/auto-infer-cron.test.ts src/mastra/__tests__/deck-structure-routes.test.ts
```

  - Result: passed
  - Coverage for this preflight: 2 files, 7 tests passed
  - Note: the artifact-qualified cron loop and deck-structure route chain are green immediately before live verification.

- Frontend command:

```bash
pnpm --filter web exec vitest run src/components/settings/__tests__/touch-4-artifact-tabs.test.tsx src/components/slide-viewer/__tests__/classification-panel.test.tsx src/app/api/deck-structures/chat/__tests__/route.test.ts
```

  - Result: passed
  - Coverage for this preflight: 3 files, 19 tests passed
  - Note: the pending Phase 37 browser checks still require live human confirmation, but there is no fresh targeted regression failure to confuse with environment-only issues.

- Gate decision: proceed to Phase 38 live verification using the locked production environment above.
