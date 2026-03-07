# Stack Research — v1.6 Touch 4 Artifact Intelligence

**Project:** AtlusAI Agentic Sales Orchestration
**Researched:** 2026-03-07
**Confidence:** HIGH (all features use existing installed packages)

## Scope

This research covers ONLY stack additions/changes for v1.6 (Touch 4 Artifact Type Sub-Classification & Per-Artifact Deck Structures). The existing validated stack is NOT re-researched.

**Focus areas:**
1. Artifact type sub-classification for Touch 4 Examples (Proposal / Talk Track / FAQ)
2. Per-artifact-type deck structures in Settings
3. Schema evolution strategy for existing models
4. UI changes to classify popover and Settings deck structure view

---

## Executive Summary

v1.6 requires **zero new package dependencies**. Every capability needed is already present in the codebase. The work is:

- **2 Prisma schema migrations** (add `artifactType` column to `Template` and `DeckStructure`, change unique constraint on `DeckStructure`)
- **1 shared constant addition** (`ARTIFACT_TYPES` in `@lumenalta/schemas`)
- **Logic changes** to deck inference engine, chat refinement, cron, and API routes
- **UI changes** to classify popover (add artifact type selector) and Settings page (add sub-tabs for Touch 4)

No new packages. No new infrastructure. No new API providers.

---

## Recommended Stack (v1.6) -- No New Packages

### Core Technologies (unchanged)

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| Next.js | 15.5.x | Web app (Server Actions, App Router) | Keep as-is |
| Mastra AI | 1.8.x | Agent orchestration, Hono server | Keep as-is |
| Prisma | 6.19.x | ORM, migrations | Keep as-is (DO NOT upgrade to 7.x per constraint) |
| @google/genai | 1.43.x | Gemini structured output for deck inference | Keep as-is |
| Zod | 4.3.x | Schema validation, shared types | Keep as-is |
| shadcn/ui + Radix | Various | UI components (Dialog, Checkbox, Tabs, Accordion) | Keep as-is |

### Supporting Libraries (unchanged)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| @lumenalta/schemas | workspace | Shared constants (TOUCH_TYPES, etc.) | Extend with ARTIFACT_TYPES |
| sonner | 2.0.x | Toast notifications | Keep as-is |
| lucide-react | 0.576.x | Icons | Keep as-is |
| date-fns | 4.1.x | Date formatting | Keep as-is |
| @radix-ui/react-tabs | 1.1.x | Tabs component (already installed) | Reuse for Touch 4 artifact sub-tabs |

---

## What Changes (Schema & Logic Only)

### 1. Shared Constants: @lumenalta/schemas

**Add to `packages/schemas/constants.ts`:**

```typescript
export const ARTIFACT_TYPES = [
  "proposal",
  "talk_track",
  "faq",
] as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[number];
```

**Why here:** Same pattern as `TOUCH_TYPES`, `CONTENT_TYPES`, `SOLUTION_PILLARS` -- single source of truth consumed by both web (`template-card.tsx`, `deck-structure-view.tsx`) and agent (`infer-deck-structure.ts`, `auto-infer-cron.ts`).

**Why these three values:**
- **proposal** -- The slide deck itself (the "deck structure" in the traditional sense)
- **talk_track** -- A Google Doc with speaker guidance per slide/section
- **faq** -- A Google Doc with buyer objections and responses

These map directly to Touch 4's three output artifacts defined in PROJECT.md: "Google Slides deck", "talk track (Google Doc)", and "buyer FAQ with objection handling (Google Doc)".

### 2. Prisma Schema: Template Model

**Current:** `contentClassification` is `"template" | "example" | null`. No artifact type.

**Add:** Nullable `artifactType` column.

```prisma
model Template {
  // ... existing fields ...
  contentClassification   String?   // null | "template" | "example"
  artifactType            String?   // null | "proposal" | "talk_track" | "faq"
  // ...
}
```

**Why a separate column (not JSON):** The field is a single enum-like value used in WHERE clauses for deck inference grouping. A column is indexable, queryable via Prisma `findMany({ where: { artifactType: "proposal" } })`, and consistent with existing `contentClassification` pattern.

**Constraint:** `artifactType` is only meaningful when `contentClassification === "example"` AND `touch_4` is in the `touchTypes` JSON array. Application-level validation enforces this -- no DB-level constraint needed (consistent with how `touchTypes` is validated today).

**Migration:**

```sql
ALTER TABLE "Template" ADD COLUMN "artifactType" TEXT;
CREATE INDEX "Template_artifactType_idx" ON "Template"("artifactType");
```

### 3. Prisma Schema: DeckStructure Model

