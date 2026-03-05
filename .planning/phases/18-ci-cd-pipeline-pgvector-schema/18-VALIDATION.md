---
phase: 18
slug: ci-cd-pipeline-pgvector-schema
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual validation (CI/CD pipeline + database schema) |
| **Config file** | `.github/workflows/deploy.yml` |
| **Quick run command** | `pnpm turbo lint build` |
| **Full suite command** | Push to main and verify all GitHub Actions jobs pass |
| **Estimated runtime** | ~120 seconds (local lint+build), ~300 seconds (full pipeline) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm turbo lint build`
- **After every plan wave:** Push to main and verify full pipeline passes
- **Before `/gsd:verify-work`:** All 5 GHA jobs green + pgvector extension confirmed + slide_embeddings table verified
- **Max feedback latency:** 120 seconds (local), 300 seconds (remote)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | CICD-01 | smoke | `pnpm turbo lint build` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | CICD-04 | smoke | Check migration job logs in GHA | ❌ W0 | ⬜ pending |
| 18-01-03 | 01 | 1 | CICD-02 | smoke | Check Vercel deployment URL after push | ❌ W0 | ⬜ pending |
| 18-01-04 | 01 | 1 | CICD-03 | smoke | Check Railway deployment logs after push | ❌ W0 | ⬜ pending |
| 18-02-01 | 02 | 1 | SLIDE-01 | manual | `SELECT * FROM pg_extension WHERE extname = 'vector';` | ❌ W0 | ⬜ pending |
| 18-02-02 | 02 | 1 | SLIDE-01 | manual | `\d "SlideEmbedding"` + `\di "SlideEmbedding_embedding_idx"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.github/workflows/deploy.yml` — the workflow file itself (core deliverable)
- [ ] Migration file for pgvector + slide_embeddings (core deliverable)
- [ ] GitHub secrets configured: `DATABASE_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `RAILWAY_TOKEN`
- [ ] GitHub variables configured: `RAILWAY_SERVICE_ID`
- [ ] Vercel auto-deploy disabled
- [ ] Railway auto-deploy disabled

*Wave 0 items are infrastructure prerequisites — they ARE the phase deliverables.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Push triggers full pipeline | CICD-01 | Requires actual GitHub push event | Push commit to main, verify all GHA jobs run |
| Web deploys to Vercel | CICD-02 | Requires live Vercel deployment | After GHA passes, verify deployment URL loads |
| Agent deploys to Railway | CICD-03 | Requires live Railway service | After GHA passes, verify Railway service is running |
| Migration runs before deploy | CICD-04 | Requires checking GHA job logs | Verify migrate job completes before deploy jobs start |
| pgvector extension active | SLIDE-01 | Requires database query | Run `SELECT * FROM pg_extension WHERE extname = 'vector';` |
| slide_embeddings table exists | SLIDE-01 | Requires database query | Run `\d "SlideEmbedding"` to verify schema |
| HNSW index exists | SLIDE-01 | Requires database query | Run `\di "SlideEmbedding_embedding_idx"` to verify index |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 300s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
