# Phase 38: Live Verification Sweep - Research

**Researched:** 2026-03-08
**Domain:** Live-environment verification for Touch 4 artifact workflows across deployed web, agent, and persistence layers
**Confidence:** MEDIUM

## User Constraints

- No phase-specific `38-CONTEXT.md` exists yet.
- Locked scope from the roadmap/prompt: verification closure only for v1.6 Touch 4 artifact work; do not expand into new product features.
- Must clear two existing debts from prior phases:
  - backend live streaming confirmation against a reachable environment
  - backend cron confirmation in a live-like environment with artifact-qualified Touch 4 evidence
  - frontend human browser confirmation for cross-surface reload behavior
  - frontend human browser confirmation for Touch 4 settings tabs and chat artifact scoping
- Success criteria to plan against:
  - live external-service streaming behavior is exercised and documented against a reachable environment
  - background cron behavior is re-confirmed with artifact-qualified Touch 4 processing evidence
  - human browser validation confirms cross-surface Touch 4 classification reload behavior end to end
  - human browser validation confirms Touch 4 settings tab and chat behavior stay artifact-scoped end to end

## Summary

Phase 38 should be planned as an evidence-gathering and verification phase, not an implementation phase. The code paths already exist and are covered by targeted Vitest suites: the remaining work is proving that the deployed or otherwise reachable stack behaves correctly when real browser sessions, real Next.js streaming proxies, real Mastra server streams, real Vertex AI calls, and the background cron loop are involved.

The key planning insight is that each success criterion needs two kinds of proof: user-visible proof and system proof. For chat streaming, that means both a browser-observable progressive response and backend evidence that the artifact-qualified deck structure row was updated. For cron, that means both proof that the loop ran for the right artifact-qualified Touch 4 key and proof that the persisted `DeckStructure` row reflects the expected artifact-specific inference result. For frontend reload and settings behavior, the prior Phase 37 verification already defined the exact human checks; this phase just needs those checks executed on a reachable environment and documented.

The main risk is environment access, not code uncertainty. The repo is deployed as Next.js 15 web on Vercel and Mastra agent on Railway, with Supabase PostgreSQL persistence and Vertex AI-backed `@google/genai` calls. Localhost-only validation is explicitly insufficient because the prior blocker was that remote browser automation could not reach the local app. Plan around one reachable environment with valid auth, at least one viable Touch 4 template to classify, and a way to inspect logs or persisted deck-structure rows after actions complete.

**Primary recommendation:** Plan Phase 38 as one tightly scoped verification runbook that couples manual browser steps with artifact-qualified API/log/database evidence for the same actions, and require all evidence to come from a reachable environment rather than localhost.

## Standard Stack

### Core
| Library / System | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js web app on Vercel | `15.5.12` | Reachable browser surface and streaming proxy route | Existing deployed frontend and route-handler layer for `/api/deck-structures/chat` |
| Mastra agent on Railway | `@mastra/core ^1.8.0`, `mastra ^1.3.5` | Live deck-structure API routes and in-process cron loop | Existing deployed backend where `startDeckInferenceCron()` and chat streaming run |
| Supabase PostgreSQL + Prisma | Prisma `^6.3.1` | Persistence evidence for `DeckStructure` and `DeckChatMessage` rows | Existing source of truth for artifact-qualified inference/chat results |
| Google Gen AI on Vertex AI | `@google/genai ^1.43.0` | Real streaming chat generation and inference re-runs | Phase 38 specifically needs live external-service confirmation |

### Supporting
| Library / System | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | `^4.0.18` | Fast regression check before live verification | Re-run targeted suites first so live failures are not confused with known code regressions |
| Testing Library | `^16.3.2` | Defines the existing UI assertions already covered in tests | Use as supporting evidence for what the browser steps are meant to validate |
| `curl` / browser devtools network inspection | built-in | Observe chunked chat response behavior on reachable endpoints | Use when you need raw transport proof in addition to UI proof |
| Railway/Vercel logs plus DB row inspection | deployed platform tooling | Confirm cron execution and persisted artifact-qualified results | Use for live backend evidence, especially when UI does not expose timing internals |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reachable deployed/staging environment | Localhost only | Repeats the exact blocker from Phase 37; does not satisfy the live-environment requirement |
| Evidence tied to one artifact-qualified row | Generic screenshots or broad logs | Too weak to prove Proposal/Talk Track/FAQ scoping stayed correct |
| Existing app routes and persisted rows | One-off debug scripts or temporary admin pages | Adds code churn to a verification-only phase and risks creating new debt |