**Current:** `touchType` has `@unique` -- one structure per touch type. Five possible rows: `touch_1`, `touch_2`, `touch_3`, `touch_4`, `pre_call`.

**Needed:** Allow multiple structures for `touch_4` (one per artifact type) while keeping one structure for all other touch types.

```prisma
model DeckStructure {
  // ... existing fields ...
  touchType       String    // "touch_1" | ... | "touch_4" | "pre_call"
  artifactType    String?   // null for touch_1/2/3/pre_call; "proposal"|"talk_track"|"faq" for touch_4
  // ...

  @@unique([touchType, artifactType])  // replaces @unique on touchType
}
```

**Why compound unique:** Touch 1-3 and pre_call have `artifactType = null` (one structure each, same as today). Touch 4 gets up to 3 structures: `(touch_4, proposal)`, `(touch_4, talk_track)`, `(touch_4, faq)`. Backward-compatible -- existing rows have `artifactType = null`.

**PostgreSQL NULL uniqueness:** PostgreSQL treats NULLs as distinct in unique indexes by default. So `(touch_1, NULL)` and `(touch_2, NULL)` are both allowed. This is the desired behavior. However, Prisma 6.19.x may generate `NULLS NOT DISTINCT` in certain cases -- use `--create-only` to inspect the generated SQL before applying.

**Migration (use `--create-only` first):**

```sql
ALTER TABLE "DeckStructure" ADD COLUMN "artifactType" TEXT;
ALTER TABLE "DeckStructure" DROP CONSTRAINT "DeckStructure_touchType_key";
CREATE UNIQUE INDEX "DeckStructure_touchType_artifactType_key" ON "DeckStructure"("touchType", "artifactType");
```

**Existing data handling:** The existing `touch_4` row (if any) has `artifactType = NULL`. After migration, when the first Touch 4 example gets classified with an artifact type, new inference will create `(touch_4, proposal)` etc. The old `(touch_4, NULL)` row becomes orphaned -- clean it up in the migration or let the cron handle it.

### 4. DeckChatMessage Model

**No changes needed.** `DeckChatMessage` references `deckStructureId` (FK to `DeckStructure.id`). Since each artifact-specific structure gets its own `DeckStructure` row with its own ID, chat messages are naturally scoped to the correct artifact type.

### 5. Deck Inference Engine

**File:** `apps/agent/src/deck-intelligence/infer-deck-structure.ts`

**Current:** `inferDeckStructure(touchType, chatConstraints?)` queries templates by `contentClassification: "example"` filtered by touch type, then upserts by `touchType`.

**Changes needed:**
- Add optional `artifactType` parameter: `inferDeckStructure(touchType, chatConstraints?, artifactType?)`
- When `touchType === "touch_4"` AND `artifactType` is provided:
  - Filter examples by BOTH touch type AND `artifactType`
  - Upsert DeckStructure by compound key `{ touchType, artifactType }`
  - Include artifact type context in the LLM prompt (e.g., "You are analyzing talk track documents..." vs "You are analyzing proposal slide decks...")
- When `touchType !== "touch_4"`: no change (artifactType stays null)

**`computeDataHash` change:** Include `artifactType` in the hash input for touch_4 examples.

### 6. Chat Refinement

**File:** `apps/agent/src/deck-intelligence/chat-refinement.ts`

**Current:** `streamChatRefinement(touchType, userMessage, onChunk)`

**Change:** Add optional `artifactType` parameter. When present, find/create DeckStructure by compound key `{ touchType, artifactType }`. Pass through to `inferDeckStructure`.

### 7. Auto-Infer Cron

**File:** `apps/agent/src/deck-intelligence/auto-infer-cron.ts`

**Current:** Iterates over touch types, one inference per type.

**Change:** For `touch_4`, iterate over `ARTIFACT_TYPES` and run one inference per artifact type. For other touch types, keep existing behavior (one inference, artifactType = null).

### 8. API Routes

**Current routes:** `GET /deck-structures`, `GET /deck-structures/:touchType`, `POST /deck-structures/:touchType/infer`, `POST /deck-structures/:touchType/chat`.

**Change:** Add optional `artifactType` query parameter:
- `GET /deck-structures/touch_4?artifactType=proposal`
- `POST /deck-structures/touch_4/infer?artifactType=proposal`
- `POST /deck-structures/touch_4/chat?artifactType=proposal`

**Why query param (not path segment):** Backward-compatible. Existing callers for `touch_1`/`touch_2`/`touch_3` don't send `artifactType` and continue to work unchanged. No route pattern changes needed.

For the list endpoint, `GET /deck-structures` returns all structures. Touch 4 now returns up to 3 rows instead of 1. The response already includes `touchType` -- add `artifactType` to the response shape.

