# Architecture Research

**Domain:** Touch 4 Artifact Type Sub-Classification and Per-Artifact Deck Structures
**Researched:** 2026-03-07
**Confidence:** HIGH

## System Overview

```
+----------------------------------------------------------------------+
|                        apps/web (Next.js 15)                          |
|                                                                       |
|  +-------------+  +--------------+  +------------------------------+ |
|  |TemplateCard |  | Settings     |  | deck-structure-actions.ts    | |
|  | Classify UI |  | Layout +     |  | template-actions.ts          | |
|  | (Dialog)    |  | Sub-Nav      |  | api-client.ts                | |
|  +------+------+  +------+-------+  +--------------+---------------+ |
|         |                |                          |                 |
|         |    +-----------+-----------+              |                 |
|         |    | TouchTypeDetailView   |              |                 |
|         |    | SectionFlow + ChatBar |              |                 |
|         |    | ConfidenceBadge       |              |                 |
|         |    +-----------------------+              |                 |
+---------|-------------------------------------------+-----------------|
|                    HTTP (Authorization: Bearer)                       |
+---------|-------------------------------------------+-----------------|
|                       apps/agent (Mastra Hono)                        |
|                                                                       |
|  +--------------------+  +---------------------+  +----------------+ |
|  | POST /templates/   |  | GET/POST            |  | auto-infer     | |
|  |   :id/classify     |  | /deck-structures/   |  | cron (10-min)  | |
|  |                    |  |   :touchType         |  |                | |
|  +--------+-----------+  |   :touchType/infer   |  +--------+------+ |
|           |              |   :touchType/chat     |           |        |
|           |              |   :touchType/:artType |  <-- NEW  |        |
|           |              +----------+------------+           |        |
|           |                         |                        |        |
|  +--------+-------------------------+------------------------+------+ |
|  |               deck-intelligence/                                 | |
|  |  infer-deck-structure.ts  chat-refinement.ts  auto-infer-cron.ts | |
|  |  deck-structure-schema.ts                                        | |
|  +-----------------------------+------------------------------------+ |
+--------------------------------+--------------------------------------+
|                       Prisma + Supabase PostgreSQL                     |
|  +----------+  +--------------+  +---------------+  +--------------+ |
|  | Template |  |DeckStructure |  |DeckChatMessage|  |SlideEmbedding| |
|  | +artType |  | +artType     |  |               |  |              | |
|  +----------+  +--------------+  +---------------+  +--------------+ |
+-----------------------------------------------------------------------+
```

## What Exists Today (Baseline)

### Current Classification Model

The `Template` model has two classification fields:

| Field | Type | Values | Purpose |
|-------|------|--------|---------|
| `contentClassification` | `String?` | `"template"` / `"example"` / `null` | Whether this is a reusable template or a real-world example |
| `touchTypes` | `String` | JSON array: `["touch_4"]` | Which GTM touch types this presentation belongs to |

Classification happens via:
1. **Manual:** User clicks "Classify" on a TemplateCard, selects template/example + touch types, calls `POST /templates/:id/classify`
2. **Auto:** `auto-classify-templates.ts` runs periodically, uses Gemini to infer classification for unclassified ingested templates

There is **no artifact type field** today. Touch 4 examples are just classified as `example` with `touchTypes: ["touch_4"]` -- no distinction between Proposal, Talk Track, and FAQ.

### Current Deck Structure Model

The `DeckStructure` model stores one structure per touch type:

| Field | Type | Purpose |
|-------|------|---------|
| `touchType` | `String @unique` | e.g., `"touch_4"` -- **one record per touch type** |
| `structureJson` | `String` | JSON: `{ sections: [...], sequenceRationale: "..." }` |
| `exampleCount` | `Int` | Number of classified examples used for inference |
| `confidence` | `Float` | 0-100 confidence score |
| `dataHash` | `String?` | SHA-256 for change detection |
| `chatContextJson` | `String?` | Accumulated chat refinement constraints |
| `lastChatAt` | `DateTime?` | Active session protection |

The unique constraint is on `touchType`. Today, Touch 4 has exactly one DeckStructure record that mixes all artifact types together.

### Current Inference Pipeline

`inferDeckStructure(touchType)`:
1. Queries all `Template` records where `contentClassification = "example"` and touchTypes JSON array includes the given touchType
2. Loads all `SlideEmbedding` + `SlideElement` data for those templates
3. Sends everything to Gemini structured output with `DECK_STRUCTURE_SCHEMA`
4. Upserts into `DeckStructure` keyed by `touchType`

