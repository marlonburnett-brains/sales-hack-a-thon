# Feature Research -- v1.6 Touch 4 Artifact Intelligence

**Domain:** Artifact type sub-classification and per-artifact deck structures for agentic sales platform
**Researched:** 2026-03-07
**Confidence:** HIGH (all features build directly on existing v1.5 infrastructure; codebase reviewed; clear implementation paths)

## Scope

Features for v1.6 milestone ONLY. Two core capabilities:
1. Touch 4 artifact type sub-classification (Proposal / Talk Track / FAQ)
2. Per-artifact-type deck structures displayed in Settings

Existing v1.5 features leveraged: Template/Example classification with touch type binding, AI-inferred deck structures per touch type, streaming chat refinement, cron auto-inference, Popover classify UI, Settings page with per-touch-type pages.

---

## Table Stakes

Features users expect once artifact type sub-classification exists. Missing these = feature feels half-built.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **F1: Artifact type selector in classify UI** | When classifying as Example with Touch 4 selected, users expect to specify what KIND of Touch 4 artifact this is (Proposal deck, Talk Track doc, Buyer FAQ doc). Without this, Touch 4 examples are an undifferentiated bucket. | LOW | Extend existing Popover classify UI (`classification-panel.tsx` TemplateClassificationSection). Show artifact type radio group conditionally when `touch_4` is checked. Three values: `proposal`, `talk_track`, `faq`. |
| **F2: Artifact type persisted on Template model** | The artifact type must survive page reloads and be queryable for deck structure inference. | LOW | Add `artifactType` column to `Template` model (String, nullable). Only populated when `contentClassification = "example"` AND `touchTypes` includes `touch_4`. Extend `/templates/:id/classify` endpoint to accept `artifactType` param. Forward-only migration per CLAUDE.md rules. |
| **F3: Artifact type visible on template cards** | Users need to see at a glance whether a Touch 4 example is a Proposal, Talk Track, or FAQ. Classification label currently shows "Example (Touch 4+)" which is insufficient. | LOW | Extend `getClassificationLabel()` in `template-utils.ts` to append artifact type when present: "Example (Touch 4+ -- Proposal)". Display as chip/badge on template cards. |
| **F4: Three separate deck structures for Touch 4 in Settings** | Touch 4 currently has one deck structure page. With artifact types, users expect to see the inferred structure for each artifact type independently. A Proposal deck structure is fundamentally different from a Talk Track structure. | MEDIUM | Replace single `/settings/deck-structures/touch-4` page with three sub-pages or tabbed view: Proposal, Talk Track, FAQ. Each runs independent deck structure inference against its own subset of examples. |
| **F5: Independent deck structure inference per artifact type** | The inference engine must filter examples by artifact type, not just touch type. A Talk Track has a completely different section flow than a Proposal deck. Mixing them produces nonsensical structures. | MEDIUM | Modify `inferDeckStructure()` to accept optional `artifactType` filter. For `touch_4`, run inference 3x (once per artifact type). `DeckStructure` model needs a new unique key: `touchType + artifactType` instead of just `touchType`. |
| **F6: Confidence scoring per artifact type** | Each artifact type may have different example counts. Proposal might have 3 examples (medium confidence) while FAQ has 0 (no examples). Users need per-artifact confidence. | LOW | Already handled by `calculateConfidence(exampleCount)`. Just pass filtered count per artifact type. No new logic needed -- just correct data partitioning. |

## Differentiators

Features that add intelligence beyond basic sub-classification.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **F7: Per-artifact chat refinement** | Each artifact type gets its own chat history and refinement context. A user refining the Proposal structure should not see Talk Track chat messages. | LOW | `DeckStructure` already has `chatMessages` relation and `chatContextJson`. Since each artifact type gets its own `DeckStructure` row, chat is automatically scoped. Just ensure the chat endpoint passes `artifactType` alongside `touchType`. |
| **F8: Cron auto-inference respects artifact types** | Background cron should detect changes per artifact type and re-infer independently. A new FAQ example should not trigger Proposal re-inference. | LOW | Extend `computeDataHash()` to include artifact type in the hash input. Cron iterates touch types; for `touch_4`, iterate 3 artifact types. Active session protection already works per `DeckStructure` row via `lastChatAt`. |
| **F9: Artifact type filter in template list** | Users filtering templates by Touch 4 want to further filter by Proposal vs Talk Track vs FAQ. | LOW | Add artifact type to template filter UI. Already has touch type filter; add cascading dropdown. |

