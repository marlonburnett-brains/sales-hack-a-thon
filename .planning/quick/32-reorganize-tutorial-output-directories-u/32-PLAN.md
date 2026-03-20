---
phase: quick-32
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/tutorials/src/helpers/screenshot.ts
  - apps/tutorials/src/remotion/TutorialStep.tsx
  - apps/tutorials/remotion.config.ts
  - apps/tutorials/scripts/tts.ts
  - apps/tutorials/scripts/render.ts
  - apps/tutorials/scripts/render-all.ts
  - apps/tutorials/scripts/capture.ts
  - apps/tutorials/capture/getting-started.spec.ts
  - apps/tutorials/capture/deal-overview.spec.ts
  - apps/tutorials/capture/deals.spec.ts
  - apps/tutorials/capture/deal-chat.spec.ts
  - apps/tutorials/capture/briefing.spec.ts
  - apps/tutorials/capture/action-center.spec.ts
  - apps/tutorials/capture/agent-prompts.spec.ts
  - apps/tutorials/capture/asset-review.spec.ts
  - apps/tutorials/capture/atlus-integration.spec.ts
  - apps/tutorials/capture/deck-structures.spec.ts
  - apps/tutorials/capture/google-drive-settings.spec.ts
  - apps/tutorials/capture/slide-library.spec.ts
  - apps/tutorials/capture/template-library.spec.ts
  - apps/tutorials/capture/touch-1-pager.spec.ts
  - apps/tutorials/capture/touch-2-intro-deck.spec.ts
  - apps/tutorials/capture/touch-3-capability-deck.spec.ts
  - apps/tutorials/capture/touch-4-hitl.spec.ts
  - apps/tutorials/.gitignore
  - .claude/commands/audit-tutorial.md
autonomous: true
must_haves:
  truths:
    - "All tutorial output artifacts live under a single output/ directory"
    - "TTS generates audio files at output/audio/{tutorial}/"
    - "Screenshots generate at output/screenshots/{tutorial}/"
    - "Videos generate at output/videos/"
    - "Remotion staticFile() resolves screenshots and audio from new paths"
    - "Audit command references correct screenshot paths"
  artifacts:
    - path: "apps/tutorials/src/helpers/screenshot.ts"
      provides: "Screenshot output path using output/screenshots"
      contains: "output/screenshots"
    - path: "apps/tutorials/scripts/tts.ts"
      provides: "TTS output path using output/audio"
      contains: "output/audio"
    - path: "apps/tutorials/scripts/render.ts"
      provides: "Video output path using output/videos"
      contains: "output/videos"
  key_links:
    - from: "src/remotion/TutorialStep.tsx"
      to: "output/screenshots and output/audio"
      via: "staticFile() paths"
      pattern: "staticFile.*output/(screenshots|audio)"
    - from: "scripts/render.ts"
      to: "output/audio and output/videos"
      via: "path.join references"
      pattern: "output.*audio|output.*videos"
---

<objective>
Reorganize tutorial output directories so all generated artifacts live under a single `output/` directory.

Current layout:
- `audio/{tutorial}/` (TTS audio)
- `output/{tutorial}/` (screenshots)
- `videos/` (rendered videos)

Target layout:
- `output/audio/{tutorial}/` (TTS audio)
- `output/screenshots/{tutorial}/` (screenshots)
- `output/videos/` (rendered videos)

