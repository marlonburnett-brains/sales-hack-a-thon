---
phase: 13
slug: touch-4-poll-loop-and-integration-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual testing + Next.js build validation |
| **Config file** | none |
| **Quick run command** | `cd apps/web && npx next build` |
| **Full suite command** | `cd apps/web && npx next build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npx next build`
- **After every plan wave:** Run `cd apps/web && npx next build` + manual E2E flow test
- **Before `/gsd:verify-work`:** Full build must be green + all 5 success criteria manually verified
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | SC-1 | manual + build | `cd apps/web && npx next build` | ✅ | ⬜ pending |
| 13-01-02 | 01 | 1 | SC-2 | manual + build | `cd apps/web && npx next build` | ✅ | ⬜ pending |
| 13-01-03 | 01 | 1 | SC-3 | manual + build | `cd apps/web && npx next build` | ✅ | ⬜ pending |
| 13-01-04 | 01 | 1 | SC-4 | manual + build | `cd apps/web && npx next build` | ✅ | ⬜ pending |
| 13-01-05 | 01 | 1 | SC-5 | manual | N/A (E2E flow) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Build validation is sufficient for type safety. No automated test framework needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Poll loop starts after brief approval, shows TOUCH_4_ASSET_PIPELINE_STEPS progress | SC-1 | Requires running workflow with real Mastra engine | 1. Create deal, upload transcript 2. Wait for brief generation 3. Approve brief 4. Verify stepper appears with 7 steps updating in real time |
| Asset-review banner appears automatically when pipeline completes | SC-2 | Requires full pipeline completion | 1. Complete SC-1 flow 2. Wait for all 7 steps to complete 3. Verify banner appears without page refresh |
| Pre-call form reads correct field from record-interaction | SC-3 | Requires actual workflow run | 1. Start pre-call flow 2. Verify form populates from primary data path (not fallback) |
| Timeline shows "Pre-Call" label with teal color | SC-4 | Visual verification | 1. Complete a pre-call interaction 2. Check timeline entry shows "Pre-Call" label with teal-100/teal-800 colors |
| Touch 4 E2E: transcript to asset-review without manual intervention | SC-5 | Full E2E integration test | 1. Upload transcript 2. Wait through all stages 3. Approve brief 4. Wait for asset pipeline 5. Verify asset review link appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
