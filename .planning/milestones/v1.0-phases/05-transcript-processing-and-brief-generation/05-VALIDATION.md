---
phase: 5
slug: transcript-processing-and-brief-generation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-03
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None configured (hackathon project — manual verification) |
| **Config file** | none |
| **Quick run command** | Manual smoke test via web UI |
| **Full suite command** | Full end-to-end walkthrough: deal page → Touch 4 form → field review → brief display → timeline card |
| **Estimated runtime** | ~120 seconds (manual) |

---

## Sampling Rate

- **After every task commit:** Manual smoke test — paste a sample transcript, verify field extraction, review fields, check brief output
- **After every plan wave:** Full end-to-end walkthrough from deal page → Touch 4 form → field review → brief display → timeline card
- **Before `/gsd:verify-work`:** All 6 success criteria verified manually
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | TRANS-01 | manual-only | N/A — UI form interaction | N/A | ⬜ pending |
| 05-01-02 | 01 | 1 | TRANS-02 | manual-only | N/A — UI dropdown interaction | N/A | ⬜ pending |
| 05-01-03 | 01 | 1 | DATA-02 | manual-only | N/A — requires full workflow run + DB check | N/A | ⬜ pending |
| 05-02-01 | 02 | 1 | TRANS-03 | manual-only | N/A — requires Gemini API key + live call | N/A | ⬜ pending |
| 05-02-02 | 02 | 1 | TRANS-04 | manual-only | N/A — UI review + workflow suspend state | N/A | ⬜ pending |
| 05-03-01 | 03 | 1 | TRANS-05 | manual-only | N/A — requires Gemini API key + live call | N/A | ⬜ pending |
| 05-03-02 | 03 | 1 | GEN-01 | manual-only | N/A — requires Gemini API key + live call | N/A | ⬜ pending |
| 05-03-03 | 03 | 1 | GEN-02 | manual-only | N/A — requires Gemini API key + live call | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework needed — this is a hackathon project where all requirements involve live Gemini API calls, interactive UI flows, or database state verification through full workflow runs.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Transcript form accepts paste input | TRANS-01 | UI form interaction | Paste sample transcript into form, verify it accepts and displays content |
| Industry/subsector cascading selection | TRANS-02 | UI dropdown interaction | Select industry, verify subsectors filter; change industry, verify subsectors update |
| Gemini extracts 6 structured fields | TRANS-03 | Requires live Gemini API | Submit transcript, verify Customer Context, Business Outcomes, Constraints, Stakeholders, Timeline, Budget fields populated |
| Missing field warnings with severity | TRANS-04 | UI review + workflow suspend | Submit transcript missing Budget, verify warning displayed and acknowledgment required |
| Pillar mapping from transcript | TRANS-05 | Requires live Gemini API | Submit transcript mentioning AI needs, verify primary + secondary pillars identified with evidence |
| Multi-pillar brief with evidence | GEN-01 | Requires live Gemini API | Verify brief shows pillar recommendations with transcript-derived evidence |
| ROI outcomes + value hypothesis | GEN-02 | Requires live Gemini API | Verify 2-3 ROI statements and 1 value hypothesis per use case in brief |
| Transcript + brief persisted | DATA-02 | Requires full workflow + DB | Complete workflow, verify Transcript and Brief records created in database |

---

## Validation Sign-Off

- [x] All tasks have manual verification instructions
- [x] Sampling continuity: manual smoke test after every task commit
- [x] Wave 0 covers all requirements (no automated infra needed)
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
