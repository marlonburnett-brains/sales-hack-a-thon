---
phase: 21
slug: preview-review-engine
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-06
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | apps/web/vitest.config.ts |
| **Quick run command** | `cd apps/web && npx vitest run` |
| **Full suite command** | `cd apps/web && npx vitest run` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npx vitest run`
- **After every plan wave:** Run `cd apps/web && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | PREV-05 | unit | `cd apps/web && npx vitest run src/lib/__tests__/slide-api-client.test.ts` | ✅ | ✅ green |
| 21-02-01 | 02 | 2 | PREV-01 | unit | `cd apps/web && npx vitest run src/components/slide-viewer/__tests__/slide-viewer-navigation.test.tsx` | ✅ | ✅ green |
| 21-02-02 | 02 | 2 | PREV-02, PREV-03, PREV-04 | unit | `cd apps/web && npx vitest run src/components/slide-viewer/__tests__/classification-panel.test.tsx` | ✅ | ✅ green |
| 21-03-01 | 03 | 2 | SLIDE-09 | unit | `cd apps/web && npx vitest run src/components/slide-viewer/__tests__/similarity-results.test.tsx` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. vitest was already configured at `apps/web/vitest.config.ts`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Slide viewer visual layout (16:9 aspect, colors, spacing) | PREV-01 | Visual rendering requires browser | Navigate to /templates/:id/slides, verify slide displays at presentation size |
| Keyboard navigation (ArrowLeft/Right) | PREV-01 | Keyboard events require browser runtime | Press arrow keys while viewing slides |
| Rating and tag editing flow (multi-step UI) | PREV-03, PREV-04 | State transitions require interactive browser | Click ThumbsDown, modify tags, click Save |
| Similarity dialog rendering | SLIDE-09 | Dialog + loading states require browser | Click "Find Similar", verify dialog opens with results |

---

## Test Files Created

| File | Tests | Requirements Covered |
|------|-------|---------------------|
| `apps/web/src/lib/__tests__/slide-api-client.test.ts` | 7 | PREV-05 (api-client functions, fetch contracts) |
| `apps/web/src/components/slide-viewer/__tests__/classification-panel.test.tsx` | 10 | PREV-02, PREV-03, PREV-04 (tag parsing, rating logic, tag editing) |
| `apps/web/src/components/slide-viewer/__tests__/similarity-results.test.tsx` | 11 | SLIDE-09 (similarity scoring, result formatting, cross-template display) |
| `apps/web/src/components/slide-viewer/__tests__/slide-viewer-navigation.test.tsx` | 9 | PREV-01 (navigation logic, boundary clamping, keyboard mapping) |

**Total: 37 tests, 4 files, all green**

---

## Validation Audit 2026-03-06

| Metric | Count |
|--------|-------|
| Gaps found | 6 |
| Resolved | 6 |
| Escalated | 0 |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 2s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-06
