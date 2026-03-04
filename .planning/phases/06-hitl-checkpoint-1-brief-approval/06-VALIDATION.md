---
phase: 6
slug: hitl-checkpoint-1-brief-approval
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-03
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification (no automated test framework configured) |
| **Config file** | none |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | Manual walkthrough: generate brief → approve AND generate → reject → resubmit → approve |
| **Estimated runtime** | ~60 seconds (type check); ~5 minutes (full manual walkthrough) |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit` + visual smoke test in browser
- **After every plan wave:** Full manual walkthrough of approval flow
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | GEN-04 | manual | Verify workflow suspend at await-brief-approval step | N/A | ⬜ pending |
| 06-01-02 | 01 | 1 | GEN-04 | manual | Verify Brief record has approvalStatus field | N/A | ⬜ pending |
| 06-01-03 | 01 | 1 | GEN-04 | manual | POST resume endpoint resumes workflow only on "approved" | N/A | ⬜ pending |
| 06-01-04 | 01 | 1 | GEN-03 | manual | POST reject endpoint updates status, creates FeedbackSignal | N/A | ⬜ pending |
| 06-02-01 | 02 | 1 | GEN-03 | manual | BriefDisplay renders with approval action bar | N/A | ⬜ pending |
| 06-02-02 | 02 | 1 | GEN-03 | manual | Standalone review page renders brief + deal context | N/A | ⬜ pending |
| 06-02-03 | 02 | 1 | GEN-04 | manual | Polling at 3s interval detects approval state | N/A | ⬜ pending |
| 06-02-04 | 02 | 1 | GEN-04 | manual | Server restart → resume still works | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npx shadcn@latest add alert` — install Alert component for deal page banner

*Existing infrastructure covers all other phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Brief rendered as formatted cards (not raw JSON) | GEN-03, SC-1 | Visual UI verification | Navigate to deal page after brief generation, verify BriefDisplay renders pillar badges, use case cards, ROI outcomes |
| Status polling at 3-second interval | SC-2 | Requires browser devtools | Open Network tab, verify polling requests at ~3s intervals during approval wait |
| No asset generation until approve click | GEN-04, SC-3 | Workflow state inspection | Check Mastra workflow status remains "suspended" at await-brief-approval; verify no downstream steps execute |
| Server restart durability | SC-4 | Requires server restart | Stop agent server, restart, submit approval via review page, verify workflow completes |
| Rejection with feedback + resubmit | SC-5 | Full user flow | Click Reject, enter feedback, verify seller sees feedback, resubmit (both paths), verify new approval cycle |
| Inline edit with FeedbackSignal diff | GEN-03 | Data integrity check | Edit brief fields, save, check Prisma FeedbackSignal table for "edited" entry with before/after |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
