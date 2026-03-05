---
phase: 7
slug: rag-retrieval-and-slide-block-assembly
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | tsx script runner (follows existing validate-schemas.ts pattern) |
| **Config file** | none — standalone scripts with process.exit codes |
| **Quick run command** | `npx tsx --env-file=.env src/scripts/verify-rag-quality.ts --industry "Financial Services & Insurance"` |
| **Full suite command** | `npx tsx --env-file=.env src/scripts/verify-rag-quality.ts` |
| **Estimated runtime** | ~30 seconds (3 industry runs with Drive API calls) |

---

## Sampling Rate

- **After every task commit:** Schema validation (Zod parse round-trip)
- **After every plan wave:** Run `npx tsx --env-file=.env src/scripts/verify-rag-quality.ts`
- **Before `/gsd:verify-work`:** Full suite must be green with >=80% metadata match rate
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | CONT-05 | integration | `npx tsx --env-file=.env src/scripts/verify-rag-quality.ts` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | CONT-06 | integration | `npx tsx --env-file=.env src/scripts/verify-rag-quality.ts` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 2 | ASSET-01 | unit (schema) | `npx tsx --env-file=.env src/scripts/verify-rag-quality.ts --schema-only` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 2 | ASSET-02 | integration | `npx tsx --env-file=.env src/scripts/verify-rag-quality.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/agent/src/scripts/verify-rag-quality.ts` — covers CONT-05, CONT-06, ASSET-01, ASSET-02
- [ ] `apps/agent/src/scripts/test-briefs.ts` — 3 mock approved brief fixtures (Financial Services, Healthcare, Technology)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Copy reads naturally and uses customer-specific language | ASSET-02 | Subjective quality assessment | Review generated speaker notes and bullets for 3 test briefs; verify customer names, outcomes, and constraints are woven in naturally |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
