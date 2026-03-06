# Phase 26: Tech Debt Cleanup — httpOnly Fix & Documentation - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Close all tech debt gaps identified by the v1.3 milestone audit. Three categories: one functional bug (httpOnly cookie prevents client-side badge reading), SUMMARY frontmatter gaps across 9 plans in phases 22-25, and missing Nyquist VALIDATION.md files for phases 23 and 24. No new features — purely fixing and documenting existing work.

</domain>

<decisions>
## Implementation Decisions

### httpOnly Cookie Fix
- Fix the `google-token-status` cookie so `GoogleTokenBadge` can read it client-side
- The cookie contains only "valid"/"missing" strings — no sensitive data
- Two valid approaches: remove `httpOnly` flag from cookie, or pass status as server component prop
- Claude decides the approach — both are correct

### SUMMARY Frontmatter
- Populate `requirements_completed` in 9 SUMMARY.md files across phases 22-25:
  - 22-01, 22-02, 22-03 (Phase 22)
  - 23-01, 23-02 (Phase 23)
  - 24-01, 24-02 (Phase 24)
  - 25-01, 25-02 (Phase 25)
- Map REQ-IDs from REQUIREMENTS.md traceability table to the plan that implemented each

### Nyquist VALIDATION.md
- Create VALIDATION.md for Phase 23 (User-Delegated API Clients & Token Passthrough)
- Create VALIDATION.md for Phase 24 (Token Pool & Refresh Lifecycle)
- Follow the validation strategy format used in existing VALIDATION.md files (phases 22 and 25)

### Claude's Discretion
- All three areas: Claude has full flexibility on implementation approach
- httpOnly fix method (remove flag vs server prop)
- VALIDATION.md structure and test strategy details
- Order of operations within the plan

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GoogleTokenBadge` component: `apps/web/src/components/google-token-badge.tsx`
- Cookie setting locations: `apps/web/src/middleware.ts`, `apps/web/src/app/auth/callback/route.ts`
- Existing VALIDATION.md files: phases 22 and 25 (templates to follow)
- SUMMARY.md files: all 9 exist and need frontmatter updates only

### Established Patterns
- Cookie-based status caching with 1h TTL (Phase 22 decision)
- Nyquist VALIDATION.md format from phases 22 and 25
- SUMMARY frontmatter includes `requirements_completed` array of REQ-IDs

### Integration Points
- `google-token-status` cookie read in `google-token-badge.tsx` via `document.cookie`
- Cookie set in `middleware.ts` (reconsent detection) and `auth/callback/route.ts` (post-login)
- REQUIREMENTS.md traceability table maps all 28 REQ-IDs to phases

</code_context>

<specifics>
## Specific Ideas

No specific requirements — the v1.3 milestone audit defines all work items with prescribed fixes.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 26-tech-debt-cleanup*
*Context gathered: 2026-03-06*
