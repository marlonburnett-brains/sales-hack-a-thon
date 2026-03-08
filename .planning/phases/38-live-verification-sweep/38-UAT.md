# Phase 38 Browser UAT

## Locked Environment

- Web origin: `https://lumenalta-hackathon.vercel.app`
- Agent origin: `https://lumenalta-agent-production.up.railway.app`
- Templates list URL: `https://lumenalta-hackathon.vercel.app/templates`
- Touch 4 settings URL: `https://lumenalta-hackathon.vercel.app/settings/deck-structures/touch-4`
- Localhost, preview URLs, and ad hoc tunnels are out of scope.

## Template Under Test

- Template name: `All Slide Layouts`
- Template ID: `cmmfb0cyn0001rt01xszt3lkf`
- Slide viewer URL: `https://lumenalta-hackathon.vercel.app/templates/cmmfb0cyn0001rt01xszt3lkf/slides`
- Artifact tested for persistence: `proposal`
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

### Recorded Result

- Status: `pass`
- Artifact used: `proposal`
- Templates surface evidence: Production classify flow saved `Example (Touch 4+ - Proposal)` and after refresh the template card text still showed `T4+ Example (Touch 4+ - Proposal)`.
- Slide Viewer evidence: After refresh, the page body still showed `Example (Touch 4+ - Proposal)` under `CONTENT CLASSIFICATION`.
- Failure notes: `None`

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

### Recorded Result

- Status: `pass`
- Default tab evidence: `Proposal` loaded as the default selected tab.
- Proposal trigger evidence: `Low confidence - needs more examples / 1 example`
- Talk Track trigger evidence: `No examples - needs more examples / 0 examples`
- FAQ trigger evidence: `No examples - needs more examples / 0 examples`
- Chat tab used: `proposal`
- Chat scope evidence: The user re-ran the production settings flow against the same `touch_4/proposal` route proven in `.planning/phases/38-live-verification-sweep/38-BACKEND-EVIDENCE.md`, confirmed assistant text streamed instead of `Chat failed: 404`, and confirmed the visible structure update stayed on the active artifact tab end-to-end.
- Production request evidence: The approved production browser rerun stayed tied to the same artifact-qualified request body captured in backend evidence: `{"touchType":"touch_4","artifactType":"proposal","message":"Refine the proposal structure into 5 concise sales-oriented sections with a stronger narrative arc."}`.
- Follow-up note: The rerun briefly exposed a client-only rendering bug where the new section faded after the diff highlight timeout even though a refresh showed the saved structure. That issue was fixed in `e7b81ba`, `1629d33`, and `afce322`, pushed to `main`, and the user then explicitly approved the scenario as passing.
- Failure notes: `None`

## Final Outcome

- Overall result: `approved`
- Approval note or diagnosis summary: Scenario 1 passed with saved artifact-qualified classification persisting after refresh from both Templates and Slide Viewer, and Scenario 2 now passes after the production artifact-scoped chat fix plus the follow-up web-state persistence fix. The final approved browser run confirms Touch 4 settings tabs and chat stay artifact-scoped end-to-end for `touch_4/proposal` on the locked production origins.
- Follow-up issues to carry forward:
  - `None`