## Anti-Features

Features to explicitly NOT build in v1.6.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **AI-suggested artifact type** | Distinguishing Proposal from Talk Track requires understanding document intent, not just content. A slide deck with bullet points could be either. User classification is more reliable. | Manual classification via UI. User selects artifact type explicitly. |
| **Artifact types for Touch 1-3** | Touch 1-3 produce single artifact types (pager, intro deck, capability deck). Sub-classification adds no value and confuses the model. | Artifact type UI only appears when Touch 4 is selected. |
| **Cross-artifact structure comparison** | Comparing Proposal vs Talk Track structures adds UI complexity without clear user value. They serve different purposes. | Show each artifact type on its own page/tab. |
| **Artifact type on slide-level classification** | Slides don't have artifact types -- presentations do. Adding artifact type to SlideEmbedding classificationJson pollutes the per-slide taxonomy. | Artifact type lives on Template model only. Inference queries join Template -> SlideEmbedding. |
| **Custom artifact types** | Three artifact types (Proposal, Talk Track, FAQ) are the exact outputs of Touch 4 workflow. Custom types add UI complexity for no use case. | Fixed enum: `proposal`, `talk_track`, `faq`. |
| **Artifact type migration for existing data** | Existing Touch 4 examples (if any) should not be auto-assigned artifact types. User must review and classify. | Show "Action Required" for Touch 4 examples missing artifact type. |

## Feature-by-Feature Deep Analysis

### F1: Artifact Type Selector in Classify UI

**Current state:** `classification-panel.tsx` TemplateClassificationSection shows Template/Example radio, then touch type checkboxes when Example selected. No artifact type field.

**Change:** Add a third conditional section: when `classifyType === "example"` AND `selectedTouches.includes("touch_4")`, show artifact type radio group (Proposal / Talk Track / FAQ).

**Implementation:**
- New state: `const [artifactType, setArtifactType] = useState<string | null>(null)`
- Reset artifact type when touch_4 is unchecked
- Pass artifact type to `classifyTemplateAction()` as optional param
- Validation: if touch_4 selected, artifact type required

**Complexity:** LOW. Pure frontend extension of existing Popover classify form.

---

### F2: Artifact Type on Template Model

**Current state:** `Template` model has `contentClassification` (String, nullable) and `touchTypes` (String, JSON array). No artifact type column.

**Change:** Add `artifactType` column.

**Schema migration:**
```sql
ALTER TABLE "Template" ADD COLUMN "artifactType" TEXT;
```

**Agent endpoint change:** Extend `/templates/:id/classify` Zod schema:
```typescript
z.object({
  classification: z.enum(["template", "example"]),
  touchTypes: z.array(z.string()).optional(),
  artifactType: z.enum(["proposal", "talk_track", "faq"]).optional(),
})
```

**Validation:** `artifactType` is only valid when `classification === "example"` AND `touchTypes` includes `touch_4`. Clear `artifactType` to null when reclassifying as template or removing touch_4.

**Complexity:** LOW. One migration, one endpoint update.

---

### F3: Artifact Type Visible on Template Cards

**Current state:** `getClassificationLabel()` returns "Example (Touch 4+)" for Touch 4 examples.

**Change:** When artifact type is set, return "Example (Touch 4+ -- Proposal)" format.

**Implementation:**
- `getClassificationLabel(classification, touchTypes, artifactType?)` -- add optional third param
- Artifact type label map: `{ proposal: "Proposal", talk_track: "Talk Track", faq: "FAQ" }`
- Template list API must include `artifactType` in response
- Template card component passes artifact type through

**Complexity:** LOW. String formatting + data passthrough.

---

### F4: Three Deck Structure Views for Touch 4

**Current state:** Settings sidebar has Touch 1, Touch 2, Touch 3, Touch 4 links. Touch 4 renders one `TouchTypeDetailView`.

**Routing options:**
1. **Sub-routes:** `/settings/deck-structures/touch-4/proposal`, `/touch-4/talk-track`, `/touch-4/faq`
2. **Tabs within Touch 4 page:** Single route with horizontal tabs for Proposal / Talk Track / FAQ

**Recommendation:** Tabs within Touch 4 page. Reason: sub-routes require sidebar nav changes and add 3 more sidebar items, making the nav cluttered. Tabs keep the information architecture clean -- Touch 4 is one section with 3 artifact views inside.

