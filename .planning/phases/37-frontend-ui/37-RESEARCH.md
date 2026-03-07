# Phase 37: Frontend UI - Research

**Researched:** 2026-03-07
**Domain:** Next.js App Router frontend for Touch 4 artifact classification and settings UI
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Touch 4 classification flow
- In classification UI, artifact type appears inline under touch selection once the user is classifying as `Example` and selects `Touch 4`
- Artifact type is required for Touch 4 examples and must be a single choice: `Proposal`, `Talk Track`, or `FAQ`
- Artifact choices should be shown as visible radio-card style options, not hidden in a dropdown
- Saved classification should surface the artifact in the card badge/label so users can see the decision without reopening the dialog

### Example vs template touch assignment
- Examples can only be assigned to one touch type total
- Templates may still be assigned to multiple touch types
- Artifact type applies only to the Touch 4 classification context, not as a global type for every touch
- If Touch 4 is deselected in the form, any selected artifact type should clear immediately
- Saving should be blocked with inline validation if Touch 4 is selected without an artifact type

### Touch 4 settings navigation
- Keep the existing Settings left-nav structure; do not add new sidebar entries for each artifact type
- On the Touch 4 Settings page, show `Proposal`, `Talk Track`, and `FAQ` as in-page top tabs
- Default the Touch 4 page to the `Proposal` tab
- Each tab should keep its own structure view, confidence display, and chat refinement in the tab content
- The tab strip should expose confidence context at a glance, not just inside the active panel

### Per-artifact empty and confidence states
- Each Touch 4 artifact tab gets its own empty state and CTA back to Templates for classification
- Low-confidence tabs should still show the confidence badge, with wording that makes the low-confidence state explicit
- Empty artifact tabs should still allow chat refinement rather than showing a disabled-only chat area
- Users should be able to compare confidence across Proposal, Talk Track, and FAQ directly from the tab strip

### Claude's Discretion
- Exact tab visual styling and spacing
- Exact wording of inline validation and low-confidence helper copy
- Whether artifact detail appears inside the existing classification badge text or as a closely related visual variant, as long as the artifact is visible on the card

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLSF-01 | User can select artifact type (Proposal / Talk Track / FAQ) when classifying a presentation as Touch 4 Example | Reuse existing classify surfaces, but extend shared classify state/action payload with `artifactType`, single-touch rules, radio-card UI, and card badge rendering |
| CLSF-02 | Artifact type selector only appears when Touch 4 + Example is selected in classify UI | Centralize derived visibility logic so both `template-card.tsx` and `classification-panel.tsx` gate artifact controls from the same condition |
| DECK-03 | Settings Touch 4 page shows tabbed view (Proposal / Talk Track / FAQ) with separate structure per tab | Use existing Radix tabs wrapper and keep the current left-nav; make `/settings/deck-structures/touch-4` render one page with three in-page tabs |
| DECK-04 | Each Touch 4 artifact tab shows independent confidence scoring based on classified example count for that artifact type | Fetch Touch 4 summaries/details per artifact key and surface each tab's own `exampleCount`, `confidence`, `confidenceColor`, and `confidenceLabel` |
</phase_requirements>

## Summary

Phase 37 should be planned as a focused UI refactor across two existing classify entry points plus one Touch 4 settings route, not as a greenfield screen build. The existing web stack already has the right primitives: Next.js App Router server/client composition, thin server actions over `api-client.ts`, shared artifact constants in `@lumenalta/schemas`, a reusable Radix tabs wrapper, and a detail view/chat surface that already understands Touch 4 artifact context on the deck-structure side.

The biggest planning insight is that the current frontend and route contract are only partially ready. Settings detail/infer/chat already thread `artifactType`, but template classification still does not: `Template` in `api-client.ts` has no `artifactType`, `classifyTemplate()` and `classifyTemplateAction()` do not send it, and the agent's `/templates/:id/classify` route only accepts `classification` and `touchTypes`. If Phase 37 must persist artifact selection, the plan needs a small end-to-end contract update as part of the frontend work, even if the phase is primarily UI.

The other important constraint is consistency. The classify UI exists twice today (`template-card.tsx` and `classification-panel.tsx`) with near-duplicate example/template logic, so planning should treat shared state derivation and validation as a first-class task. On the settings side, Touch 4 should become a single page with in-page artifact tabs that show at-a-glance confidence on the tab strip, keep chat scoped per artifact, and keep chat enabled even when an artifact has zero examples.