### 9. Classify Popover UI

**File:** `apps/web/src/components/template-card.tsx`

**Current:** Classify popover has Template/Example button toggle + touch type checkboxes (when Example selected).

**Change:** When `classifyType === "example"` AND `selectedTouches` includes only `touch_4`, show artifact type selector. Use the **same button-toggle pattern** already established for Template/Example:

```
[Proposal] [Talk Track] [FAQ]
```

Three styled buttons with conditional highlighting, exactly like the existing Template/Example toggle at lines 277-299 of `template-card.tsx`. No new UI library needed.

**UX consideration:** Artifact type selector should ONLY appear when:
1. Classification is "Example" (not "Template")
2. Touch 4 is the ONLY selected touch type

If multiple touch types are selected (e.g., Touch 3 + Touch 4), artifact type doesn't apply because the presentation spans multiple contexts.

### 10. Settings Deck Structure View

**File:** `apps/web/src/components/settings/deck-structure-view.tsx`

**Current:** Renders one `TouchTypeAccordion` per deck touch type. Touch 4 gets a single accordion.

**Change:** For Touch 4, render 3 sub-tabs within the accordion using existing `@radix-ui/react-tabs` (already installed, already used for Settings sub-navigation):

```
Touch 4+  [Proposal] [Talk Track] [FAQ]
  |-- (tab content: deck structure for selected artifact type)
```

Each tab loads its own `DeckStructureDetail` from the API with `?artifactType=proposal|talk_track|faq`.

The `TouchTypeAccordion` component needs a prop to indicate whether it should render sub-tabs. For `touch_4`, pass the artifact types; for others, render directly as today.

---

## Schema Migrations Required

All via `prisma migrate dev --name <name>` (never `db push` per CLAUDE.md rules):

**Migration 1: Add artifactType to Template**
```sql
ALTER TABLE "Template" ADD COLUMN "artifactType" TEXT;
CREATE INDEX "Template_artifactType_idx" ON "Template"("artifactType");
```

**Migration 2: Add artifactType to DeckStructure + compound unique**
```sql
ALTER TABLE "DeckStructure" ADD COLUMN "artifactType" TEXT;
ALTER TABLE "DeckStructure" DROP CONSTRAINT "DeckStructure_touchType_key";
CREATE UNIQUE INDEX "DeckStructure_touchType_artifactType_key" ON "DeckStructure"("touchType", "artifactType");
```

**Use `--create-only` for Migration 2** to verify Prisma doesn't generate `NULLS NOT DISTINCT`.

---

## Alternatives Considered

| Recommended | Alternative | Why Not Alternative |
|-------------|-------------|---------------------|
| Nullable `artifactType` column on Template | JSON field with nested `{ classification, artifactType }` | Harder to query and index; Prisma `findMany` WHERE on JSON fields requires raw SQL |
| Compound unique `(touchType, artifactType)` on DeckStructure | Separate `ArtifactDeckStructure` model | Over-engineered; compound key is the standard pattern; avoids duplicating chat, cron, inference logic |
| Query param `?artifactType=X` for API | Path segment `/touch_4/proposal` | Query param is backward-compatible; existing clients don't break; cleaner for optional parameter |
| Button group for artifact type selection | `@radix-ui/react-radio-group` (new shadcn component) | Adds unnecessary component when button toggle pattern is already proven at lines 277-299 |
| Tabs for Touch 4 sub-structures in Settings | Nested accordions | Tabs are visually cleaner for exactly 3 items; nested accordions create excessive depth |
| Single `touch_4` row with JSON containing all 3 structures | Separate rows per artifact type | Single row forces parsing/merging logic; separate rows allow independent inference, confidence scoring, and chat history per artifact type |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| New UI component library | shadcn/ui + Radix already has Tabs, Dialog, Checkbox, Button | Existing components |
| New LLM model or provider | Gemini 2.0 Flash handles deck inference identically | Same @google/genai + structured output |
| New database table for artifact types | One nullable column on Template + compound key on DeckStructure is sufficient | Schema evolution |
| `@radix-ui/react-radio-group` | Three buttons with conditional styling (existing pattern) achieves the same result | Button group toggle |
| Enum type in PostgreSQL | Prisma doesn't support native PG enums well; String column + application validation is the established pattern | String column |
| Form library for classify popover | Classify popover uses `useState` (not react-hook-form); keep consistent | useState pattern |

---

## Installation

