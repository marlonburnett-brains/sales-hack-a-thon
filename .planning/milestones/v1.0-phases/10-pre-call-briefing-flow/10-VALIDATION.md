---
phase: 10
slug: pre-call-briefing-flow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual validation (no automated test framework configured) |
| **Config file** | none |
| **Quick run command** | Manual: start agent + web, create deal, run pre-call flow |
| **Full suite command** | Manual end-to-end walkthrough |
| **Estimated runtime** | ~60 seconds (full manual walkthrough) |

---

## Sampling Rate

- **After every task commit:** Manual smoke test — verify agent compiles, workflow registers
- **After every plan wave:** End-to-end flow: submit pre-call form → verify briefing display → verify Google Doc in Drive
- **Before `/gsd:verify-work`:** Full walkthrough with 2+ buyer roles for the same deal, verify distinct outputs
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | BRIEF-01 | manual/e2e | Navigate to deal page, fill form, submit | N/A | ⬜ pending |
| 10-01-02 | 01 | 1 | BRIEF-02 | manual/e2e | Check workflow output for CompanyResearch fields | N/A | ⬜ pending |
| 10-01-03 | 01 | 1 | BRIEF-03 | manual/e2e | Compare CIO vs CFO briefing outputs for same company | N/A | ⬜ pending |
| 10-02-01 | 02 | 2 | BRIEF-04 | manual/e2e | Verify 5-10 questions with mappedSolution badges | N/A | ⬜ pending |
| 10-02-02 | 02 | 2 | BRIEF-05 | manual/e2e | Check results UI + verify Doc exists in Drive folder | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No automated test infrastructure to set up — validation is manual e2e for this hackathon project.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Seller submits pre-call form | BRIEF-01 | UI interaction required | Navigate to deal page, fill company name + buyer role + context, submit |
| Company snapshot generated | BRIEF-02 | LLM output quality check | Verify snapshot includes initiatives, news context, financial highlights |
| Role-specific hypotheses | BRIEF-03 | Subjective quality assessment | Run same company with CIO vs CFO persona, compare framing differences |
| Discovery questions with solution mapping | BRIEF-04 | Content quality check | Verify 5-10 questions appear with mappedSolution badges from SOLUTION_PILLARS |
| Briefing in web app + Google Doc | BRIEF-05 | Cross-system verification | Check results UI renders, click Google Doc link, verify Doc in Drive folder |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