**Primary recommendation:** Plan Phase 37 around one shared Touch 4 artifact classification model reused in both classify surfaces, and one artifact-aware Touch 4 settings shell that composes the existing detail/chat components per tab.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | `15.5.12` | App Router pages, server actions, route handlers | Already drives the authenticated settings routes and server/client composition in `apps/web` |
| React | `19.0.0` | Interactive client components for classify dialogs, tabs, and chat | Existing UI already uses client components with local state and effects |
| `@radix-ui/react-tabs` | `1.1.13` | Accessible in-page tabbed UI for Touch 4 settings | Already wrapped in `apps/web/src/components/ui/tabs.tsx`; official docs confirm keyboard navigation and controlled/uncontrolled support |
| Tailwind CSS | `3.4.17` | Styling for card buttons, tabs, empty states, and badges | Existing web UI is consistently styled with Tailwind utility classes |
| `@lumenalta/schemas` | workspace | Shared `ARTIFACT_TYPES`, `ArtifactType`, and `ARTIFACT_TYPE_LABELS` | Prevents duplicated raw values/labels across web and agent layers |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | `4.3.6` | Validate route payloads and artifact query params | Keep using for web proxy and agent classify/deck endpoints |
| `lucide-react` | `0.576.0` | Consistent icons for tabs, empty states, and badges | Reuse existing icon language instead of introducing another icon set |
| Vitest + Testing Library | `4.0.18` + `16.3.2` | Component/unit tests for classify flows and Touch 4 tabs | Existing web test stack and config already support TSX/jsdom coverage |
| `revalidatePath` | Next built-in | Revalidate affected routes after server mutations | Existing classify action already uses this pattern; keep mutations server-side |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Radix tabs via `components/ui/tabs.tsx` | Custom tab state with plain buttons | Unnecessary accessibility and keyboard work; existing wrapper already fits the route |
| Shared artifact constants from `@lumenalta/schemas` | Local web-only labels/enums | Risks drift between saved values, query params, and visible copy |
| Reusing current Touch 4 detail/chat components with artifact props | New Touch 4-only settings page from scratch | More code, more divergence, and more chance of regressing Touch 1-3 |
| Reusing current server-action + `api-client` mutation path | Client-only fetches from components | Breaks existing mutation/revalidation pattern and spreads request logic into UI |

**Installation:**
```bash
# No new packages required; Phase 37 can use existing workspace dependencies.
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/
├── components/
│   ├── template-card.tsx                  # classify dialog entry point 1
│   ├── slide-viewer/classification-panel.tsx # classify entry point 2
│   └── settings/
│       ├── touch-type-detail-view.tsx     # existing detail surface to extend with artifact props
│       ├── chat-bar.tsx                   # existing chat surface to thread artifact context
│       └── ui/tabs.tsx                    # reusable Radix tabs wrapper
├── app/(authenticated)/settings/deck-structures/[touchType]/page.tsx
│                                           # Touch 4 route shell for tabbed settings view
└── lib/
    ├── actions/template-actions.ts         # classify mutation + revalidation
    ├── actions/deck-structure-actions.ts   # detail/infer reads for settings
    ├── api-client.ts                       # request/response contracts
    └── template-utils.ts                   # classification labels + touch labels
```

### Pattern 1: Shared classify-state derivation
**What:** Move the Touch 4-specific visibility, clearing, single-touch selection, and validation rules into one shared helper or subcomponent reused by both classify surfaces.
**When to use:** Any time artifact selection rules or badge copy must stay identical between `template-card.tsx` and `classification-panel.tsx`.
**Example:**
```typescript
// Source: repo patterns from apps/web/src/components/template-card.tsx
// and apps/web/src/components/slide-viewer/classification-panel.tsx
const isExample = classifyType === "example";
const selectedTouch = isExample ? selectedTouches[0] ?? null : null;
const showArtifactType = isExample && selectedTouch === "touch_4";

if (!showArtifactType) {
  setArtifactType(null);
}
```

### Pattern 2: Server route shell + client tab surface
**What:** Keep `/settings/deck-structures/[touchType]/page.tsx` as the route entry, but render a client Touch 4 tab shell only when `touchType === "touch_4"`; keep Touch 1-3 on the existing detail view.
**When to use:** For interactive tab state while preserving Next.js App Router server-first routing.
**Example:**
```tsx
// Source: Next.js Server/Client Components docs
export default async function TouchTypePage({ params }: Props) {
  const { touchType: slug } = await params;

  if (slug === "touch-4") {
    return <Touch4ArtifactTabs touchType="touch_4" />;
  }

  return <TouchTypeDetailView touchType={VALID_SLUGS[slug]} label={SLUG_LABELS[slug]} />;
}
```

