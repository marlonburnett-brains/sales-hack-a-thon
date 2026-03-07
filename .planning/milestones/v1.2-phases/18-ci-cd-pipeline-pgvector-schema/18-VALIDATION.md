---
phase: 18
slug: ci-cd-pipeline-pgvector-schema
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-05
validated: 2026-03-06
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Infrastructure validation (CI/CD pipeline + database schema) |
| **Config file** | `.circleci/config.yml` |
| **Quick run command** | `pnpm turbo lint build` |
| **Full suite command** | Push to main and verify all CircleCI jobs pass |
| **Estimated runtime** | ~120 seconds (local lint+build), ~300 seconds (full pipeline) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm turbo lint build`
- **After every plan wave:** Push to main and verify full pipeline passes
- **Before `/gsd:verify-work`:** All 4 CircleCI jobs green + pgvector extension confirmed + SlideEmbedding table verified
- **Max feedback latency:** 120 seconds (local), 300 seconds (remote)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 18-01-01 | 01 | 1 | SLIDE-01 | artifact | `npx prisma validate && npx prisma generate` (apps/agent) | COVERED |
| 18-01-02 | 01 | 1 | SLIDE-01 | artifact | `pnpm turbo build` | COVERED |
| 18-02-01 | 02 | 1 | CICD-01, CICD-02, CICD-03, CICD-04 | artifact | `.circleci/config.yml` exists with valid YAML | COVERED |
| 18-02-02 | 02 | 1 | (human checkpoint) | manual | User confirmed secrets + auto-deploy disabled | COVERED |

*Status: COVERED · PARTIAL · MISSING*

---

## Requirement Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| CICD-01 | Push to main triggers lint/build | COVERED | `.circleci/config.yml` line 85-88: `lint-and-build` job filtered to `main`, runs `pnpm turbo lint build` |
| CICD-02 | Web deploys to Vercel | COVERED | `deploy-web` job (lines 66-80) uses `vercel deploy --prebuilt --prod` |
| CICD-03 | Agent deploys to Railway | COVERED | `deploy-agent` job (lines 54-63) uses `railway up --service $RAILWAY_SERVICE_ID --ci` |
| CICD-04 | Migration runs before deploy | COVERED | `migrate` job (lines 41-52) runs `prisma migrate deploy`; deploy jobs depend via `requires:` chain |
| SLIDE-01 | pgvector extension + SlideEmbedding table + HNSW index | COVERED | Migration SQL has `CREATE EXTENSION`, `CREATE TABLE` with `vector(768)`, `USING hnsw` with `vector_cosine_ops` |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Push triggers full pipeline | CICD-01 | Requires actual CircleCI pipeline trigger | Push commit to main, verify all jobs run |
| Web deploys to Vercel | CICD-02 | Requires live Vercel deployment | After pipeline passes, verify deployment URL loads |
| Agent deploys to Railway | CICD-03 | Requires live Railway service | After pipeline passes, verify Railway service is running |
| Migration runs before deploy | CICD-04 | Requires checking CircleCI job logs | Verify migrate job completes before deploy jobs start |
| pgvector extension active | SLIDE-01 | Requires database query | `SELECT * FROM pg_extension WHERE extname = 'vector';` |
| SlideEmbedding table exists | SLIDE-01 | Requires database query | `\d "SlideEmbedding"` to verify schema |
| HNSW index exists | SLIDE-01 | Requires database query | `\di "SlideEmbedding_embedding_idx"` to verify index |

---

## Validation Sign-Off

- [x] All tasks have automated verify or are infrastructure artifacts (Wave 0)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all infrastructure prerequisites
- [x] No watch-mode flags
- [x] Feedback latency < 300s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated

---

## Validation Audit 2026-03-06

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

**Notes:**
- CI/CD migrated from GitHub Actions to CircleCI (commit `235bce1`). All CICD requirements still satisfied by `.circleci/config.yml` with identical job structure.
- Phase is 100% infrastructure — all requirements are verified by artifact existence + manual pipeline execution. No unit-testable behavior exists.
- All 5 requirements (CICD-01 through CICD-04, SLIDE-01) confirmed COVERED.