### Current Settings UI Routing

```
/settings/deck-structures/          --> redirect to /touch-1
/settings/deck-structures/touch-1   --> TouchTypeDetailView(touchType="touch_1")
/settings/deck-structures/touch-2   --> TouchTypeDetailView(touchType="touch_2")
/settings/deck-structures/touch-3   --> TouchTypeDetailView(touchType="touch_3")
/settings/deck-structures/touch-4   --> TouchTypeDetailView(touchType="touch_4")
```

Layout has vertical left nav with Touch 1-4 sub-items under "Deck Structures".

## Integration Points for New Features

### Feature 1: Artifact Type Sub-Classification

**What changes:** Touch 4 examples need a third classification dimension -- `artifactType` -- beyond `contentClassification` and `touchTypes`.

#### Schema Change (Template model)

**NEW column on Template:**

```prisma
model Template {
  // ... existing fields ...
  artifactType   String?  // null | "proposal" | "talk_track" | "faq"
}
```

**Rationale for nullable String (not enum):**
- Only Touch 4 examples use this field. Touch 1-3 examples and all templates have `artifactType = null`.
- Prisma enums require migration if values change. A nullable String with application-level validation is consistent with how `contentClassification` is already stored.
- Forward-compatible if more artifact types are added later.

#### Shared Constants

**NEW in `packages/schemas/constants.ts`:**

```typescript
export const ARTIFACT_TYPES = [
  "proposal",
  "talk_track",
  "faq",
] as const;
```

#### Classification API Change

**MODIFY `POST /templates/:id/classify`:**

Current Zod schema:
```typescript
z.object({
  classification: z.enum(["template", "example"]),
  touchTypes: z.array(z.string()).optional(),
})
```

New Zod schema:
```typescript
z.object({
  classification: z.enum(["template", "example"]),
  touchTypes: z.array(z.string()).optional(),
  artifactType: z.enum(["proposal", "talk_track", "faq"]).nullable().optional(),
})
```

**Validation rule:** `artifactType` is only accepted when `classification === "example"` AND `touchTypes` includes `"touch_4"`. Otherwise reject with 400.

**Handler change:** Save `artifactType` to the Template record. If reclassifying away from Touch 4 example, clear `artifactType` to null.

#### Classification UI Change

**MODIFY `TemplateCard` classify Dialog:**

When `classifyType === "example"` AND `selectedTouches` includes `"touch_4"`, show a third section: "Artifact Type" with three radio buttons (Proposal / Talk Track / FAQ). Required when Touch 4 is selected.

#### Auto-Classification Change

**MODIFY `auto-classify-templates.ts`:**

Extend the Gemini classification schema to include `artifactType`:
```typescript
const CLASSIFICATION_SCHEMA = {
  // ... existing ...
  properties: {
    contentClassification: { /* existing */ },
    touchTypes: { /* existing */ },
    artifactType: {
      type: Type.STRING,
      enum: ["proposal", "talk_track", "faq"],
      description: "For Touch 4 examples only: the artifact type...",
    },
  },
  required: ["contentClassification", "touchTypes"],
  // artifactType intentionally NOT required -- LLM returns it only when relevant
};
```

#### Classification Label Change

**MODIFY `template-utils.ts` `getClassificationLabel()`:**

When `classification === "example"` and artifactType is set, display:
- `Example (Touch 4+, Proposal)`
- `Example (Touch 4+, Talk Track)`
- `Example (Touch 4+, FAQ)`

### Feature 2: Per-Artifact-Type Deck Structures

**What changes:** Instead of one DeckStructure for `touch_4`, there are three: one for Proposals, one for Talk Tracks, one for FAQs.

#### Schema Change (DeckStructure model)

**MODIFY `DeckStructure` unique constraint:**

Current:
```prisma
model DeckStructure {
  touchType  String  @unique
  // ...
}
```

New:
```prisma
model DeckStructure {
  touchType     String
  artifactType  String?  // null for touch_1-3, "proposal"/"talk_track"/"faq" for touch_4
  // ...

  @@unique([touchType, artifactType])
  @@index([touchType])
}
```

**Migration strategy:** The existing `touchType @unique` constraint must be dropped and replaced with `@@unique([touchType, artifactType])`. Existing Touch 1-3 records will have `artifactType = null` and remain unique. The existing Touch 4 record should be deleted (it was inferred from mixed data that is no longer valid).