### Pattern 3: Artifact-aware thin action layer
**What:** Keep all request construction in `api-client.ts` and action wrappers, passing `artifactType` only when Touch 4 requires it.
**When to use:** For classify persistence, Touch 4 detail loading, infer triggers, and chat refinement.
**Example:**
```typescript
// Source: repo pattern from apps/web/src/lib/api-client.ts
const query = new URLSearchParams();
if (artifactType) {
  query.set("artifactType", artifactType);
}
const suffix = query.size > 0 ? `?${query.toString()}` : "";
```

### Pattern 4: Confidence-at-a-glance tabs
**What:** Load all three Touch 4 summary keys up front so each tab trigger can show label + confidence context, while content panels load or reuse the correct per-artifact detail.
**When to use:** On the Touch 4 settings page where users must compare Proposal / Talk Track / FAQ without opening each panel first.
**Example:**
```tsx
// Source: Radix Tabs docs + repo DeckStructureSummary shape
<Tabs defaultValue="proposal">
  <TabsList aria-label="Touch 4 artifact types">
    {artifacts.map((artifact) => (
      <TabsTrigger key={artifact.value} value={artifact.value}>
        {artifact.label} • {summaryByArtifact[artifact.value].confidenceLabel}
      </TabsTrigger>
    ))}
  </TabsList>
</Tabs>
```

### Anti-Patterns to Avoid
- **Duplicated classify rules:** Updating `template-card.tsx` and `classification-panel.tsx` separately will drift quickly; share logic.
- **Checkbox-based Touch 4 examples:** Current example UI allows multi-select touch assignment; that conflicts with the locked single-touch decision for examples.
- **Touch 4 treated like generic Touch 1-3 in settings:** One detail view with no artifact tabs cannot satisfy DECK-03/04.
- **Disabled empty-state chat for Touch 4 tabs:** Existing `touch-type-detail-view.tsx` disables chat when `exampleCount === 0`; this directly conflicts with the user decision.
- **Local artifact strings:** Do not hardcode `"proposal" | "talk_track" | "faq"` in multiple files.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| In-page artifact tabs | Custom tab keyboard/focus logic | Existing Radix tabs wrapper in `apps/web/src/components/ui/tabs.tsx` | Official docs already cover ARIA tabs behavior and keyboard navigation |
| Artifact enum + labels | Ad hoc string unions and label maps in web components | `ARTIFACT_TYPES`, `ArtifactType`, `ARTIFACT_TYPE_LABELS` from `@lumenalta/schemas` | Keeps route params, persisted values, and display copy aligned |
| Query-string construction | Manual string concatenation for `artifactType` | `URLSearchParams` pattern already used in `api-client.ts` and chat route | Avoids malformed URLs and inconsistent encoding |
| Confidence heuristics in UI | Recomputing confidence thresholds client-side | Backend-provided `confidence`, `confidenceColor`, `confidenceLabel`, `exampleCount` | Phase 36 already established the artifact-aware scoring contract |
| Streaming chat protocol | New client parser or alternate delimiter | Existing `/api/deck-structures/chat` stream + `---STRUCTURE_UPDATE---` split | Already matches current chat refinement implementation |

**Key insight:** Most of this phase is composition, not invention. The hard work is threading one more field (`artifactType`) through existing contracts and removing Touch 4 assumptions that still think in single generic-touch terms.

## Common Pitfalls

### Pitfall 1: Planning only one classify surface
**What goes wrong:** `template-card.tsx` works but `classification-panel.tsx` stays stale, or vice versa.
**Why it happens:** Both components currently own near-duplicate classify state and validation locally.
**How to avoid:** Plan a shared helper/subcomponent first, then wire both surfaces.
**Warning signs:** Different badge text, different save blocking, or one surface still allows multi-touch examples.

### Pitfall 2: Missing persistence contract for artifact type
**What goes wrong:** UI lets users pick Proposal/Talk Track/FAQ, but the choice is lost after save or reload.
**Why it happens:** `Template` in `api-client.ts` has no `artifactType`, the web classify action does not send it, and the agent classify route currently does not parse or persist it.
**How to avoid:** Include a small contract task in the phase plan: update request schema, server action, client type, and route persistence together.
**Warning signs:** Network payload contains only `classification` and `touchTypes`, or saved badge still reads only `Example (Touch 4+)`.