```bash
# No new packages to install. Zero changes to package.json.

# Only actions: run migrations for new schema columns
cd apps/agent
pnpm exec prisma migrate dev --create-only --name add-artifact-type-to-template
# Inspect migration SQL, then:
pnpm exec prisma migrate dev --name add-artifact-type-to-template

pnpm exec prisma migrate dev --create-only --name add-artifact-type-to-deck-structure
# Inspect migration SQL (verify NULLS DISTINCT behavior), then:
pnpm exec prisma migrate dev --name add-artifact-type-to-deck-structure
```

---

## Integration Points with Existing Code

### Files to Modify

| File | Change |
|------|--------|
| `packages/schemas/constants.ts` | Add `ARTIFACT_TYPES` constant |
| `packages/schemas/index.ts` | Export `ARTIFACT_TYPES` |
| `apps/agent/prisma/schema.prisma` | Add `artifactType` to Template and DeckStructure |
| `apps/agent/src/deck-intelligence/infer-deck-structure.ts` | Add `artifactType` param, filter/upsert by compound key |
| `apps/agent/src/deck-intelligence/chat-refinement.ts` | Add `artifactType` param, pass through |
| `apps/agent/src/deck-intelligence/auto-infer-cron.ts` | Iterate artifact types for touch_4 |
| `apps/agent/src/mastra/index.ts` | Add `artifactType` query param to deck structure routes |
| `apps/web/src/components/template-card.tsx` | Add artifact type selector to classify popover |
| `apps/web/src/lib/template-utils.ts` | Update `getClassificationLabel` to include artifact type |
| `apps/web/src/lib/actions/template-actions.ts` | Pass `artifactType` to classify action |
| `apps/web/src/lib/api-client.ts` | Add `artifactType` to deck structure API calls |
| `apps/web/src/lib/actions/deck-structure-actions.ts` | Pass `artifactType` param |
| `apps/web/src/components/settings/deck-structure-view.tsx` | Render sub-tabs for touch_4 |
| `apps/web/src/components/settings/touch-type-accordion.tsx` | Accept artifact type prop, conditional sub-tab rendering |

### Files NOT Modified

| File | Why |
|------|-----|
| `deck-structure-schema.ts` | The GenAI schema for inference output stays the same -- sections, rationale, confidence |
| `slide-extractor.ts` | No changes to slide extraction |
| `ingest-template.ts` | No changes to ingestion pipeline |
| `classify-metadata.ts` | Artifact type is a human classification, not AI-inferred during ingestion |

---

## Version Compatibility

| Package | Version | Compatible | Notes |
|---------|---------|------------|-------|
| Prisma | 6.19.x | YES | `@@unique([touchType, artifactType])` with nullable column works in PG. Verify `NULLS DISTINCT` with `--create-only` |
| @google/genai | 1.43.x | YES | DECK_STRUCTURE_SCHEMA unchanged; only prompts change |
| @radix-ui/react-tabs | 1.1.x | YES | Already installed; reuse for Touch 4 artifact sub-tabs |
| PostgreSQL (Supabase) | 15.x | YES | `NULLS DISTINCT` is default behavior in PG 15 unique indexes |

---

## PostgreSQL NULL Uniqueness (Critical Detail)

PostgreSQL 15 introduced `NULLS NOT DISTINCT` as an option for unique constraints. **The default remains `NULLS DISTINCT`**, meaning two rows with `(touch_1, NULL)` and `(touch_2, NULL)` are considered distinct and both allowed.

**What we need:** `NULLS DISTINCT` (the default). This allows:
- `(touch_1, NULL)` -- one structure for Touch 1
- `(touch_2, NULL)` -- one structure for Touch 2
- `(touch_3, NULL)` -- one structure for Touch 3
- `(touch_4, "proposal")` -- proposal structure for Touch 4
- `(touch_4, "talk_track")` -- talk track structure for Touch 4
- `(touch_4, "faq")` -- FAQ structure for Touch 4
- `(pre_call, NULL)` -- one structure for Pre-Call

**Verification:** Use `--create-only` on the migration and inspect the generated SQL. If Prisma generates `NULLS NOT DISTINCT`, manually edit the migration SQL to remove it.

---

## Sources

### HIGH Confidence
- Existing codebase analysis -- `schema.prisma`, `infer-deck-structure.ts`, `chat-refinement.ts`, `auto-infer-cron.ts`, `template-card.tsx`, `deck-structure-view.tsx`, `constants.ts`, `template-utils.ts`
- PostgreSQL 15 documentation on [NULLS DISTINCT in unique indexes](https://www.postgresql.org/docs/15/sql-createindex.html)
- Prisma 6.x documentation on [compound unique constraints](https://www.prisma.io/docs/orm/prisma-schema/data-model/models#defining-a-unique-field)

---
*Stack research for: v1.6 Touch 4 Artifact Intelligence*
*Researched: 2026-03-07*
