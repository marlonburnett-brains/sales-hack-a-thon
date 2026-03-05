---
phase: 20
slug: slide-ingestion-agent
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual validation (no automated test framework configured) |
| **Config file** | none |
| **Quick run command** | `pnpm --filter agent build && pnpm --filter web build` |
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
| 20-01-01 | 01 | 1 | SLIDE-06 | build | `pnpm --filter agent build` | ✅ | ⬜ pending |
| 20-01-02 | 01 | 1 | SLIDE-06 | build | `pnpm --filter agent build` | ✅ | ⬜ pending |
| 20-02-01 | 02 | 1 | SLIDE-02, SLIDE-03 | build | `pnpm --filter agent build` | ✅ | ⬜ pending |
| 20-02-02 | 02 | 1 | SLIDE-04 | build | `pnpm --filter agent build` | ✅ | ⬜ pending |
| 20-02-03 | 02 | 1 | SLIDE-05, SLIDE-08 | build | `pnpm --filter agent build` | ✅ | ⬜ pending |
| 20-02-04 | 02 | 1 | SLIDE-02, SLIDE-06 | build | `pnpm --filter agent build` | ✅ | ⬜ pending |
| 20-03-01 | 03 | 2 | SLIDE-07 | build | `pnpm --filter web build` | ✅ | ⬜ pending |
| 20-03-02 | 03 | 2 | SLIDE-07 | manual | Visual: observe progress bar on template card | N/A | ⬜ pending |
| 20-04-01 | 04 | 2 | SLIDE-02 | build | `pnpm --filter agent build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No test framework to install — validation is build-time type checking + manual smoke testing, consistent with project approach.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-time progress bar on template card | SLIDE-07 | Visual UI behavior requires human observation | 1. Add a template with valid access 2. Watch template card for progress bar "Slide N of M" 3. Verify completion toast appears |
| Ingestion idempotency (smart merge) | SLIDE-06 | Requires re-ingesting same template and comparing results | 1. Ingest a template 2. Re-ingest same template 3. Verify no duplicates, unchanged slides preserved |
| Auto-trigger on template add | SLIDE-02 | Requires end-to-end UI flow | 1. Add new template via UI 2. Verify ingestion starts automatically after access confirmed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