### Pitfall 3: Forgetting the example single-touch rule
**What goes wrong:** Users can still assign multiple touch types to examples, making Touch 4 artifact examples ambiguous.
**Why it happens:** Both current classify UIs use checkbox lists for examples.
**How to avoid:** Split classify behavior by classification type: templates may remain multi-select, examples should become single-select.
**Warning signs:** Checked state allows `touch_1` and `touch_4` simultaneously on an example.

### Pitfall 4: Leaving empty Touch 4 tabs non-actionable
**What goes wrong:** A zero-example artifact tab shows only a disabled chat block, which conflicts with locked decisions.
**Why it happens:** `TouchTypeDetailView` disables `ChatBar` when `exampleCount === 0`.
**How to avoid:** Plan an artifact-aware empty state for Touch 4 that still renders active chat and the CTA to `/templates`.
**Warning signs:** Empty Proposal/Talk Track/FAQ panels show "Classify examples for this touch type to enable chat refinement".

### Pitfall 5: Hiding confidence inside the active panel only
**What goes wrong:** Users must click every artifact tab to compare strength.
**Why it happens:** Existing confidence UI lives inside the detail content area, not in navigation.
**How to avoid:** Fetch per-artifact summaries first and render confidence context in each tab trigger.
**Warning signs:** Inactive tabs show only text labels with no count, score, or low-confidence cue.

### Pitfall 6: Over-expanding the client boundary
**What goes wrong:** Large route trees become client-rendered just to support tabs.
**Why it happens:** It is tempting to mark the whole settings page as `"use client"`.
**How to avoid:** Keep the route/page server-side and isolate interactivity in small client components.
**Warning signs:** Layout/page files gain `"use client"` without needing browser APIs directly.

## Code Examples

Verified patterns from official sources and the repo:

### Accessible tab shell for Touch 4 artifacts
```tsx
// Source: https://www.radix-ui.com/primitives/docs/components/tabs
<Tabs defaultValue="proposal">
  <TabsList aria-label="Touch 4 artifact types">
    <TabsTrigger value="proposal">Proposal</TabsTrigger>
    <TabsTrigger value="talk_track">Talk Track</TabsTrigger>
    <TabsTrigger value="faq">FAQ</TabsTrigger>
  </TabsList>

  <TabsContent value="proposal">...</TabsContent>
  <TabsContent value="talk_track">...</TabsContent>
  <TabsContent value="faq">...</TabsContent>
</Tabs>
```

### Required single-choice radio group for artifact type
```tsx
// Source: https://www.w3.org/WAI/ARIA/apg/patterns/radio/
<fieldset>
  <legend>Artifact type</legend>
  {ARTIFACT_TYPES.map((value) => (
    <label key={value}>
      <input
        type="radio"
        name="artifactType"
        value={value}
        checked={artifactType === value}
        onChange={() => setArtifactType(value)}
      />
      {ARTIFACT_TYPE_LABELS[value]}
    </label>
  ))}
</fieldset>
```

### Thin server mutation wrapper with revalidation
```typescript
// Source: apps/web/src/lib/actions/template-actions.ts
export async function classifyTemplateAction(
  templateId: string,
  classification: "template" | "example",
  touchTypes?: string[],
  artifactType?: string | null,
) {
  await classifyTemplate(templateId, { classification, touchTypes, artifactType });
  revalidatePath("/templates");
  revalidatePath(`/templates/${templateId}`);
  revalidatePath(`/templates/${templateId}/slides`);
}
```