**Critical note:** This is a forward-only migration per CLAUDE.md. The migration must:
1. Add nullable `artifactType` column
2. Drop the unique index on `touchType`
3. Add the composite unique index on `[touchType, artifactType]`
4. Delete the existing `touch_4` DeckStructure record (inferred from mixed data)

#### Inference Pipeline Change

**MODIFY `inferDeckStructure()`:**

Current signature: `inferDeckStructure(touchType: string, chatConstraints?: string)`

New signature: `inferDeckStructure(touchType: string, artifactType?: string, chatConstraints?: string)`

For touch_4, the function must:
1. Filter examples not just by touchType but also by `artifactType` on the Template model
2. Use the composite key `{ touchType, artifactType }` for upsert (Prisma `@@unique` enables `findUnique` on the pair)
3. Adjust the prompt to explain this is specifically a Proposal / Talk Track / FAQ structure

For touch_1-3, behavior is unchanged (artifactType is undefined/null).

**MODIFY `computeDataHash()`:**

Must accept artifactType parameter and include it in the hash computation so that changes to artifact type classification trigger re-inference.

#### Cron Job Change

**MODIFY `auto-infer-cron.ts`:**

Current loop: iterates over `DECK_TOUCH_TYPES` (touch_1 through touch_4).

New loop: for touch_1-3, iterate normally. For touch_4, iterate over each artifact type:

```typescript
const INFERENCE_KEYS: Array<{ touchType: string; artifactType?: string }> = [
  { touchType: "touch_1" },
  { touchType: "touch_2" },
  { touchType: "touch_3" },
  { touchType: "touch_4", artifactType: "proposal" },
  { touchType: "touch_4", artifactType: "talk_track" },
  { touchType: "touch_4", artifactType: "faq" },
];
```

#### Chat Refinement Change

**MODIFY `streamChatRefinement()`:**

Must accept `artifactType` parameter. Lookup uses composite key. Re-inference passes artifactType through.

#### API Route Changes

**MODIFY `GET /deck-structures`:**

Return 6 entries instead of 4 (touch_1, touch_2, touch_3, touch_4/proposal, touch_4/talk_track, touch_4/faq).

**MODIFY `GET /deck-structures/:touchType`:**

Accept optional `artifactType` query param: `GET /deck-structures/touch_4?artifactType=proposal`

Alternative approach: encode in the path: `GET /deck-structures/touch_4/proposal`. This is cleaner for routing.

**Recommended:** Use query parameter approach because it avoids ambiguity with existing `:touchType/infer` and `:touchType/chat` routes. Path segments like `/touch_4/proposal` could collide with `/touch_4/infer`.

New/modified routes:
```
GET  /deck-structures                                   (returns 6 entries)
GET  /deck-structures/:touchType?artifactType=X         (touch_1-3: no param, touch_4: required)
POST /deck-structures/:touchType/infer?artifactType=X   (touch_4: required)
POST /deck-structures/:touchType/chat?artifactType=X    (touch_4: required)
```

#### Web API Client Changes

**MODIFY `api-client.ts`:**

```typescript
export interface DeckStructureSummary {
  // ... existing fields ...
  artifactType: string | null;  // NEW
}

export interface DeckStructureDetail {
  // ... existing fields ...
  artifactType: string | null;  // NEW
}

export async function getDeckStructure(
  touchType: string,
  artifactType?: string,  // NEW
): Promise<DeckStructureDetail> { ... }

export async function triggerDeckInference(
  touchType: string,
  artifactType?: string,  // NEW
): Promise<...> { ... }
```

#### Settings UI Routing Change

**MODIFY settings layout and routing:**

Current Touch 4 sub-nav item is a single link. Replace with three sub-items:

```
/settings/deck-structures/touch-4/proposal    --> TouchTypeDetailView(touch_4, proposal)
/settings/deck-structures/touch-4/talk-track  --> TouchTypeDetailView(touch_4, talk_track)
/settings/deck-structures/touch-4/faq         --> TouchTypeDetailView(touch_4, faq)
```

Layout change: the left nav expands Touch 4 into three sub-sub-items:

```
Deck Structures
  Touch 1
  Touch 2
  Touch 3
  Touch 4
    Proposal
    Talk Track
    FAQ
```