**Installation:**
```bash
# No new packages required for Phase 38.
pnpm --filter agent exec vitest run src/deck-intelligence/__tests__/auto-infer-cron.test.ts src/mastra/__tests__/deck-structure-routes.test.ts
pnpm --filter web exec vitest run src/components/settings/__tests__/touch-4-artifact-tabs.test.tsx src/components/slide-viewer/__tests__/classification-panel.test.tsx src/app/api/deck-structures/chat/__tests__/route.test.ts
```

## Architecture Patterns

### Recommended Project Structure
```text
apps/web/src/
├── app/api/deck-structures/chat/route.ts          # live streaming proxy
├── app/(authenticated)/settings/deck-structures/[touchType]/page.tsx
├── components/settings/touch-4-artifact-tabs.tsx  # human browser tab verification
├── components/settings/touch-type-detail-view.tsx # artifact-scoped detail + chat
└── components/slide-viewer/classification-panel.tsx # reload badge verification

apps/agent/src/
├── mastra/index.ts                                # streaming route + cron startup
├── deck-intelligence/chat-refinement.ts           # Vertex streaming + row updates
└── deck-intelligence/auto-infer-cron.ts           # 10-minute background sweep

apps/agent/prisma/schema.prisma                    # persisted evidence fields
```

### Pattern 1: Evidence-first verification pairing
**What:** Every manual or live action should produce a paired backend artifact: screenshot/video + network trace, or UI observation + DB/log record.
**When to use:** For all four success criteria.
**Example:**
```text
Action: Send Touch 4 Proposal chat refinement from Settings tab
Proof A: Browser shows progressive assistant text before structure update lands
Proof B: Matching DeckStructure(touch_4, proposal) row updates lastChatAt/chatContextJson
```

### Pattern 2: Verify the existing two-hop stream, not just the final result
**What:** The live path is browser -> Next.js route handler proxy -> Mastra `ReadableStream` -> Vertex AI chunks -> delimiter -> JSON structure payload.
**When to use:** For success criterion 1 and the settings-chat portion of criterion 4.
**Example:**
```typescript
// Source: apps/web/src/app/api/deck-structures/chat/route.ts
return new Response(agentRes.body, {
  headers: {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
  },
});

// Source: apps/agent/src/mastra/index.ts
controller.enqueue(encoder.encode("\n---STRUCTURE_UPDATE---\n"));
controller.enqueue(encoder.encode(JSON.stringify({ updatedStructure, diff })));
```

### Pattern 3: Treat cron as an artifact-qualified row verifier
**What:** Cron success is not just "the loop ran"; it must prove the correct `(touchType, artifactType)` key was evaluated and persisted.
**When to use:** For success criterion 2.
**Example:**
```typescript
// Source: apps/agent/src/deck-intelligence/auto-infer-cron.ts
for (const key of getDeckStructureCronKeys()) {
  const existing = await prisma.deckStructure.findFirst({
    where: {
      touchType: key.touchType,
      artifactType: key.artifactType,
    },
  });
}
```

### Pattern 4: Use the Phase 37 human checks unchanged, just on a reachable environment
**What:** The browser scenarios are already known: classification from both surfaces with reload, then Touch 4 settings tab and chat checks.
**When to use:** For success criteria 3 and 4.
**Example:**
```text
1. Classify the same template as Example + Touch 4 from Templates and Slides
2. Refresh both surfaces
3. Confirm saved badge still includes Proposal / Talk Track / FAQ
4. Open /settings/deck-structures/touch-4
5. Confirm Proposal default, per-tab confidence context, and artifact-scoped chat
```

### Anti-Patterns to Avoid
- **Local-only proof:** `localhost:3000` screenshots or localhost curl output do not close the known reachable-environment gap.
- **Final-text-only chat checks:** A completed response alone does not prove live streaming worked; verify chunked/progressive behavior.
- **Generic Touch 4 evidence:** Do not accept evidence that omits `artifactType`; Phase 38 is specifically about artifact-qualified behavior.
- **Cron by assumption:** A 10-minute wait without logs or row changes is not verification.
- **Mixing implementation with verification:** Avoid adding new routes, toggles, or UI just to inspect this behavior unless a hard blocker is proven.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Live stream inspection | Temporary debug stream endpoint | Existing `/api/deck-structures/chat` and agent chat route | The production path itself is what must be verified |
| Artifact label/source-of-truth mapping | Manual notes of "tab 1/tab 2/tab 3" | Shared `artifactType` values: `proposal`, `talk_track`, `faq` | Prevents ambiguous evidence |
| Cron confirmation | Ad hoc timer script | Existing `startDeckInferenceCron()` logs plus persisted `DeckStructure` row timestamps/hashes | Verifies the real background path |
| Browser acceptance checklist | New QA matrix from scratch | Existing pending checks from `37-VERIFICATION.md` | The missing browser scenarios are already clearly defined |
| Backend result storage inspection | New admin dashboards | Existing `DeckStructure` / `DeckChatMessage` persistence and platform logs | Lower risk and already authoritative |