**Implementation:**
- Modify `/settings/deck-structures/touch-4` page to render a tab bar: Proposal | Talk Track | FAQ
- Each tab renders a `TouchTypeDetailView` with `touchType="touch_4"` and `artifactType="proposal"|"talk_track"|"faq"`
- `TouchTypeDetailView` passes `artifactType` to `getDeckStructureAction()`
- Each tab has independent loading state, confidence badge, section flow, and chat bar

**Complexity:** MEDIUM. UI restructuring + data flow changes, but all components exist.

---

### F5: Independent Deck Structure Inference Per Artifact Type

**Current state:** `DeckStructure` model has `touchType` as `@unique`. `inferDeckStructure(touchType)` queries all examples for that touch type.

**Change:** Add `artifactType` to `DeckStructure` model and change unique constraint.

**Schema migration:**
```sql
ALTER TABLE "DeckStructure" ADD COLUMN "artifactType" TEXT;
-- Drop the old unique index on touchType alone
ALTER TABLE "DeckStructure" DROP CONSTRAINT "DeckStructure_touchType_key";
-- Create new composite unique
CREATE UNIQUE INDEX "DeckStructure_touchType_artifactType_key" ON "DeckStructure"("touchType", "artifactType");
```

**Note:** For Touch 1-3 and Pre-Call, `artifactType` remains NULL. The unique constraint must handle NULL correctly. PostgreSQL treats NULLs as distinct in unique indexes, so `(touch_1, NULL)` and `(touch_2, NULL)` are both allowed. However, two rows with `(touch_4, NULL)` would also be allowed, which is undesirable. Use a partial unique index or always set artifact type for touch_4.

**Recommended approach:** Use `@@unique([touchType, artifactType])` in Prisma, which creates a standard unique index. For touch_4, always require artifact type. For touch 1-3, artifact type is always null. This naturally prevents duplicates.

**Inference changes:**
- `inferDeckStructure(touchType, chatConstraints?, artifactType?)` -- add optional param
- When `artifactType` is provided, filter examples to those with matching `artifactType` on their Template record
- Query pattern: `prisma.template.findMany({ where: { contentClassification: "example", artifactType: artifactType } })` then filter by touch type in JSON
- `computeDataHash()` includes artifact type in hash input

**Complexity:** MEDIUM. Schema change + query filter + unique constraint migration.

---

### F6-F9: Supporting Features

These features are low complexity and naturally fall out of F1-F5 implementation:

- **F6 (Confidence per artifact type):** No new logic. `calculateConfidence()` receives filtered example count per artifact type.
- **F7 (Per-artifact chat):** Each `DeckStructure` row has its own `chatMessages`. Chat endpoint passes `artifactType` to find the right row.
- **F8 (Cron per artifact type):** Extend cron loop: for touch_4, iterate `["proposal", "talk_track", "faq"]`. `computeDataHash()` includes artifact type.
- **F9 (Template list filter):** Add `artifactType` to filter controls. Cascading: only show when Touch 4 filter active.

## Feature Dependencies

```
F1: Artifact Type Selector (UI)
    depends on: Existing classify UI (v1.5)
    enables: F2 (needs UI to set values)

F2: Artifact Type on Template Model (schema)
    depends on: Template model (v1.2)
    enables: F3, F5 (queryable data)

F3: Artifact Type Labels (display)
    depends on: F2 (needs artifactType data)

F4: Three Deck Structure Views (UI)
    depends on: Settings page (v1.5), F5 (needs per-artifact structures)

F5: Independent Inference Per Artifact Type (engine)
    depends on: F2 (needs artifactType on Template)
    depends on: DeckStructure model (v1.5)
    enables: F4, F6, F7, F8

F6: Per-Artifact Confidence (display)
    depends on: F5 (filtered example counts)

F7: Per-Artifact Chat (interaction)
    depends on: F5 (per-artifact DeckStructure rows)
    depends on: Chat refinement (v1.5)

F8: Cron Per Artifact Type (background)
    depends on: F5 (per-artifact inference)
    depends on: Auto-infer cron (v1.5)

F9: Template List Filter (UI)
    depends on: F2 (artifactType on Template)
```

### Dependency Notes

