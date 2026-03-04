---
phase: 12
slug: content-library-reingestion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification via CLI scripts + coverage report JSON |
| **Config file** | none — ingestion scripts are standalone CLI tools |
| **Quick run command** | `npx tsx --env-file=.env src/ingestion/run-ingestion.ts --manifest-only` |
| **Full suite command** | `npx tsx --env-file=.env src/ingestion/run-ingestion.ts` (full pipeline) |
| **Estimated runtime** | ~120 seconds (manifest-only), ~600+ seconds (full pipeline) |

---

## Sampling Rate

- **After every task commit:** Review script output logs for errors/warnings
- **After every plan wave:** Check coverage-report.json gap list
- **Before `/gsd:verify-work`:** Full suite must be green — all 4 CONT requirements verified via coverage report + manifest inspection
- **Max feedback latency:** 120 seconds (manifest-only mode)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | CONT-01 | smoke | `npx tsx --env-file=.env src/ingestion/run-ingestion.ts --manifest-only` then check coverage-report.json byContentType.template > 0 and totalPresentations > 5 | N/A (operational) | ⬜ pending |
| 12-01-02 | 01 | 1 | CONT-02 | smoke | Check coverage-report.json: at least 1 industry has caseStudies > 0 | N/A (operational) | ⬜ pending |
| 12-01-03 | 01 | 1 | CONT-03 | smoke | `npx tsx --env-file=.env src/ingestion/ingest-brand-guidelines.ts` exits 0 AND `npx tsx --env-file=.env src/ingestion/build-image-registry.ts` exits 0 | N/A (operational) | ⬜ pending |
| 12-01-04 | 01 | 1 | CONT-04 | smoke | Check coverage-report.json: gaps array length (ideally 0, accept if gaps are "no case studies" for industries without Drive content) | N/A (operational) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* Existing ingestion scripts serve as the validation infrastructure. No new test files needed. All verification is done by examining script output and generated JSON reports.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google Drive service account can access shortcut targets | CONT-01 | Requires human sharing of Drive folders to service account | 1. Open Google Drive 2. Share shortcut target folders with service account email 3. Run `--manifest-only` to confirm access |
| Google Docs API enabled on GCP project | CONT-01 | GCP console action required | 1. Go to GCP console project 749490525472 2. Enable Google Docs API 3. Verify with auth test |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
