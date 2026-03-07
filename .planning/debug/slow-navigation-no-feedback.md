---
status: awaiting_human_verify
trigger: "Clicking on left menu items or template cards to navigate takes too long with no immediate UI feedback"
created: 2026-03-07T00:00:00Z
updated: 2026-03-07T00:05:00Z
---

## Current Focus

hypothesis: CONFIRMED and FIXED
test: Build succeeds, loading.tsx files created for all routes, template card uses Link
expecting: Instant navigation feedback with skeleton loading states
next_action: Await human verification

## Symptoms

expected: Instant navigation on click with immediate visual feedback (active state, loading skeleton), data loads in background
actual: Click on sidebar item or template card -> delay before anything happens -> then navigation occurs. Feels like click wasn't registered.
errors: No errors - just slow perceived performance
reproduction: Click any left sidebar nav item (Deals, Templates, Slide Library, AtlusAI, Action Required) or click a template card to view details
started: Persistent issue with current implementation

## Eliminated

- hypothesis: Sidebar uses non-Link navigation
  evidence: Sidebar already uses Next.js Link components correctly (line 83-108 of sidebar.tsx)
  timestamp: 2026-03-07T00:00:30Z

- hypothesis: Deal cards use non-Link navigation
  evidence: DealCard uses Next.js Link correctly (line 74 of deal-card.tsx)
  timestamp: 2026-03-07T00:00:30Z

## Evidence

- timestamp: 2026-03-07T00:00:20Z
  checked: Sidebar navigation (sidebar.tsx)
  found: Uses Next.js Link components correctly
  implication: Sidebar links are fine - slowness is from destination pages

- timestamp: 2026-03-07T00:00:25Z
  checked: All page.tsx files in (authenticated) routes
  found: ALL pages use `export const dynamic = "force-dynamic"` with blocking async data fetches. No loading.tsx files exist anywhere.
  implication: PRIMARY root cause - Next.js cannot show new page until ALL server-side data fetching completes, with zero loading UI

- timestamp: 2026-03-07T00:00:28Z
  checked: loading.tsx files
  found: ZERO loading.tsx files exist in the entire app
  implication: Combined with blocking server fetches = navigation appears frozen

- timestamp: 2026-03-07T00:00:30Z
  checked: Template card navigation (template-card.tsx)
  found: Uses `router.push()` on Card onClick instead of Next.js Link - no prefetching
  implication: Secondary root cause for template cards - no hover prefetch benefit

- timestamp: 2026-03-07T00:04:00Z
  checked: Build after fixes
  found: Build succeeds cleanly with all changes
  implication: Fixes are structurally correct

## Resolution

root_cause: |
  1. ZERO loading.tsx files existed in the entire app. All pages do blocking server-side data fetches with `force-dynamic`. When navigating, Next.js must complete ALL server data fetching before rendering. Without loading.tsx, there's no intermediate loading UI - users see the old page frozen with no feedback.
  2. TemplateCard used router.push() onClick instead of Link, missing prefetch benefits.
  3. No global navigation progress indicator existed.

fix: |
  1. Added loading.tsx with skeleton UIs for ALL route segments (9 files total)
  2. Converted TemplateCard from router.push() to Link wrapper with prefetching
  3. Added NavProgress global component (thin animated progress bar at top of viewport during navigation)
  4. Added nav-progress animation keyframes to Tailwind config

verification: Build succeeds cleanly. All type checks pass for changed files.

files_changed:
  - apps/web/src/app/(authenticated)/deals/loading.tsx (NEW)
  - apps/web/src/app/(authenticated)/deals/[dealId]/loading.tsx (NEW)
  - apps/web/src/app/(authenticated)/deals/[dealId]/review/[briefId]/loading.tsx (NEW)
  - apps/web/src/app/(authenticated)/deals/[dealId]/asset-review/[interactionId]/loading.tsx (NEW)
  - apps/web/src/app/(authenticated)/templates/loading.tsx (NEW)
  - apps/web/src/app/(authenticated)/templates/[id]/slides/loading.tsx (NEW)
  - apps/web/src/app/(authenticated)/slides/loading.tsx (NEW)
  - apps/web/src/app/(authenticated)/discovery/loading.tsx (NEW)
  - apps/web/src/app/(authenticated)/actions/loading.tsx (NEW)
  - apps/web/src/components/nav-progress.tsx (NEW)
  - apps/web/src/components/template-card.tsx (MODIFIED - Link wrapper)
  - apps/web/src/app/layout.tsx (MODIFIED - added NavProgress)
  - apps/web/tailwind.config.ts (MODIFIED - added nav-progress animation)
