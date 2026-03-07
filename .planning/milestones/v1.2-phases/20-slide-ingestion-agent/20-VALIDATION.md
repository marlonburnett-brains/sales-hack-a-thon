---
phase: 20
slug: slide-ingestion-agent
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-05
updated: 2026-03-06
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (apps/agent + apps/web) |
| **Config file** | `apps/agent/vitest.config.ts`, `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm --filter agent exec vitest run && pnpm --filter web exec vitest run` |
| **Full suite command** | `pnpm lint && pnpm typecheck && pnpm build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter agent build && pnpm --filter web build`
- **After every plan wave:** Run `pnpm lint && pnpm typecheck && pnpm build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | SLIDE-06 | build | `pnpm --filter agent build` | yes | green |
| 20-01-02 | 01 | 1 | SLIDE-06 | build | `pnpm --filter agent build` | yes | green |
| 20-02-01 | 02 | 1 | SLIDE-02, SLIDE-03 | build | `pnpm --filter agent build` | yes | green |
| 20-02-02 | 02 | 1 | SLIDE-04 | build | `pnpm --filter agent build` | yes | green |
| 20-02-03 | 02 | 1 | SLIDE-05, SLIDE-08 | build | `pnpm --filter agent build` | yes | green |
| 20-02-04 | 02 | 1 | SLIDE-02, SLIDE-06 | build | `pnpm --filter agent build` | yes | green |
| 20-03-01 | 03 | 2 | SLIDE-07 | build | `pnpm --filter web build` | yes | green |
| 20-03-02 | 03 | 2 | SLIDE-07 | manual | Visual: observe progress bar on template card | N/A | manual-only |
| 20-04-01 | 04 | 2 | SLIDE-02 | build | `pnpm --filter agent build` | yes | green |
| SLIDE-06 | 01 | 1 | Smart merge idempotency | unit | `pnpm --filter agent exec vitest run src/ingestion/__tests__/smart-merge.test.ts` | yes | green |
| SLIDE-08 | 01 | 1 | Content hash identity | unit | `pnpm --filter agent exec vitest run src/ingestion/__tests__/smart-merge.test.ts` | yes | green |
| SLIDE-07 | 02 | 2 | Progress UI status logic | unit | `pnpm --filter web exec vitest run src/lib/__tests__/template-utils.test.ts` | yes | green |

*Status: pending · green · red · flaky · manual-only*

---

## Wave 0 Requirements

*vitest installed in apps/agent (devDependency). Config at apps/agent/vitest.config.ts modeled after apps/web/vitest.config.ts. Pure function tests for smart-merge module cover SLIDE-06 and SLIDE-08.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-time progress bar on template card | SLIDE-07 | Visual UI behavior requires human observation | 1. Add a template with valid access 2. Watch template card for progress bar "Slide N of M" 3. Verify completion toast appears |
| Auto-trigger ingestion on template add | SLIDE-02 | Requires end-to-end UI flow with Google API credentials | 1. Add new template via UI 2. Verify ingestion starts automatically after access confirmed |
| Extract text from slides via Google Slides API | SLIDE-03 | Requires live Google Slides API credentials and a real presentation | 1. Trigger ingestion on a template 2. Verify slides are extracted and text content populated |
| Classify slides with confidence via Gemini | SLIDE-04 | Requires live Gemini/Vertex AI API credentials | 1. Trigger ingestion 2. Verify classificationJson and confidence (0-100) are stored on SlideEmbedding rows |
| Generate Vertex AI embeddings | SLIDE-05 | Requires live Vertex AI credentials | 1. Trigger ingestion 2. Verify embedding column is populated with 768-dim vector |
| Background staleness polling | SLIDE-02 | Requires live Google Drive API and a modified presentation | 1. Ingest a template 2. Modify presentation in Google Slides 3. Wait 5+ minutes 4. Verify auto-re-ingestion triggers |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated (2026-03-06)