**File structure:**
```
app/(authenticated)/settings/deck-structures/
  page.tsx                          (redirect to touch-1)
  [touchType]/
    page.tsx                        (touch_1-3 render, touch-4 redirects to proposal)
    [artifactType]/
      page.tsx                      (touch_4 artifact type pages only)
```

The `[touchType]/page.tsx` already validates slugs. For `touch-4`, add a redirect to `touch-4/proposal`. The `[artifactType]/page.tsx` validates `proposal`, `talk-track`, `faq` slugs and renders `TouchTypeDetailView` with both params.

## Component Responsibilities

| Component | Responsibility | Change Required |
|-----------|----------------|-----------------|
| `Template` (Prisma) | Stores presentation metadata + classification | **ADD** `artifactType` column |
| `DeckStructure` (Prisma) | Stores AI-inferred deck structures | **MODIFY** unique constraint to composite, **ADD** `artifactType` column |
| `TemplateCard` classify Dialog | User classification UI | **ADD** artifact type selector for T4 |
| `template-utils.ts` | Classification labels and status | **MODIFY** label generation for artifact types |
| `api-client.ts` | Typed fetch wrapper + interfaces | **ADD** artifactType to types and function signatures |
| `infer-deck-structure.ts` | AI inference engine | **ADD** artifactType filtering and composite key upsert |
| `computeDataHash()` | Change detection hash | **ADD** artifactType to hash input |
| `auto-infer-cron.ts` | Background re-inference | **EXPAND** loop to include artifact types for touch_4 |
| `chat-refinement.ts` | Streaming chat for deck refinement | **ADD** artifactType parameter passthrough |
| `auto-classify-templates.ts` | Auto-classification of new templates | **ADD** artifactType to LLM schema |
| `POST /templates/:id/classify` | Classification API | **ADD** artifactType field + validation |
| `GET /deck-structures` | List all structures | **EXPAND** to 6 entries |
| `GET /deck-structures/:touchType` | Single structure detail | **ADD** artifactType query param |
| `POST /deck-structures/:touchType/infer` | Manual inference trigger | **ADD** artifactType query param |
| `POST /deck-structures/:touchType/chat` | Chat refinement | **ADD** artifactType query param |
| Settings layout | Left nav with touch type items | **ADD** Touch 4 sub-items |
| `TouchTypeDetailView` | Deck structure display + chat | **ADD** artifactType prop |
| `deck-structure-actions.ts` | Server actions for deck structures | **ADD** artifactType params |
| `packages/schemas/constants.ts` | Shared constants | **ADD** `ARTIFACT_TYPES` |

## Data Flow

### Classification Flow (Modified)

```
User clicks "Classify" on TemplateCard
    |
    v
Dialog opens: select Template/Example
    |
    v  (if Example)
Select touch types (checkboxes)
    |
    v  (if touch_4 selected)
Select artifact type (radio: Proposal / Talk Track / FAQ)
    |
    v
POST /templates/:id/classify
  body: { classification: "example", touchTypes: ["touch_4"], artifactType: "proposal" }
    |
    v
Agent handler:
  - Validates: artifactType required when touch_4 example, rejected otherwise
  - Updates Template record: contentClassification, touchTypes, artifactType
    |
    v
Cron detects data hash change --> re-infers touch_4 + proposal structure
```

### Inference Flow (Modified)

```
inferDeckStructure("touch_4", "proposal", chatConstraints?)
    |
    v
Query Template WHERE contentClassification="example"
  AND touchTypes contains "touch_4"
  AND artifactType="proposal"                           <-- NEW filter
    |
    v
Load SlideEmbeddings for matched templates
    |
    v
Build prompt (mentions this is specifically for Proposal decks)  <-- NEW context
    |
    v
Gemini structured output --> DeckStructureOutput
    |
    v
Upsert DeckStructure WHERE touchType="touch_4" AND artifactType="proposal"
```

### Settings View Flow (Modified)

```
User navigates to /settings/deck-structures/touch-4/proposal
    |
    v
[artifactType]/page.tsx resolves params: touchType="touch_4", artifactType="proposal"
    |
    v
TouchTypeDetailView(touchType="touch_4", artifactType="proposal", label="Touch 4 - Proposal")
    |
    v
getDeckStructureAction("touch_4", "proposal")
    |
    v
GET /deck-structures/touch_4?artifactType=proposal
    |
    v
Agent queries DeckStructure WHERE touchType="touch_4" AND artifactType="proposal"
    |
    v
Returns DeckStructureDetail with artifact-specific structure
```

## Architectural Patterns

