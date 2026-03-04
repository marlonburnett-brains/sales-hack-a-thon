---
phase: 4
slug: touch-1-3-asset-generation-interaction-tracking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-03
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual smoke testing (no automated test framework configured — hackathon context) |
| **Config file** | none — Wave 0 installs shadcn/ui and runs Prisma migration |
| **Quick run command** | `pnpm --filter agent validate-schemas` |
| **Full suite command** | Manual: run all three touch flows end-to-end |
| **Estimated runtime** | ~60 seconds per touch flow (includes Google API calls) |

---

## Sampling Rate

- **After every task commit:** Visual verification of UI + Prisma query for data records
- **After every plan wave:** Full Touch 1 flow end-to-end, then full Touch 2/3 flow
- **Before `/gsd:verify-work`:** All three touch flows generate decks successfully; interaction records visible in timeline
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | TOUCH1-01 | smoke | Manual: submit Touch 1 form, verify deck in Drive | N/A | ⬜ pending |
| 04-01-02 | 01 | 1 | TOUCH1-02 | smoke | Manual: review summary card, approve, verify deck | N/A | ⬜ pending |
| 04-01-03 | 01 | 1 | TOUCH1-03 | smoke | Manual: check per-deal Drive folder after generation | N/A | ⬜ pending |
| 04-01-04 | 01 | 1 | TOUCH1-04 | smoke | Manual: approve and override, check Prisma InteractionRecord + FeedbackSignal | N/A | ⬜ pending |
| 04-01-05 | 01 | 1 | TOUCH1-05 | smoke | Manual: upload custom file, verify in Drive + interaction recorded | N/A | ⬜ pending |
| 04-02-01 | 02 | 1 | TOUCH2-02, TOUCH3-02 | smoke | Manual: verify AI-selected slides match industry/capability context | N/A | ⬜ pending |
| 04-02-02 | 02 | 1 | TOUCH2-03, TOUCH3-03 | smoke | Manual: verify assembly engine produces customized deck | N/A | ⬜ pending |
| 04-02-03 | 02 | 1 | DATA-04 | smoke | Manual: check Drive ingestion folder for override content | N/A | ⬜ pending |
| 04-03-01 | 03 | 2 | TOUCH2-01, TOUCH2-04 | smoke | Manual: fill Touch 2 form, verify deck + Drive output | N/A | ⬜ pending |
| 04-03-02 | 03 | 2 | TOUCH3-01, TOUCH3-04 | smoke | Manual: fill Touch 3 form, verify deck + Drive output | N/A | ⬜ pending |
| 04-03-03 | 03 | 2 | DATA-01, DATA-03 | smoke | Manual: query InteractionRecord + FeedbackSignal tables after each flow | N/A | ⬜ pending |
| 04-03-04 | 03 | 2 | DATA-05 | smoke | Manual: verify deal page timeline shows all interactions with expandable detail | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pnpm dlx shadcn@latest init` — Initialize shadcn/ui in apps/web
- [ ] `pnpm dlx shadcn@latest add button card input label select tabs dialog skeleton badge separator textarea form` — Install required UI components
- [ ] `pnpm add lucide-react` — Icon library for shadcn/ui
- [ ] Prisma migration for Company, Deal, InteractionRecord, FeedbackSignal models
- [ ] No automated test framework — this phase relies on manual smoke testing (hackathon context)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Touch 1 pager generation end-to-end | TOUCH1-01, TOUCH1-02 | Requires Google Slides API + Drive + Gemini interaction | Submit form → verify summary card → approve → check Drive folder for generated deck |
| Touch 1 override upload | TOUCH1-05 | File upload to Drive via agent API | Upload .pptx → verify in Drive folder + interaction record created |
| Touch 2 intro deck generation | TOUCH2-01-04 | Multi-service orchestration (AtlusAI + Slides + Drive) | Fill form → verify generated deck has correct slides + customizations |
| Touch 3 capability deck generation | TOUCH3-01-04 | Multi-service orchestration (AtlusAI + L2 decks + Slides + Drive) | Fill form → verify capability-specific slides selected + assembled |
| Iframe preview rendering | TOUCH1-02, TOUCH2-03, TOUCH3-03 | Browser rendering of embedded Google Slides | Verify iframe loads and shows deck content without permission errors |
| Interaction timeline display | DATA-05 | Visual UI verification | Navigate to deal page → verify timeline entries with correct touch types, timestamps, statuses |
| AtlusAI re-ingestion of overrides | DATA-04 | Requires AtlusAI Drive folder monitoring | Override a pager → verify document appears in AtlusAI ingestion folder |
| Cross-touch context pre-fill | DATA-05 | State carried across multiple form submissions | Generate Touch 1 → open Touch 2 → verify form pre-filled from deal record |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
