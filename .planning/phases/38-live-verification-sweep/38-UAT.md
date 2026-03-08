# Phase 38 Browser UAT

## Locked Environment

- Web origin: `https://lumenalta-hackathon.vercel.app`
- Agent origin: `https://lumenalta-agent-production.up.railway.app`
- Templates list URL: `https://lumenalta-hackathon.vercel.app/templates`
- Touch 4 settings URL: `https://lumenalta-hackathon.vercel.app/settings/deck-structures/touch-4`
- Localhost, preview URLs, and ad hoc tunnels are out of scope.

## Template Under Test

- Template identifier to record before starting: `[fill in exact template name + template id/URL slug from production]`
- Slide viewer URL for the same template: `https://lumenalta-hackathon.vercel.app/templates/[template-id]/slides`
- Rule: use the same production template from both classify surfaces.

## Expected Saved Badge Copy

- Proposal: `Example (Touch 4+ - Proposal)`
- Talk Track: `Example (Touch 4+ - Talk Track)`
- FAQ: `Example (Touch 4+ - FAQ)`

## Scenario 1 - Cross-surface Touch 4 classification

### Steps

1. Open the production Templates list at `https://lumenalta-hackathon.vercel.app/templates`.
2. Locate the recorded template and open the classify UI from the Templates surface.
3. Set classification to `Example` and touch type to `Touch 4+`.
4. Confirm the artifact choice UI appears only for `Example + Touch 4+`.
5. Pick exactly one artifact: `Proposal`, `Talk Track`, or `FAQ`.
6. Save, wait for the success state, then refresh the Templates page.
7. Confirm the saved badge still shows the exact artifact-qualified copy from the table above.
8. Open the same template in the Slide Viewer at `https://lumenalta-hackathon.vercel.app/templates/[template-id]/slides`.
9. Repeat the same classify flow there with the same artifact choice.
10. Refresh the Slide Viewer page.
11. Confirm the saved badge still shows the same exact artifact-qualified copy after reload.

### Pass Conditions

- The artifact selector appears only for `Example + Touch 4+`.
- Exactly one artifact can be chosen before save.
- After refresh, both surfaces keep the same saved badge text: `Proposal`, `Talk Track`, or `FAQ`.

### Result Template

- Status: `[pass | fail]`
- Artifact used: `[proposal | talk_track | faq]`
- Templates surface evidence: `[badge text after refresh, timestamp, optional screenshot note]`
- Slide Viewer evidence: `[badge text after refresh, timestamp, optional screenshot note]`
- Failure notes: `[exact failing step + observed behavior, if any]`

## Scenario 2 - Touch 4 settings tab behavior

### Steps

1. Open `https://lumenalta-hackathon.vercel.app/settings/deck-structures/touch-4`.
2. Confirm `Proposal` is selected by default on first load.
3. Before switching tabs, inspect all three tab triggers and confirm each shows its own confidence/example context.
4. Switch to `Proposal`, `Talk Track`, and `FAQ` one by one.
5. For each tab, confirm the visible panel matches the active artifact tab.
6. From one active artifact tab, send a chat refinement message.
7. Confirm the behavior stays scoped to that active artifact tab and does not jump to a different artifact.
8. If a zero-example tab is available, use that tab for the chat refinement check and confirm chat still works there.

### Pass Conditions

- `Proposal` is the default tab.
- `Proposal`, `Talk Track`, and `FAQ` each show their own confidence/example context before opening the tab.
- The visible detail and chat experience stay scoped to the active artifact tab.
- A zero-example tab, if present, still allows artifact-scoped chat refinement.

### Result Template

- Status: `[pass | fail]`
- Default tab evidence: `[what loaded first]`
- Proposal trigger evidence: `[confidence/example context shown before open]`
- Talk Track trigger evidence: `[confidence/example context shown before open]`
- FAQ trigger evidence: `[confidence/example context shown before open]`
- Chat tab used: `[proposal | talk_track | faq]`
- Chat scope evidence: `[message behavior stayed on active tab, timestamp, optional network/log note]`
- Failure notes: `[exact failing step + observed behavior, if any]`

## Final Outcome

- Overall result: `[approved | diagnosed]`
- Approval note or diagnosis summary: `[fill after browser run]`
- Follow-up issues to carry forward: `[none or explicit issue list]`