Purpose: Clean directory structure with a single gitignored output root.
Output: All path references updated across scripts, specs, Remotion components, gitignore, and commands.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/tutorials/src/helpers/screenshot.ts
@apps/tutorials/src/remotion/TutorialStep.tsx
@apps/tutorials/remotion.config.ts
@apps/tutorials/scripts/tts.ts
@apps/tutorials/scripts/render.ts
@apps/tutorials/scripts/render-all.ts
@apps/tutorials/scripts/capture.ts
@apps/tutorials/.gitignore
@.claude/commands/audit-tutorial.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update all path references from scattered directories to output/ subdirectories</name>
  <files>
    apps/tutorials/src/helpers/screenshot.ts
    apps/tutorials/src/remotion/TutorialStep.tsx
    apps/tutorials/remotion.config.ts
    apps/tutorials/scripts/tts.ts
    apps/tutorials/scripts/render.ts
    apps/tutorials/scripts/render-all.ts
    apps/tutorials/scripts/capture.ts
    apps/tutorials/.gitignore
  </files>
  <action>
    Update path references in the following files. All paths are relative to `apps/tutorials/`.

    1. **src/helpers/screenshot.ts** (line 18):
       Change `OUTPUT_BASE` from `path.join(process.cwd(), "output")` to `path.join(process.cwd(), "output", "screenshots")`.
       Update the JSDoc comment block (lines 12-15) to reflect `output/screenshots/{tutorialId}/step-001.png`.

    2. **src/remotion/TutorialStep.tsx** (lines 67-68):
       Change `staticFile(\`output/${tutorialName}/${stepId}.png\`)` to `staticFile(\`output/screenshots/${tutorialName}/${stepId}.png\`)`.
       Change `staticFile(\`audio/${tutorialName}/${audioFile}\`)` to `staticFile(\`output/audio/${tutorialName}/${audioFile}\`)`.

    3. **remotion.config.ts** (line 3):
       Update comment to: `// Tutorials app root as public dir so staticFile("output/screenshots/..."), staticFile("output/audio/...") resolve`

    4. **scripts/tts.ts** (line 144):
       Change `path.join(process.cwd(), "audio", tutorialName)` to `path.join(process.cwd(), "output", "audio", tutorialName)`.

    5. **scripts/render.ts**:
       - Line 171: Change `path.join(cwd, "audio", tutorialName)` to `path.join(cwd, "output", "audio", tutorialName)`.
       - Line 190: Change `path.join(process.cwd(), "audio", tutorialName)` to `path.join(process.cwd(), "output", "audio", tutorialName)`.
       - Line 290: Change `path.join(process.cwd(), "videos")` to `path.join(process.cwd(), "output", "videos")`.

    6. **scripts/render-all.ts**:
       - Line 45: Change `path.join(cwd, "audio")` to `path.join(cwd, "output", "audio")`.
       - Line 59: The `screenshotDir` reference `path.join(cwd, "output", name)` must become `path.join(cwd, "output", "screenshots", name)`.

    7. **scripts/capture.ts** (line 210):
       Change `path.join(process.cwd(), "output", tutorialName)` to `path.join(process.cwd(), "output", "screenshots", tutorialName)`.

    8. **.gitignore**: Replace the three separate lines (`output/`, `audio/`, `videos/`) with a single `output/` entry. Since `output/` already covers the new subdirectories, just remove the `audio/` and `videos/` lines. The `output/` line stays as-is.
  </action>
  <verify>
    <automated>cd apps/tutorials && grep -rn '"audio"' scripts/ src/remotion/TutorialStep.tsx | grep -v node_modules | grep -v 'output.*audio' && echo "FAIL: bare audio refs remain" || echo "PASS: no bare audio refs" && grep -rn '"videos"' scripts/ | grep -v node_modules | grep -v 'output.*videos' && echo "FAIL: bare videos refs remain" || echo "PASS: no bare videos refs"</automated>
  </verify>
  <done>
    - screenshot.ts OUTPUT_BASE points to output/screenshots
    - TutorialStep.tsx staticFile paths use output/screenshots/ and output/audio/
    - tts.ts writes to output/audio/
    - render.ts reads audio from output/audio/ and writes video to output/videos/
    - render-all.ts discovers tutorials from output/audio/
    - capture.ts reports output/screenshots/ path
    - .gitignore has single output/ entry (no separate audio/ or videos/ lines)
  </done>
</task>

