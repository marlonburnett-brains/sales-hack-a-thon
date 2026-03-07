---
phase: 34
slug: deck-intelligence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.x |
| **Config file** | `apps/web/vitest.config.ts` (web), `apps/agent/vitest.config.ts` (agent) |
| **Quick run command** | `cd apps/web && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd apps/web && npx vitest run && cd ../agent && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd apps/web && npx vitest run && cd ../agent && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 34-01-01 | 01 | 1 | DKI-01 | unit | `cd apps/web && npx vitest run src/components/__tests__/sidebar-settings.test.tsx -x` | ❌ W0 | ⬜ pending |
| 34-01-02 | 01 | 1 | DKI-02 | unit | `cd apps/web && npx vitest run src/app/(authenticated)/settings/__tests__/settings-layout.test.tsx -x` | ❌ W0 | ⬜ pending |
| 34-02-01 | 02 | 1 | DKI-03 | unit | `cd apps/web && npx vitest run src/components/settings/__tests__/deck-structure-view.test.tsx -x` | ❌ W0 | ⬜ pending |
| 34-02-02 | 02 | 1 | DKI-04 | unit | `cd apps/web && npx vitest run src/components/settings/__tests__/section-flow.test.tsx -x` | ❌ W0 | ⬜ pending |
| 34-02-03 | 02 | 1 | DKI-05 | unit | `cd apps/web && npx vitest run src/components/settings/__tests__/confidence-badge.test.tsx -x` | ❌ W0 | ⬜ pending |
| 34-03-01 | 03 | 2 | DKI-06 | unit | `cd apps/web && npx vitest run src/components/settings/__tests__/chat-bar.test.tsx -x` | ❌ W0 | ⬜ pending |
| 34-03-02 | 03 | 2 | DKI-07 | integration | `cd apps/agent && npx vitest run src/deck-intelligence/__tests__/chat-refinement.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/src/components/__tests__/sidebar-settings.test.tsx` — sidebar settings link test
- [ ] `apps/web/src/app/(authenticated)/settings/__tests__/settings-layout.test.tsx` — settings layout test
- [ ] `apps/web/src/components/settings/__tests__/deck-structure-view.test.tsx` — deck structure view test
- [ ] `apps/web/src/components/settings/__tests__/section-flow.test.tsx` — section flow test
- [ ] `apps/web/src/components/settings/__tests__/confidence-badge.test.tsx` — confidence badge test
- [ ] `apps/web/src/components/settings/__tests__/chat-bar.test.tsx` — chat bar test
- [ ] `apps/agent/src/deck-intelligence/__tests__/chat-refinement.test.ts` — chat refinement integration test

*No new framework installs needed (Vitest already configured in both apps).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Streaming token-by-token display in chat | DKI-06 | Browser streaming requires real network | 1. Open Settings > Deck Structures 2. Type feedback in chat bar 3. Verify tokens appear progressively |
| Inline diff highlights (green pulse/yellow) | DKI-07 | CSS animation verification | 1. Send chat feedback that changes structure 2. Verify added sections pulse green, modified pulse yellow |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
