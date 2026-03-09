---
status: awaiting_human_verify
trigger: "User cannot navigate away from Touch 1 deal page while content is generating. Clicking Action Required triggers loading bar but page never loads."
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED - Polling server actions block Next.js navigation queue
test: Code analysis of touch-page-client.tsx polling + Next.js server action queue behavior
expecting: N/A - root cause confirmed
next_action: Implement fix - convert polling from server actions to client-side fetch via route handlers

## Symptoms

expected: Clicking "Action Required" in the sidebar should navigate immediately, regardless of content generation in progress
actual: Next.js top loading bar animates continuously but page never transitions. User stuck on Touch 1 "Generating content..." page.
errors: No browser console errors visible
reproduction: Go to deal page (e.g. PepsiCo), trigger content generation on Touch 1, click "Action Required" in sidebar
started: Current behavior - user discovered while using the app

## Eliminated

- hypothesis: Server-side layout data fetching blocks during generation
  evidence: Deal layout is cached during client-side nav; actions page has loading.tsx Suspense boundary; middleware uses fast path for RSC
  timestamp: 2026-03-09T00:00:30Z

- hypothesis: Middleware blocks RSC requests
  evidence: Middleware uses getSession() (local JWT decode) for RSC requests, not getUser() (network call). Google token check skipped for RSC.
  timestamp: 2026-03-09T00:00:35Z

## Evidence

- timestamp: 2026-03-09T00:00:10Z
  checked: touch-page-client.tsx polling mechanism
  found: setInterval every 2s calls server actions (checkTouch1StatusAction etc.) during generation. These are "use server" functions.
  implication: Server actions compete with navigation RSC requests in Next.js internal queue

- timestamp: 2026-03-09T00:00:15Z
  checked: api-client.ts fetchAgent function
  found: No timeout on fetch calls. Agent service likely slow during generation (processing workflow).
  implication: Each poll request can take seconds to resolve, keeping the server action queue busy

- timestamp: 2026-03-09T00:00:20Z
  checked: nav-progress.tsx
  found: Custom loading bar shows on link click, hides only when pathname changes. Pathname only changes when navigation RSC payload is received.
  implication: Loading bar animates forever because navigation never completes

- timestamp: 2026-03-09T00:00:25Z
  checked: Component unmount cleanup (touch-page-client.tsx line 199-206)
  found: Polling cleared on unmount, but unmount only happens AFTER navigation completes - chicken-and-egg problem
  implication: Cleanup exists but can't fire because navigation is blocked by the polling it needs to clean up

## Resolution

root_cause: Polling status checks during content generation use Next.js server actions (checkTouch1StatusAction etc.) called every 2 seconds via setInterval. In Next.js App Router, server action invocations and router navigation RSC fetches share the same internal request queue. The continuous server action polling blocks navigation requests from being processed. Additionally, fetchAgent() has no timeout, so each poll can take seconds when the agent is busy with generation, keeping the queue perpetually occupied.
fix: Created Route Handler at /api/workflows/status that proxies workflow status checks to the agent. Changed touch-page-client.tsx polling to use client-side fetch() to this Route Handler instead of server actions. This moves polling traffic off the Next.js server action queue so it cannot block router navigation.
verification: TypeScript compilation passes. No errors in modified files.
files_changed:
  - apps/web/src/app/api/workflows/status/route.ts (new - Route Handler for client-side polling)
  - apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx (modified - polling uses fetch instead of server actions)
