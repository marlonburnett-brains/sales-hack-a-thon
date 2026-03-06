---
phase: 19
slug: navigation-template-management
status: partial
nyquist_compliant: false
wave_0_complete: true
created: 2026-03-06
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (installed in apps/web) |
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
| 19-01-01 | 01 | 1 | TMPL-05 | unit | `cd apps/web && npx vitest run src/lib/__tests__/template-utils.test.ts` | yes | green |
| 19-01-02 | 01 | 1 | TMPL-06 | integration | — | no | manual-only |
| 19-01-03 | 01 | 1 | TMPL-07 | unit | `cd apps/web && npx vitest run src/lib/__tests__/template-utils.test.ts` | yes | green |
| 19-02-01 | 02 | 1 | NAV-01 | component | — | no | manual-only |
| 19-02-02 | 02 | 1 | NAV-02 | component | — | no | manual-only |
| 19-03-01 | 03 | 2 | TMPL-01 | component | — | no | manual-only |
| 19-03-02 | 03 | 2 | TMPL-02 | component | — | no | manual-only |
| 19-03-03 | 03 | 2 | TMPL-03 | component | — | no | manual-only |
| 19-03-04 | 03 | 2 | TMPL-04 | component | — | no | manual-only |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [x] `apps/web/vitest.config.ts` — Vitest configuration
- [x] `apps/web/src/lib/__tests__/template-utils.test.ts` — Unit tests for TMPL-05 and TMPL-07

*Vitest installed as devDependency in apps/web.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drive access check on template add | TMPL-06 | API integration requires running agent service + Google Drive mocking | 1. Add a template with a Google Slides URL not shared with service account. 2. Verify inline alert shows service account email. 3. Share file, re-add, verify accessible status. |
| Navigate between Deals and Templates | NAV-01 | React component requires RTL + Next.js mocking (usePathname, Link) | 1. Click Deals in sidebar, verify /deals loads with Deals highlighted. 2. Click Templates, verify /templates loads with Templates highlighted. |
| Collapsible sidebar with localStorage persistence | NAV-02 | React component requires RTL + localStorage + Next.js mocking | 1. Click collapse toggle, verify sidebar shrinks to icon rail. 2. Refresh page, verify collapsed state persists. 3. Expand, refresh, verify expanded persists. |
| Add template dialog with validation | TMPL-01 | React component requires RTL + react-hook-form + server action mocking | 1. Click Add Template. 2. Type invalid URL, verify red X. 3. Paste valid Google Slides URL, verify green check. 4. Select touch types, enter name, submit. |
| Template list with status badges | TMPL-02 | React component requires RTL + Next.js + date-fns mocking | 1. With templates in DB, verify card grid shows status badges. 2. Toggle to table view, verify table renders with columns. |
| Delete template with confirmation | TMPL-03 | React component requires RTL + AlertDialog + server action mocking | 1. Click kebab menu on template card. 2. Click Delete. 3. Confirm in dialog. 4. Verify template removed from list. |
| Touch type chip assignment | TMPL-04 | React component requires RTL + react-hook-form field mocking | 1. Open Add Template dialog. 2. Click Touch 1, Touch 3 chips. 3. Verify visual selected state. 4. Submit and verify template has correct touch types. |

---

## Validation Audit 2026-03-06

| Metric | Count |
|--------|-------|
| Gaps found | 9 |
| Resolved | 2 |
| Escalated | 7 |

**Resolved:** TMPL-05 (URL validation), TMPL-07 (staleness detection) — 22 unit tests, all green.
**Escalated:** TMPL-06, TMPL-01-04, NAV-01-02 — require React Testing Library + jsdom + Next.js mocking infrastructure not yet established.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** partial 2026-03-06
