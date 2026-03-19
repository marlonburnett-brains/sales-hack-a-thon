---
phase: 68
slug: medium-complexity-tutorials-deals-briefing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 68 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (capture specs as functional tests) |
| **Config file** | `apps/tutorials/playwright.config.ts` |
| **Quick run command** | `pnpm --filter tutorials capture <tutorial-name>` |
| **Full suite command** | `pnpm --filter tutorials capture deals && pnpm --filter tutorials capture deal-overview && pnpm --filter tutorials capture deal-chat && pnpm --filter tutorials capture briefing` |
| **Estimated runtime** | ~120 seconds (4 tutorials × ~30s each) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter tutorials capture <tutorial-name>` for the tutorial being authored
- **After every plan wave:** Run full suite command for all four tutorials
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 68-01-01 | 01 | 1 | TUT-04 | smoke | `pnpm --filter tutorials capture deals` | ❌ W0 | ⬜ pending |
| 68-01-02 | 01 | 1 | TUT-05 | smoke | `pnpm --filter tutorials capture deal-overview` | ❌ W0 | ⬜ pending |
| 68-01-03 | 01 | 1 | TUT-06 | smoke | `pnpm --filter tutorials capture deal-chat` | ❌ W0 | ⬜ pending |
| 68-01-04 | 01 | 1 | TUT-07 | smoke | `pnpm --filter tutorials capture briefing` | ❌ W0 | ⬜ pending |
| 68-02-01 | 02 | 2 | TUT-04 | smoke | `pnpm --filter tutorials tts deals && pnpm --filter tutorials render deals` | ❌ W0 | ⬜ pending |
| 68-02-02 | 02 | 2 | TUT-05 | smoke | `pnpm --filter tutorials tts deal-overview && pnpm --filter tutorials render deal-overview` | ❌ W0 | ⬜ pending |
| 68-02-03 | 02 | 2 | TUT-06 | smoke | `pnpm --filter tutorials tts deal-chat && pnpm --filter tutorials render deal-chat` | ❌ W0 | ⬜ pending |
| 68-02-04 | 02 | 2 | TUT-07 | smoke | `pnpm --filter tutorials tts briefing && pnpm --filter tutorials render briefing` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `capture/deals.spec.ts` — capture spec for TUT-04
- [ ] `capture/deal-overview.spec.ts` — capture spec for TUT-05
- [ ] `capture/deal-chat.spec.ts` — capture spec for TUT-06
- [ ] `capture/briefing.spec.ts` — capture spec for TUT-07
- [ ] `fixtures/deals/script.json` — 12-15 step tutorial script
- [ ] `fixtures/deals/overrides.json` — 5-8 deals with varied statuses
- [ ] `fixtures/deal-overview/script.json` — 8-12 step tutorial script
- [ ] `fixtures/deal-overview/overrides.json` — interactions for metrics
- [ ] `fixtures/deal-chat/script.json` — 10-14 step tutorial script
- [ ] `fixtures/deal-chat/overrides.json` — base chat state
- [ ] `fixtures/deal-chat/stages/*.json` — chat message progression stages
- [ ] `fixtures/briefing/script.json` — 10-14 step tutorial script
- [ ] `fixtures/briefing/overrides.json` — base briefing state
- [ ] `fixtures/briefing/stages/*.json` — idle/generating/complete/history stages
- [ ] Mock server: stage-aware `GET /deals/:dealId/chat` route
- [ ] Route-mocks: stage-aware browser-side chat GET proxy

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| MP4 video quality | TUT-04–07 | Visual inspection required | Watch rendered MP4s, check narration sync, zoom/callout placement |
| Narration accuracy | TUT-04–07 | Semantic quality check | Listen to TTS audio, verify it matches tutorial steps |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