**Key insight:** Phase 38 should validate the real runtime path end to end, not create a second "verification system" beside it.

## Common Pitfalls

### Pitfall 1: Using an unreachable environment again
**What goes wrong:** Browser confirmation remains blocked exactly as it was in Phase 37.
**Why it happens:** Validation is attempted from a runner or machine that cannot access the target app.
**How to avoid:** Lock the plan to one reachable environment URL before execution and confirm login access up front.
**Warning signs:** `Upstream proxy refused connection`, broken auth redirects, or localhost-only URLs in evidence.

### Pitfall 2: Confusing successful response with successful streaming
**What goes wrong:** The chat feature appears to work, but the system may have buffered the whole response and lost progressive streaming behavior.
**Why it happens:** Evidence captures only the final state.
**How to avoid:** Record progressive text arrival in the browser or inspect chunked response behavior with `curl -N`/network tools.
**Warning signs:** All assistant text appears at once, or only the final `---STRUCTURE_UPDATE---` payload is observed.

### Pitfall 3: Cron evidence is polluted by prior rows or recent chat protection
**What goes wrong:** You cannot tell whether the observed row came from the current verification run, or cron skips a key because `lastChatAt` is still fresh.
**Why it happens:** `auto-infer-cron.ts` skips rows chatted within the last 30 minutes.
**How to avoid:** Record the pre-run row state first, choose a key that is not chat-blocked, and capture post-run timestamps/hash changes.
**Warning signs:** Logs show `Skipping touch_4/... — active chat session`, or `inferredAt` does not move after the wait window.

### Pitfall 4: Evidence does not prove artifact scoping
**What goes wrong:** Verification says "Touch 4 works" without proving Proposal, Talk Track, and FAQ stayed isolated.
**Why it happens:** Screenshots/logs omit the artifact key.
**How to avoid:** Every captured artifact should name the exact `artifactType` and route/tab being exercised.
**Warning signs:** Notes refer only to "Touch 4" or one generic settings page with no tab-specific evidence.

### Pitfall 5: Browser flow changes data without a traceable backend checkpoint
**What goes wrong:** Human validation passes visually, but there is no backend evidence that persistence/reload was using the expected saved state.
**Why it happens:** Reload checks stop at UI badges.
**How to avoid:** Pair classification-reload checks with the persisted template `artifactType` and the settings-route revalidation effect.
**Warning signs:** Badge text is correct once, but no saved row or refresh evidence is captured.

### Pitfall 6: README setup instructions are treated as authoritative for migrations
**What goes wrong:** Someone reaches for `db push` while preparing an environment.
**Why it happens:** `README.md` still mentions `db:push`, but `CLAUDE.md` forbids it.
**How to avoid:** Follow `CLAUDE.md` and `DEPLOY.md`; use forward-only Prisma migrations only.
**Warning signs:** Any environment-prep step mentions `prisma db push` or reset-style database commands.

## Code Examples

Verified patterns from repo sources and official docs:

### Live chat request must include artifact-qualified Touch 4 scope
```bash
# Source: apps/web/src/app/api/deck-structures/chat/route.ts
curl -N -X POST "https://<reachable-web>/api/deck-structures/chat" \
  -H "Content-Type: application/json" \
  --data '{
    "touchType": "touch_4",
    "artifactType": "proposal",
    "message": "Tighten the proposal flow around ROI"
  }'
```

### Next.js route handlers can stream Web `Response` bodies directly
```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/route
export async function GET() {
  const stream = new ReadableStream({
    async pull(controller) {
      controller.enqueue(new TextEncoder().encode("chunk"));
      controller.close();
    },
  });

  return new Response(stream);
}
```

### Google Gen AI streaming is chunk-based and iterable
```typescript
// Source: https://github.com/googleapis/js-genai/blob/main/README.md
const response = await ai.models.generateContentStream({
  model: "gemini-2.5-flash",
  contents: "Write a 100-word poem.",
});

for await (const chunk of response) {
  console.log(chunk.text);
}
```

