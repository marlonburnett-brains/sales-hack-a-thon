# Audit Tutorial Screenshots vs Narration

Audit tutorial screenshots against their narration scripts, identify mismatches, fix them, and re-capture until all steps pass.

## Arguments

- `$ARGUMENTS` — Tutorial name(s) to audit. Examples: `template-library`, `deals agent-prompts`, `all`

## Process

### 1. Resolve tutorial list

```
If "$ARGUMENTS" is "all" or empty:
  List all directories under apps/tutorials/fixtures/ that contain a script.json
  Exclude "shared" directory
  Use all found tutorial names
Else:
  Split $ARGUMENTS by spaces → tutorial names
```

### 2. Audit phase — spawn parallel sub-agents

For EACH tutorial, spawn an audit sub-agent (all in parallel to save time):

```
Agent(
  description="Audit {tutorial} tutorial",
  prompt="
    Audit the {tutorial} tutorial screenshots against its narration script.

    Steps:
    1. Read the script: apps/tutorials/fixtures/{tutorial}/script.json
       Extract narration text, mockStage, actions, and url for each step.

    2. Resize all screenshots for efficient context usage:
       for f in apps/tutorials/output/{tutorial}/step-*.png; do
         convert \"$f\" -resize 800x \"$f.small.png\"
       done

    3. For EACH step, read the resized screenshot (apps/tutorials/output/{tutorial}/step-{NNN}.png.small.png)
       and compare against the narration:
       - Does the screenshot show what the narration describes?
       - Is the correct page/component visible?
       - If mockStage is set, does the screenshot reflect that stage's data?
       - Do any factual claims in narration (counts, names, labels, statuses) match what's visible?
       - Is zoom used appropriately (adds value, not random/excessive)?

    4. Clean up resized files:
       rm apps/tutorials/output/{tutorial}/*.small.png

    5. Report for each step:
       Step X: [OK | MISMATCH]
       - Narration: first ~20 words...
       - Screenshot shows: brief description
       - Issue: description (if MISMATCH)

    6. End with summary:
       ## {tutorial} Summary
       - Total steps: N
       - OK: N
       - Mismatches: N (list step numbers)
       - Key problems: brief list (or 'None')
  "
)
```

### 3. Analyze audit results

Collect all sub-agent results. Tally:

```
| Tutorial | Steps | OK | Mismatches |
|----------|-------|----|------------|
| ...      | ...   | .. | ...        |
| Total    | ...   | .. | ...        |
```

**If ALL tutorials have 0 mismatches → skip to step 6 (report).**

### 4. Fix phase — spawn parallel fix agents

For each tutorial WITH mismatches, spawn a fix sub-agent (all in parallel):

```
Agent(
  description="Fix {tutorial} tutorial",
  prompt="
    Fix mismatches in the {tutorial} tutorial. Here are the issues found:

    {paste mismatch details from audit}

    ## Common root causes and fixes

    ### mockStage transitions not producing visual changes
    The capture spec at apps/tutorials/capture/{tutorial}.spec.ts must reload the page
    when mockStage changes on the same URL. Check if this block exists after the
    mockStage fetch call:
      if (step.url && step.url === currentUrl && previousStage !== step.mockStage) {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});
      }
    If missing, add it.

    ### Narration describes UI elements that don't exist
    Read the actual web page component to understand what's rendered:
    - apps/web/src/app/(authenticated)/{route}/page.tsx
    Fix narration in apps/tutorials/fixtures/{tutorial}/script.json to match reality.

    ### Missing actions (click, fill, etc.)
    If narration describes an interaction but the script has no action for it,
    either add the action or rewrite narration to be descriptive instead of imperative.
    Actions must use the 'actions' key (array), NOT 'action' (singular).

    ### Stage fixture data mismatch
    If a mockStage is set but the screenshot doesn't reflect it, check:
    - apps/tutorials/fixtures/{tutorial}/stages/{stageName}.json
    - The field names must match what the mock server route checks for
    - Read apps/tutorials/scripts/mock-server.ts to verify route expectations

    ### Excessive zoom
    Remove zoomTarget from steps where the full page view is more appropriate.
    Keep zoom only where it highlights a specific detail that's hard to see at full scale.

    ## Rules
    - Keep the same step count (changing count breaks TTS timing)
    - Keep conversational narration tone
    - Every factual claim in narration must match what the UI actually shows
    - Only modify files under apps/tutorials/ (fixtures, capture specs, scripts)
    - Read files before editing
  "
)
```

### 5. Re-capture and re-audit cycle

After fixes are applied:

**Re-capture** each fixed tutorial:
```bash
# Use 8GB for tutorials with many mockStage reloads (4+ stage changes)
NODE_OPTIONS="--max-old-space-size=8192" pnpm --filter tutorials capture {tutorial}
```

Run captures sequentially (each needs the mock server ports).

**Re-audit** — go back to step 2, but ONLY for tutorials that had mismatches.

**Repeat** until all tutorials pass with 0 mismatches OR 3 fix cycles have been attempted.

If after 3 cycles some mismatches persist, report them as unresolvable with explanation
(e.g., "client-side rendering limitation — narration softened to match").

### 6. Final report

```
## Tutorial Audit Complete

| Tutorial | Steps | Status |
|----------|-------|--------|
| {name}   | {N}   | PASS / {M} remaining mismatches |

### Fixes Applied
- {file}: {brief description of change}

### Narration Changes
List any tutorials where narration text was modified (these need TTS regeneration).

### Commands to re-render (if narration changed)
pnpm --filter tutorials tts {tutorial1}
pnpm --filter tutorials tts {tutorial2}
...
pnpm --filter tutorials render {tutorial1}
pnpm --filter tutorials render {tutorial2}
...
```

## Key context

- Tutorial scripts: `apps/tutorials/fixtures/{name}/script.json`
- Stage fixtures: `apps/tutorials/fixtures/{name}/stages/{stage}.json`
- Capture specs: `apps/tutorials/capture/{name}.spec.ts`
- Mock server: `apps/tutorials/scripts/mock-server.ts`
- Screenshots output: `apps/tutorials/output/{name}/step-{NNN}.png`
- Web pages: `apps/web/src/app/(authenticated)/...`
- The capture loop sets mockStage via `POST /mock/set-stage`, then navigates if URL changed
- Zoom, callout, and cursor effects are Remotion render-time only — they will NOT appear in screenshots
- Actions execute BEFORE the screenshot, AFTER navigation and waitFor
