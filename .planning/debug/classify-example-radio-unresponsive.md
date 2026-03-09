---
status: awaiting_human_verify
trigger: "classify-example-radio-unresponsive: touch type radio buttons don't visually select when clicked"
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED - e.preventDefault() on DialogContent blocks radio default action
test: Removed preventDefault(), kept stopPropagation()
expecting: Radio buttons now respond to clicks
next_action: Verify fix and check for regressions

## Symptoms

expected: Clicking a touch type radio button should select it (fill the radio circle)
actual: Clicking the radio button produces no visual change - it stays unselected
errors: None reported
reproduction: Open Classify dialog on a presentation, select "Example", try to click any Touch type radio button
started: Unknown if it ever worked

## Eliminated

- hypothesis: Missing state binding or onChange handlers
  evidence: State management in TemplateClassificationControls is correct - checked prop bound to touchTypes state, onChange calls selectExampleTouch which updates state
  timestamp: 2026-03-09T00:00:30Z

- hypothesis: CSS/Tailwind preflight hiding radio appearance
  evidence: Tailwind v3 preflight does not set appearance:none on radio/checkbox inputs. No custom CSS targeting radio inputs found.
  timestamp: 2026-03-09T00:00:40Z

## Evidence

- timestamp: 2026-03-09T00:00:20Z
  checked: TemplateClassificationControls component (template-classification-controls.tsx)
  found: Radio/checkbox state management is correct - checked prop, onChange handler, state updates all properly wired
  implication: Bug is not in the classification controls component itself

- timestamp: 2026-03-09T00:00:30Z
  checked: template-card.tsx line 281 - DialogContent wrapper
  found: DialogContent has onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
  implication: e.preventDefault() on a parent element prevents radio/checkbox default action (becoming checked) because DOM default actions execute AFTER full event propagation completes

- timestamp: 2026-03-09T00:00:35Z
  checked: Why preventDefault was added
  found: The Dialog is nested inside a <Link> component (line 272). preventDefault was intended to stop clicks inside the dialog from triggering Link navigation.
  implication: stopPropagation() alone is sufficient to prevent Link navigation. preventDefault() is overkill and breaks form elements.

## Resolution

root_cause: The DialogContent in template-card.tsx has onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}. The e.preventDefault() call prevents the native default action of radio/checkbox inputs (becoming checked/unchecked). In the DOM event model, default actions execute AFTER full event propagation (capture + target + bubble), so even though preventDefault() is called on a parent during bubble phase, it still blocks the radio's default behavior. Since the radio never natively checks, the change event never fires, React's onChange never fires, and state never updates.

fix: (1) Removed e.preventDefault() from DialogContent onClick handler, keeping only e.stopPropagation() which is sufficient to prevent the Link navigation. (2) Added conditional visual styling to touch type labels (matching the artifact type pattern) so selected state is clearly visible beyond just the native radio fill.

verification: pending
files_changed:
  - apps/web/src/components/template-card.tsx
  - apps/web/src/components/classification/template-classification-controls.tsx
