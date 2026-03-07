---
phase: 29
slug: discovery-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing in project) |
| **Config file** | `apps/agent/vitest.config.ts` / `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm --filter agent test -- --run` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter agent test -- --run`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 29-01-01 | 01 | 1 | DISC-01 | manual-only | Visual check | N/A | ⬜ pending |
| 29-01-02 | 01 | 1 | DISC-02 | manual-only | Visual check | N/A | ⬜ pending |
| 29-01-03 | 01 | 1 | DISC-06 | unit | `pnpm --filter agent test -- --run -t "discovery access"` | ❌ W0 | ⬜ pending |
| 29-02-01 | 02 | 2 | DISC-03 | unit | `pnpm --filter agent test -- --run -t "discovery browse"` | ❌ W0 | ⬜ pending |
| 29-03-01 | 03 | 2 | DISC-04 | unit | `pnpm --filter agent test -- --run -t "discovery search"` | ❌ W0 | ⬜ pending |
| 29-03-02 | 03 | 2 | DISC-05 | unit | `pnpm --filter agent test -- --run -t "discovery search"` | ❌ W0 | ⬜ pending |
| 29-04-01 | 04 | 3 | DISC-07 | unit | `pnpm --filter agent test -- --run -t "discovery ingest"` | ❌ W0 | ⬜ pending |
| 29-04-02 | 04 | 3 | DISC-08 | unit | `pnpm --filter agent test -- --run -t "discovery progress"` | ❌ W0 | ⬜ pending |
| 29-04-03 | 04 | 3 | DISC-09 | unit | `pnpm --filter agent test -- --run -t "discovery ingested"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/agent/src/lib/__tests__/discovery-api.test.ts` — stubs for DISC-03, DISC-04, DISC-05, DISC-06, DISC-07, DISC-08, DISC-09
- [ ] Agent endpoint handlers for `/discovery/*` routes (tested against mocks)

*Existing Vitest infrastructure covers framework setup — no new test dependencies needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AtlusAI sidebar nav item visible | DISC-01 | Visual/layout check | Navigate to any authenticated page, verify "AtlusAI" appears in sidebar with brain icon |
| /discovery route renders both views | DISC-02 | Visual/layout check | Navigate to /discovery, verify browse view loads; type in search bar, verify search results appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
