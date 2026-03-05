---
phase: 14
slug: database-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (no test framework installed in project) |
| **Config file** | None |
| **Quick run command** | `cd apps/agent && pnpm dev` (smoke test: server starts without errors) |
| **Full suite command** | `cd apps/agent && npx prisma migrate status && npx prisma db seed && pnpm dev` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/agent && pnpm dev` (verify server starts)
- **After every plan wave:** Run full suite command (migrate status + seed + dev start)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | DB-01 | manual | Verify Supabase dashboard shows active project | N/A | ⬜ pending |
| 14-01-02 | 01 | 1 | DB-01 | smoke | `cd apps/agent && npx prisma migrate status` | N/A | ⬜ pending |
| 14-02-01 | 02 | 1 | DB-02 | smoke | `cd apps/agent && npx prisma migrate status` (shows baseline applied) | N/A | ⬜ pending |
| 14-02-02 | 02 | 1 | DB-03 | smoke | `cd apps/agent && pnpm dev` (server starts, no errors) | N/A | ⬜ pending |
| 14-02-03 | 02 | 1 | DB-04 | smoke | `cd apps/agent && pnpm dev` (Mastra initializes with PostgresStore) | N/A | ⬜ pending |
| 14-02-04 | 02 | 1 | DB-05 | smoke | `cd apps/agent && npx prisma db seed` | N/A | ⬜ pending |
| 14-02-05 | 02 | 1 | DB-04 | manual | Trigger HITL workflow, restart server, verify resume | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* No test framework installation needed — this phase is infrastructure/configuration changes validated through smoke tests and manual verification.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Supabase dev project accessible | DB-01 | Requires external cloud service | Verify Supabase dashboard shows active project with correct region (us-east-1) |
| Supabase prod project accessible | DB-01 | Requires external cloud service | Verify second Supabase project exists with same schema, no seed data |
| HITL workflow survives restart | DB-04 | Requires server restart mid-workflow | 1. Start server, trigger Touch 4 workflow 2. Suspend at HITL step 3. Stop and restart server 4. Verify workflow resumes |
| Meridian Capital Group in web UI | DB-05 | Requires visual verification | After seed, open web UI and verify Meridian Capital Group scenario displays correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