### Pattern 1: Composite Key Extension

**What:** Extending a single-column unique key to a composite key to support sub-classification without breaking existing records.
**When to use:** When a previously flat dimension needs sub-categorization for a subset of records.
**Trade-offs:** Existing code that queries by touchType alone must be audited. Null artifactType for touch_1-3 works naturally with the composite unique constraint (PostgreSQL treats NULL as distinct in unique constraints, so `(touch_1, NULL)` and `(touch_2, NULL)` are both allowed).

### Pattern 2: Conditional UI Sections

**What:** Showing additional form fields only when specific conditions are met (artifact type selector appears only when Touch 4 is selected as an example).
**When to use:** When classification dimensions are hierarchical or context-dependent.
**Trade-offs:** More conditional rendering logic, but avoids confusing users with irrelevant options. Already used in the existing classify Dialog (touch types only show for examples).

### Pattern 3: Nested Dynamic Routes for Sub-Types

**What:** Using nested dynamic route segments (`/deck-structures/[touchType]/[artifactType]`) for Touch 4 artifact type pages.
**When to use:** When sub-items are first-class navigation targets with their own pages.
**Trade-offs:** More route files, but cleaner URLs and better navigation state. Consistent with the existing pattern of `/deck-structures/[touchType]`. The `[touchType]/page.tsx` for touch-4 redirects to the first artifact type.

### Pattern 4: Query Params for API Sub-Filtering

**What:** Using `?artifactType=proposal` query parameters on existing API routes rather than new path segments.
**When to use:** When adding a sub-filter to an existing API route that already uses path params.
**Trade-offs:** Avoids route collision (e.g., `/touch_4/proposal` vs `/touch_4/infer`). Slightly less RESTful but more practical with Hono's routing.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Separate Models for Artifact Type Structures

**What people do:** Create a `Touch4DeckStructure` model separate from `DeckStructure`.
**Why it's wrong:** Duplicates all the same fields, chat messages, cron logic, and API routes. The only difference is the additional dimension.
**Do this instead:** Add `artifactType` to the existing `DeckStructure` model with a composite unique constraint.

### Anti-Pattern 2: JSON Blob for Artifact Type in Template

**What people do:** Store artifact type inside the existing `touchTypes` JSON array (e.g., `["touch_4:proposal"]`).
**Why it's wrong:** Breaks existing JSON parsing logic everywhere, makes queries impossible (cannot filter by artifact type with Prisma `where` on JSON contents), and conflates two separate concepts.
**Do this instead:** Add a separate `artifactType` column on Template. Clean separation of concerns.

### Anti-Pattern 3: Overloading Touch Type Values

**What people do:** Create new touch types like `"touch_4_proposal"`, `"touch_4_talk_track"`, `"touch_4_faq"`.
**Why it's wrong:** Breaks the `TOUCH_TYPES` constant, confuses the classification UI, and does not model the real domain (these are sub-types of Touch 4, not separate touch types). Every piece of code that iterates TOUCH_TYPES would need to handle these fake touch types.
**Do this instead:** Artifact type is a separate dimension that only applies to Touch 4.

### Anti-Pattern 4: Modifying Settings Routes Without Redirect Guards

**What people do:** Add new nested routes but forget that `/settings/deck-structures/touch-4` must now redirect to `/settings/deck-structures/touch-4/proposal` instead of rendering a combined view.
**Why it's wrong:** Users get a broken page or a mixed-artifact view that the new feature is specifically designed to eliminate.
**Do this instead:** The `[touchType]/page.tsx` detects `touch-4` and redirects to `touch-4/proposal`. Touch 1-3 pages remain as they are.

### Anti-Pattern 5: Path-Based Artifact Type in API Routes

**What people do:** Add `/deck-structures/:touchType/:artifactType` as API paths.
**Why it's wrong:** Collides with existing sub-routes like `/deck-structures/:touchType/infer` and `/deck-structures/:touchType/chat`. Hono would need to disambiguate "proposal" from "infer" in the same path segment.
**Do this instead:** Use query parameters: `/deck-structures/touch_4?artifactType=proposal`.

## Suggested Build Order

The build order is driven by data model dependencies:

### Phase 1: Schema + Constants + Migration