### Role-based assertions for artifact tabs and radio cards
```tsx
// Source: https://testing-library.com/docs/queries/byrole/
expect(screen.getByRole("tab", { name: /proposal/i })).toBeInTheDocument();
expect(screen.getByRole("radio", { name: /faq/i })).toBeChecked();
expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic `touch_4` deck structure row | Phase 36 artifact-aware Touch 4 keys (`proposal`, `talk_track`, `faq`) | 2026-03-07 / Phase 36 | UI must stop treating Touch 4 as one structure |
| Example classify UI as multi-checkbox touch assignment | Example classify UI should be single-touch for this phase, with artifact radio cards only for Touch 4 | Phase 37 target | Avoids ambiguous example datasets and matches locked decisions |
| Touch 4 settings as one detail page | Touch 4 settings should be one page with in-page artifact tabs | Phase 37 target | Keeps left nav stable while exposing per-artifact structure/confidence/chat |
| Empty-state chat disabled | Empty Touch 4 artifact tabs stay actionable and chat-enabled | Phase 37 target | Users can refine structure even before strong example coverage exists |

**Deprecated/outdated:**
- Generic Touch 4 UI assumptions that ignore `artifactType`
- Touch 4 example classification badges that only show touch labels and not artifact labels
- Touch 4 settings/detail calls that are planned as `touchType`-only in the web action layer

## Open Questions

1. **Should Phase 37 include the classify-route contract update?**
   - What we know: Current web and agent classify contracts do not accept `artifactType`, so persistence is impossible without touching that path.
   - What's unclear: Whether this was intentionally deferred despite the phase being described as frontend-only.
   - Recommendation: Treat the route/action/type update as required implementation support inside Phase 37 rather than a separate phase.

2. **Should Touch 4 tab details load eagerly or lazily?**
   - What we know: The tab strip needs all three summaries immediately for at-a-glance confidence.
   - What's unclear: Whether all three full detail payloads should be fetched on first paint.
   - Recommendation: Load all summaries immediately; load active-tab detail immediately and either prefetch remaining details in parallel after mount or on first tab activation.

3. **Does classification save need any additional settings-route revalidation?**
   - What we know: `classifyTemplateAction()` currently revalidates template routes only.
   - What's unclear: Whether Phase 37 mutations should also invalidate Touch 4 settings routes if the user navigates there immediately after classification.
   - Recommendation: If any Phase 37 mutation changes settings-visible counts or labels synchronously, add targeted `revalidatePath()` coverage for the affected settings route(s).

## Sources

### Primary (HIGH confidence)
- Repository source: `apps/web/package.json` - confirmed Next.js 15.5.12, React 19, Radix Tabs 1.1.13, Tailwind 3.4.17, Vitest stack
- Repository source: `packages/schemas/constants.ts` - verified `ARTIFACT_TYPES`, `ArtifactType`, and `ARTIFACT_TYPE_LABELS`
- Repository source: `apps/web/src/components/template-card.tsx` - current classify dialog, checkbox-based example touch selection, and badge rendering
- Repository source: `apps/web/src/components/slide-viewer/classification-panel.tsx` - second classify surface with duplicated example/template logic
- Repository source: `apps/web/src/components/settings/touch-type-detail-view.tsx` - current empty-state, confidence, and disabled chat behavior
- Repository source: `apps/web/src/components/settings/chat-bar.tsx` - current streaming chat payload and Touch 4 route usage
- Repository source: `apps/web/src/lib/actions/template-actions.ts` - current classify server action and revalidation pattern
- Repository source: `apps/web/src/lib/actions/deck-structure-actions.ts` and `apps/web/src/lib/api-client.ts` - artifact-aware deck structure detail/infer requests, but classify contract gap
- Repository source: `apps/agent/src/mastra/index.ts:1387` - verified `/templates/:id/classify` currently accepts only `classification` and `touchTypes`
- Repository source: `apps/agent/src/deck-intelligence/deck-structure-key.ts` - verified Touch 4 deck structures require `artifactType`
- https://www.radix-ui.com/primitives/docs/components/tabs - verified controlled/uncontrolled tabs, keyboard navigation, and ARIA tabs pattern
- https://nextjs.org/docs/app/getting-started/server-and-client-components - verified server/client composition guidance and narrow client boundaries
- https://nextjs.org/docs/app/api-reference/functions/revalidatePath - verified server-only revalidation behavior
- https://www.w3.org/WAI/ARIA/apg/patterns/radio/ - verified radio-group semantics and keyboard behavior for required single-choice input

### Secondary (MEDIUM confidence)
- https://testing-library.com/docs/queries/byrole/ - verified role-based testing guidance for tabs, radios, and selected state

### Tertiary (LOW confidence)
- Internal skill output from `ui-ux-pro-max` search - useful reminders on inline validation, form labels, modal focus, and dynamic feedback, but not an authoritative product-specific source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - package versions and repo usage are directly verifiable
- Architecture: MEDIUM - repo patterns are clear, but the classify persistence contract gap means one implementation boundary still needs explicit plan coverage
- Pitfalls: HIGH - most are proven by current code paths and locked user decisions

**Research date:** 2026-03-07
**Valid until:** 2026-04-06