<task type="auto">
  <name>Task 2: Update all capture spec files and audit command</name>
  <files>
    apps/tutorials/capture/getting-started.spec.ts
    apps/tutorials/capture/deal-overview.spec.ts
    apps/tutorials/capture/deals.spec.ts
    apps/tutorials/capture/deal-chat.spec.ts
    apps/tutorials/capture/briefing.spec.ts
    apps/tutorials/capture/action-center.spec.ts
    apps/tutorials/capture/agent-prompts.spec.ts
    apps/tutorials/capture/asset-review.spec.ts
    apps/tutorials/capture/atlus-integration.spec.ts
    apps/tutorials/capture/deck-structures.spec.ts
    apps/tutorials/capture/google-drive-settings.spec.ts
    apps/tutorials/capture/slide-library.spec.ts
    apps/tutorials/capture/template-library.spec.ts
    apps/tutorials/capture/touch-1-pager.spec.ts
    apps/tutorials/capture/touch-2-intro-deck.spec.ts
    apps/tutorials/capture/touch-3-capability-deck.spec.ts
    apps/tutorials/capture/touch-4-hitl.spec.ts
    .claude/commands/audit-tutorial.md
  </files>
  <action>
    1. **All 17 capture spec files** under `apps/tutorials/capture/*.spec.ts`:
       Each spec has a summary block near the end that constructs `outputDir` as:
       `const outputDir = path.join(process.cwd(), "output", TUTORIAL_ID);`
       Change to:
       `const outputDir = path.join(process.cwd(), "output", "screenshots", TUTORIAL_ID);`

       This appears in every spec file. Use a find-and-replace approach:
       In each file, replace `path.join(process.cwd(), "output", TUTORIAL_ID)` with `path.join(process.cwd(), "output", "screenshots", TUTORIAL_ID)`.

    2. **.claude/commands/audit-tutorial.md**:
       Update all references from `apps/tutorials/output/{tutorial}/` to `apps/tutorials/output/screenshots/{tutorial}/`:
       - Line 37: `apps/tutorials/output/{tutorial}/step-*.png` -> `apps/tutorials/output/screenshots/{tutorial}/step-*.png`
       - Line 39: resize path reference
       - Line 42: `apps/tutorials/output/{tutorial}/step-{NNN}.png.small.png` -> `apps/tutorials/output/screenshots/{tutorial}/step-{NNN}.png.small.png`
       - Line 49: cleanup rm path
       - Line 184: `Screenshots output: apps/tutorials/output/{name}/step-{NNN}.png` -> `Screenshots output: apps/tutorials/output/screenshots/{name}/step-{NNN}.png`

       Note: .opencode/commands/audit-tutorial.md does NOT exist -- skip it.
  </action>
  <verify>
    <automated>cd apps/tutorials && grep -rn 'process.cwd(), "output", TUTORIAL_ID' capture/*.spec.ts | grep -v screenshots && echo "FAIL: specs still use old path" || echo "PASS: all specs updated" && grep -c 'output/screenshots' ../../.claude/commands/audit-tutorial.md | xargs -I{} test {} -ge 3 && echo "PASS: audit command updated" || echo "FAIL: audit command not updated"</automated>
  </verify>
  <done>
    - All 17 capture spec files reference output/screenshots/ for their outputDir
    - audit-tutorial.md references output/screenshots/{tutorial}/ for all screenshot paths
  </done>
</task>

<task type="auto">
  <name>Task 3: Move existing output data to new directory structure</name>
  <files>N/A (filesystem only)</files>
  <action>
    Move existing generated data to match the new directory structure. All commands run from `apps/tutorials/`.

    1. If `audio/` directory exists with content:
       `mkdir -p output/audio && mv audio/* output/audio/ && rmdir audio`

    2. If `output/` already has tutorial screenshot subdirectories (directories containing step-*.png files):
       `mkdir -p output/screenshots`
       For each tutorial dir in output/ that contains step-*.png files (NOT audio, NOT screenshots, NOT videos):
       `mv output/{tutorial-dir} output/screenshots/{tutorial-dir}`

    3. If `videos/` directory exists with content:
       `mkdir -p output/videos && mv videos/* output/videos/ && rmdir videos`

    Handle gracefully if any of these directories don't exist (they may have been cleaned).
    Do NOT error if source dirs are empty or missing.
  </action>
  <verify>
    <automated>cd apps/tutorials && test ! -d audio && test ! -d videos && echo "PASS: old dirs removed" || echo "FAIL: old dirs still exist"</automated>
  </verify>
  <done>
    - No top-level audio/ directory exists in apps/tutorials/
    - No top-level videos/ directory exists in apps/tutorials/
    - Any existing screenshots are under output/screenshots/
    - Any existing audio is under output/audio/
    - Any existing videos are under output/videos/
  </done>
</task>

</tasks>

<verification>
After all tasks complete:

1. `grep -rn '"audio"' apps/tutorials/scripts/ apps/tutorials/src/remotion/ | grep -v 'output.*audio' | grep -v node_modules` returns nothing (no bare audio/ refs)
2. `grep -rn '"videos"' apps/tutorials/scripts/ | grep -v 'output.*videos'` returns nothing (no bare videos/ refs)
3. `grep -rn 'process.cwd(), "output", TUTORIAL_ID' apps/tutorials/capture/*.spec.ts | grep -v screenshots` returns nothing (all specs updated)
4. `ls apps/tutorials/audio apps/tutorials/videos 2>&1 | grep -c "No such"` returns 2 (old dirs gone)
5. TypeScript compiles: `cd apps/tutorials && npx tsc --noEmit` succeeds
</verification>

<success_criteria>
- All tutorial output artifacts route through output/ subdirectories (audio, screenshots, videos)
- No references to bare `audio/` or `videos/` directories remain in source code
- Remotion staticFile() paths resolve correctly from the project root public dir
- Existing data moved to new locations
- TypeScript compilation passes
</success_criteria>

<output>
After completion, create `.planning/quick/32-reorganize-tutorial-output-directories-u/32-SUMMARY.md`
</output>