1. Add `ARTIFACT_TYPES` to `packages/schemas/constants.ts`
2. Add `artifactType String?` to `Template` model in schema.prisma
3. Add `artifactType String?` to `DeckStructure` model
4. Modify `DeckStructure` unique constraint from `@unique` on `touchType` to `@@unique([touchType, artifactType])`
5. Create forward-only Prisma migration (use `--create-only` to inspect SQL)
6. In migration SQL: DELETE existing `touch_4` DeckStructure record and its DeckChatMessages (stale mixed data)

**Why first:** Everything depends on the data model. Migration must land before any code changes.

### Phase 2: Agent Backend (Classify + Infer)

1. Modify `POST /templates/:id/classify` to accept and validate `artifactType`
2. Modify `auto-classify-templates.ts` to include artifactType in LLM schema
3. Modify `inferDeckStructure()` to accept and filter by artifactType, use composite key for upsert
4. Modify `computeDataHash()` to accept and include artifactType
5. Modify `auto-infer-cron.ts` to iterate over artifact types for touch_4
6. Modify `streamChatRefinement()` to accept and pass through artifactType

**Why second:** Backend must be ready before frontend can call the new APIs.

### Phase 3: Agent API Routes

1. Modify `GET /deck-structures` to return 6 entries (include artifactType in response)
2. Modify `GET /deck-structures/:touchType` to read `artifactType` query param
3. Modify `POST /deck-structures/:touchType/infer` to read `artifactType` query param
4. Modify `POST /deck-structures/:touchType/chat` to read `artifactType` query param

**Why third:** Routes wire up the backend changes to HTTP endpoints the frontend needs.

### Phase 4: Web Frontend

1. Modify `packages/schemas/constants.ts` to export `ARTIFACT_TYPES` (if not done in Phase 1)
2. Modify `api-client.ts` types and functions to include artifactType
3. Modify `template-utils.ts` for artifact type labels
4. Modify `TemplateCard` classify Dialog to add artifact type selector (radio buttons when touch_4 + example)
5. Modify Settings layout left nav: expand Touch 4 into Proposal / Talk Track / FAQ sub-items
6. Modify `[touchType]/page.tsx` to redirect `touch-4` to `touch-4/proposal`
7. Add `[touchType]/[artifactType]/page.tsx` for Touch 4 artifact pages
8. Modify `deck-structure-actions.ts` to pass artifactType
9. Pass artifactType through `TouchTypeDetailView` and `ChatBar`

**Why last:** Frontend depends on all backend changes being in place.

## Sources

- Prisma schema: `apps/agent/prisma/schema.prisma` (read directly, 406 lines)
- Deck structure inference: `apps/agent/src/deck-intelligence/infer-deck-structure.ts` (read directly, 408 lines)
- Deck structure schema: `apps/agent/src/deck-intelligence/deck-structure-schema.ts` (read directly, 138 lines)
- Chat refinement: `apps/agent/src/deck-intelligence/chat-refinement.ts` (read directly, 338 lines)
- Auto-infer cron: `apps/agent/src/deck-intelligence/auto-infer-cron.ts` (read directly, 97 lines)
- Auto-classify templates: `apps/agent/src/ingestion/auto-classify-templates.ts` (read directly via grep, classification schema + handler)
- Classification API route: `apps/agent/src/mastra/index.ts` line 1378-1416 (read directly)
- Deck structure API routes: `apps/agent/src/mastra/index.ts` lines 2496-2670 (read directly)
- Settings layout: `apps/web/src/app/(authenticated)/settings/layout.tsx` (read directly, 92 lines)
- Touch type detail view: `apps/web/src/components/settings/touch-type-detail-view.tsx` (read directly, 193 lines)
- Touch type page: `apps/web/src/app/(authenticated)/settings/deck-structures/[touchType]/page.tsx` (read directly, 45 lines)
- Deck structure view: `apps/web/src/components/settings/deck-structure-view.tsx` (read directly, 131 lines)
- Template card: `apps/web/src/components/template-card.tsx` (read directly, 517 lines)
- API client types: `apps/web/src/lib/api-client.ts` (read directly, DeckStructure interfaces at lines 905-950)
- Template utils: `apps/web/src/lib/template-utils.ts` (read directly, 128 lines)
- Deck structure actions: `apps/web/src/lib/actions/deck-structure-actions.ts` (read directly, 30 lines)
- Shared constants: `packages/schemas/constants.ts` (read directly, 203 lines)
- Project context: `.planning/PROJECT.md` (read directly, 251 lines)

---
*Architecture research for: Touch 4 Artifact Type Sub-Classification and Per-Artifact Deck Structures*
*Researched: 2026-03-07*
