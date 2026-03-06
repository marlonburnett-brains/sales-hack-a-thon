---
phase: 24
slug: token-pool-refresh-lifecycle
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-06
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (agent)** | vitest (node) |
| **Config (agent)** | `apps/agent/vitest.config.ts` |
| **Framework (web)** | vitest (jsdom) |
| **Config (web)** | `apps/web/vitest.config.ts` |
| **Quick run (agent)** | `cd apps/agent && npx vitest run` |
| **Quick run (web)** | `cd apps/web && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command for affected app
- **After every plan wave:** Run both agent + web suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 24-01-01 | 01 | 1 | POOL-01 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/google-auth.test.ts` | ✅ | ✅ green |
| 24-01-02 | 01 | 1 | POOL-02 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/google-auth.test.ts` | ✅ | ✅ green |
| 24-01-03 | 01 | 1 | POOL-03 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/google-auth.test.ts` | ✅ | ✅ green |
| 24-01-04 | 01 | 1 | POOL-04 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/google-auth.test.ts` | ✅ | ✅ green |
| 24-01-05 | 01 | 1 | POOL-05 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/google-auth.test.ts` | ✅ | ✅ green |
| 24-01-06 | 01 | 1 | LIFE-01 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/google-auth.test.ts` | ✅ | ✅ green |
| 24-01-07 | 01 | 1 | LIFE-02 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/google-auth.test.ts` | ✅ | ✅ green |
| 24-01-08 | 01 | 1 | LIFE-03 | unit | `cd apps/agent && npx vitest run src/mastra/__tests__/token-store-route.test.ts` | ✅ | ✅ green |
| 24-01-09 | 01 | 1 | ActionRequired on failure | unit | `cd apps/agent && npx vitest run src/lib/__tests__/google-auth.test.ts` | ✅ | ✅ green |
| 24-02-01 | 02 | 2 | UI-actions-page | unit | `cd apps/web && npx vitest run "src/app/(authenticated)/actions/__tests__/actions-client.test.tsx"` | ✅ | ✅ green |
| 24-02-02 | 02 | 2 | UI-sidebar-badge | unit | `cd apps/web && npx vitest run src/components/__tests__/sidebar.test.tsx` | ✅ | ✅ green |
| 24-02-03 | 02 | 2 | UI-dismiss-action | unit | `cd apps/web && npx vitest run "src/app/(authenticated)/actions/__tests__/actions-client.test.tsx"` | ✅ | ✅ green |
| 24-02-04 | 02 | 2 | UI-api-client | unit | `cd apps/web && npx vitest run src/lib/__tests__/api-client-actions.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Action Required UI visual rendering | 24-02 | Visual layout, spacing, icons require browser | Navigate to `/actions`, verify cards display with correct icons and styling |
| Sidebar badge visual rendering | 24-02 | Badge color and dot positioning require browser | Check sidebar expanded (red badge) and collapsed (red dot) states |
| Background job pooled auth in runtime | 24-01 | Requires running server with real Google tokens | Start dev server, observe `[staleness] Polling with pool auth` in agent logs |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-06

---

## Validation Audit 2026-03-06
| Metric | Count |
|--------|-------|
| Gaps found | 5 |
| Resolved | 5 |
| Escalated | 0 |