- **F1 and F2 are the foundation** -- everything else depends on artifact type being selectable (F1) and persisted (F2). Ship these first.
- **F3 is independent of F4-F8** -- just needs F2. Can ship alongside F1+F2 as a single phase.
- **F5 is the engine change** that unlocks F4, F6, F7, F8. Ship as its own phase.
- **F4 is the capstone UI** -- renders the results of F5. Ship last.
- **F7 and F8 are near-zero marginal cost** once F5 exists. Include in F5's phase.

## MVP Recommendation

### Phase 1 -- Schema + Classification UI (foundation)

1. F2: Add `artifactType` column to Template + extend classify endpoint
2. F1: Add artifact type selector to classify UI (conditional on touch_4)
3. F3: Update classification labels to show artifact type

**Rationale:** Enables users to classify existing Touch 4 examples with artifact types. No inference changes yet.

### Phase 2 -- Deck Structure Engine + Settings UI (intelligence)

4. F5: Modify `DeckStructure` unique constraint, extend inference engine with artifact type filter
5. F8: Extend cron to iterate artifact types for touch_4
6. F7: Extend chat endpoint to pass artifact type
7. F4: Add tabbed view to Touch 4 Settings page
8. F6: Confidence displays per artifact type (falls out naturally)

**Rationale:** Once examples are classified with artifact types, the inference engine can produce meaningful per-artifact structures.

### Defer to v1.7+

- F9: Template list artifact type filter (nice to have, not essential)
- Cross-artifact structural comparison
- AI-suggested artifact type inference

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Rationale |
|---------|------------|---------------------|----------|-----------|
| F2: Schema + endpoint | HIGH | LOW | P1 | Foundation. Everything depends on this. |
| F1: Classify UI | HIGH | LOW | P1 | Users need UI to set artifact types. |
| F3: Label display | MEDIUM | LOW | P1 | Visibility. Low cost to include with F1+F2. |
| F5: Inference engine | HIGH | MEDIUM | P1 | Core intelligence. Unlocks deck structures. |
| F4: Settings tabbed view | HIGH | MEDIUM | P1 | Primary user-facing value of the milestone. |
| F7: Per-artifact chat | MEDIUM | LOW | P1 | Near-zero cost once F5 ships. |
| F8: Cron per artifact | MEDIUM | LOW | P1 | Near-zero cost once F5 ships. |
| F6: Per-artifact confidence | LOW | LOW | P1 | Falls out naturally from F5. |
| F9: Template list filter | LOW | LOW | P2 | Nice to have. Can ship later. |

**Priority key:**
- P1: Must have for v1.6 -- core milestone features
- P2: Should have, defer if time-constrained

## Existing Infrastructure Leveraged

| v1.5 Component | How v1.6 Uses It | Changes Needed |
|----------------|------------------|----------------|
| `Template.contentClassification` | Continues to distinguish template/example | No change |
| `Template.touchTypes` (JSON) | Continues to bind examples to touch types | No change |
| Popover classify UI | Extended with artifact type selector | Conditional third section |
| `DeckStructure` model | Extended with `artifactType` column | New column + new unique constraint |
| `inferDeckStructure()` | Extended with `artifactType` filter param | Query filter + data hash change |
| `calculateConfidence()` | Called with per-artifact example counts | No change to function |
| Streaming chat refinement | Scoped per `DeckStructure` row (already works) | Endpoint passes artifact type |
| Auto-infer cron | Extended to iterate artifact types for touch_4 | Loop change + hash change |
| Settings sidebar nav | No change needed (tabs inside Touch 4 page) | Touch 4 page restructured internally |
| `classifyTemplate` API client | Extended with `artifactType` param | One param addition |
| `getClassificationLabel()` | Extended with optional `artifactType` param | String formatting |

## Sources

- Existing codebase: `schema.prisma`, `classification-panel.tsx`, `template-utils.ts`, `infer-deck-structure.ts`, `deck-structure-schema.ts`, `auto-infer-cron.ts`, `touch-type-detail-view.tsx`, `[touchType]/page.tsx`, `api-client.ts`, `template-actions.ts`, `mastra/index.ts` (HIGH confidence, read directly)
- PROJECT.md milestone definition: Touch 4 artifact types and per-artifact deck structures (HIGH confidence, read directly)
- v1.5 REQUIREMENTS.md: all deck intelligence features shipped (HIGH confidence, read directly)
- PostgreSQL unique index NULL handling: NULLs are treated as distinct values in unique indexes (HIGH confidence, well-documented PostgreSQL behavior)

---
*Feature research for: Lumenalta v1.6 Touch 4 Artifact Intelligence*
*Researched: 2026-03-07*
