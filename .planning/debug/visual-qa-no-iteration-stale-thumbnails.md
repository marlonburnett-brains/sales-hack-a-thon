---
status: awaiting_human_verify
trigger: "Visual QA has two bugs: 1) thumbnails don't update after fixes 2) no iteration loop - finds issues, fixes once, stops with remaining issues"
created: 2026-03-11T00:00:00Z
updated: 2026-03-11T00:10:00Z
---

## Current Focus

hypothesis: Per-slide iteration with escalating corrections will resolve remaining issues
test: TypeScript compilation passes for all modified files
expecting: User to verify per-slide iteration works in real workflow
next_action: await human verification

## Symptoms

expected:
1. After Visual QA fixes slides, thumbnails should refresh to show updated content
2. Visual QA should iterate per-slide: assess -> fix -> re-assess -> repeat until fixed or truly unfixable

actual:
1. Thumbnails remain stale after fixes -- FIXED in round 1
2. Visual QA analyzed ALL slides each iteration, only 4 global iterations, gave up too easily

errors: No explicit errors - process completes with wrong behavior

reproduction: Run Visual QA on any presentation with issues

started: Current implementation

## Eliminated

- hypothesis: Global iteration loop with per-slide filtering is sufficient
  evidence: User reported it still gives up too easily, re-checks already-clean slides, and treats all slides as a single batch
  timestamp: 2026-03-11T00:05:00Z

## Evidence

- timestamp: 2026-03-11T00:01:00Z
  checked: Original visual-qa.ts
  found: Global batch iteration with max 2 iterations, corrections applied to all slides
  implication: Fundamentally wrong architecture

- timestamp: 2026-03-11T00:05:00Z
  checked: Round 1 fix feedback from user
  found: Thumbnails now refresh correctly. But iteration still wrong: analyzes ALL slides each pass, only 4 global iterations, gives up with "no improvement" while issues are clearly fixable.
  implication: Need per-slide iteration model, not global batch iteration.

- timestamp: 2026-03-11T00:10:00Z
  checked: Rewrote visual-qa.ts with per-slide iteration model
  found: New architecture with processSlide() handling each slide independently, escalating text reduction, issue-aware prompts, conservative give-up logic.
  implication: Should resolve all remaining iteration issues.

## Resolution

root_cause: |
  BUG 1 (Stale Thumbnails): FIXED in round 1.
  BUG 2 (No effective iteration): Global batch iteration model was fundamentally wrong — re-assessed all slides each pass, low global cap, aggressive early-stop.

fix: |
  Round 2 (per-slide iteration):
  1. visual-qa.ts: Complete rewrite:
     - processSlide(): per-slide assess->fix->reassess loop
     - MAX_ATTEMPTS_PER_SLIDE = 5
     - Escalating text reduction: 30% -> 40% -> 50%
     - Issue-aware prompts with specific detected issues as context
     - Conservative give-up: 2+ consecutive no-progress AND 3+ total attempts
     - Detailed unfixable reasons
     - Clean slides never re-analyzed
  2. visual-qa-overlay.tsx: Handle new SSE event types (slide_clean, slide_fixed, slide_unfixable)

verification:
files_changed:
  - apps/agent/src/generation/visual-qa.ts
  - apps/web/src/components/touch/visual-qa-overlay.tsx