### Persisted artifact-qualified cron/chat evidence fields
```prisma
// Source: apps/agent/prisma/schema.prisma
model DeckStructure {
  touchType       String
  artifactType    String?
  dataHash        String?
  inferredAt      DateTime @default(now())
  lastChatAt      DateTime?
  chatContextJson String?
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Automated approval as a substitute for live confirmation | Reachable-environment confirmation is now the explicit debt to close | v1.6 post-audit | Phase 38 must collect runtime evidence, not just rerun tests |
| Generic Touch 4 thinking | Artifact-qualified Touch 4 keys for `proposal`, `talk_track`, `faq` | Phase 36-37 | Every verification artifact must stay artifact-scoped |
| Local browser validation attempt | Human/browser validation on a reachable environment | Phase 37 blocker discovered on 2026-03-07 | Planning must include environment access and auth readiness first |

**Deprecated/outdated:**
- Treating Phase 36 and Phase 37 automated reports as sufficient closure for v1.6
- Accepting generic Touch 4 screenshots or logs with no `artifactType` evidence
- Using README database guidance that conflicts with `CLAUDE.md` migration rules

## Open Questions

1. **Which reachable environment will be the source of truth for Phase 38?**
   - What we know: Localhost is not enough; deployed web/agent stack exists on Vercel/Railway.
   - What's unclear: The exact URL and whether auth/log/DB access are available to the verifier.
   - Recommendation: Lock this before planning tasks; every verification artifact should cite the same environment.

2. **How will cron evidence be captured operationally?**
   - What we know: Cron starts in-process at agent startup and runs every 10 minutes, logging key labels and skip/re-infer outcomes.
   - What's unclear: Whether the planner should rely on Railway logs, DB row inspection, or both.
   - Recommendation: Require both when possible: logs for loop execution, DB row fields for persisted artifact-qualified proof.

3. **Does the target environment already have viable Touch 4 data for all three artifacts?**
   - What we know: UI and backend support Proposal / Talk Track / FAQ, but live verification needs usable examples and a reachable authenticated browser session.
   - What's unclear: Whether data seeding/prep is needed before verification starts.
   - Recommendation: Add a Wave 0-style readiness check for at least one known template that can be classified and reloaded, plus enough artifact data to make cron/chat evidence meaningful.

## Sources

### Primary (HIGH confidence)
- `.planning/ROADMAP.md` - Phase 38 goal, success criteria, and dependency chain
- `.planning/v1.6-v1.6-MILESTONE-AUDIT.md` - exact v1.6 verification debt to close
- `.planning/milestones/v1.6-phases/36-backend-engine-api-routes/36-VERIFICATION.md` - backend debt carried into Phase 38
- `.planning/phases/37-frontend-ui/37-VERIFICATION.md` - pending browser checks carried into Phase 38
- `apps/agent/src/deck-intelligence/auto-infer-cron.ts` - live cron interval, key loop, and skip behavior
- `apps/agent/src/deck-intelligence/chat-refinement.ts` - live Vertex streaming and fallback behavior
- `apps/agent/src/mastra/index.ts` - startup cron registration and streaming route response shape
- `apps/web/src/app/api/deck-structures/chat/route.ts` - Next.js streaming proxy contract
- `apps/web/src/components/settings/chat-bar.tsx` - client stream parsing and delimiter handling
- `apps/web/src/components/settings/touch-4-artifact-tabs.tsx` - default Proposal tab and per-artifact summaries
- `apps/web/src/components/settings/touch-type-detail-view.tsx` - artifact-aware chat and empty-state behavior
- `apps/web/src/components/classification/template-classification-controls.tsx` - cross-surface Touch 4 classification rules
- `apps/agent/prisma/schema.prisma` - persisted evidence fields for deck-structure verification
- `apps/agent/src/env.ts`, `apps/web/src/env.ts`, `DEPLOY.md` - required runtime environment contract
- https://nextjs.org/docs/app/api-reference/file-conventions/route - route handler and Web `Response` streaming guidance (version 16.1.6 page, updated 2026-02-27)

### Secondary (MEDIUM confidence)
- https://github.com/googleapis/js-genai/blob/main/README.md - official SDK streaming examples and Vertex initialization guidance
- https://vitest.dev/guide/ - current Vitest usage guidance for targeted `vitest run`
- https://testing-library.com/docs/queries/byrole/ - role-based assertions matching existing web tests

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - repo packages, deployment docs, and runtime env contracts are directly verifiable
- Architecture: MEDIUM - the verification workflow is clear, but exact environment/log/DB access still needs confirmation
- Pitfalls: HIGH - they are directly supported by prior verification reports, runtime code, and the milestone audit

**Research date:** 2026-03-08
**Valid until:** 2026-04-07
