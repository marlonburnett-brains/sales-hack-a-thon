---
phase: 28
slug: mcp-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 |
| **Config file** | apps/agent/vitest.config.ts (create if missing) |
| **Quick run command** | `cd apps/agent && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd apps/agent && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/agent && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd apps/agent && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 28-01-01 | 01 | 1 | MCP-02 | smoke | `grep -r "@mastra/mcp" apps/web/` should return empty | N/A | ⬜ pending |
| 28-01-02 | 01 | 1 | MCP-03 | unit (mock) | `npx vitest run src/lib/__tests__/mcp-client.test.ts` | ❌ W0 | ⬜ pending |
| 28-01-03 | 01 | 1 | MCP-04 | unit (mock) | `npx vitest run src/lib/__tests__/mcp-client.test.ts` | ❌ W0 | ⬜ pending |
| 28-01-04 | 01 | 1 | MCP-05 | unit | `npx vitest run src/lib/__tests__/mcp-client.test.ts` | ❌ W0 | ⬜ pending |
| 28-01-05 | 01 | 1 | MCP-06 | unit (mock) | `npx vitest run src/lib/__tests__/mcp-client.test.ts` | ❌ W0 | ⬜ pending |
| 28-01-06 | 01 | 1 | MCP-01 | integration (manual) | N/A -- requires live AtlusAI endpoint | N/A | ⬜ pending |
| 28-02-01 | 02 | 2 | SRCH-01 | unit (mock) | `npx vitest run src/lib/__tests__/atlusai-search.test.ts` | ❌ W0 | ⬜ pending |
| 28-02-02 | 02 | 2 | SRCH-02 | unit | `npx vitest run src/lib/__tests__/atlusai-search.test.ts` | ❌ W0 | ⬜ pending |
| 28-02-03 | 02 | 2 | SRCH-05 | unit | `npx vitest run src/lib/__tests__/atlusai-search.test.ts` | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `apps/agent/src/lib/__tests__/mcp-client.test.ts` — stubs for MCP-03, MCP-04, MCP-05, MCP-06
- [ ] `apps/agent/src/lib/__tests__/atlusai-search.test.ts` — stubs for SRCH-01, SRCH-02, SRCH-05
- [ ] Vitest config verification (create `apps/agent/vitest.config.ts` if not present)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| MCPClient connects to AtlusAI SSE endpoint | MCP-01 | Requires live AtlusAI server | 1. Set valid ATLUS credentials in .env 2. Start agent service 3. Trigger search 4. Verify SSE connection in logs |
| SIGTERM graceful shutdown | MCP-06 | Requires process signal | 1. Start agent service 2. Send SIGTERM 3. Verify disconnect log before exit |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
