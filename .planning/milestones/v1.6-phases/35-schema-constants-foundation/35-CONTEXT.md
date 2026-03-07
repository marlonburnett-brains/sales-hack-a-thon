# Phase 35: Schema & Constants Foundation - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Add the schema and shared constant changes required for Touch 4 artifact-type classification and per-artifact deck structures. This phase covers the new nullable `artifactType` fields, the shared artifact constant export, and cleanup of the existing generic Touch 4 deck structure row. It does not add inference logic, API behavior, or UI flows.

</domain>

<decisions>
## Implementation Decisions

### Artifact type enum
- Use a closed set of three stored values: `proposal`, `talk_track`, and `faq`
- Keep values in `snake_case` in code and the database
- Export artifact types from `@lumenalta/schemas` as shared values plus friendly labels for UI display
- Use the canonical order: Proposal, Talk Track, FAQ

### Template artifact type rules
- Only Touch 4 presentations classified as `example` may have a non-null `Template.artifactType`
- Templates may still relate to multiple touch types, but Examples are touch-specific and should not remain multi-touch
- If a record is not an Example, or is an Example without Touch 4 binding, `artifactType` must be `null`
- If a presentation changes away from Example classification, its `artifactType` must be cleared immediately

### DeckStructure identity rules
- Non-Touch-4 `DeckStructure` rows keep `artifactType = null`
- Touch 4 should no longer have a generic catch-all row; it should be represented by exactly three persisted rows, one each for Proposal, Talk Track, and FAQ
- Database uniqueness should be defined on `(touchType, artifactType)`
- The intended model remains one row per non-Touch-4 touch type even though those rows use `artifactType = null`

### Migration cleanup policy
- Delete the existing generic `touch_4` `DeckStructure` row during migration cleanup
- Do not seed new Touch 4 artifact-specific `DeckStructure` rows in this phase; downstream inference can create them when needed
- Leave all existing `Template.artifactType` values as `null` after the column is added; no backfill in this phase
- Make cleanup idempotent so migration succeeds whether or not the old generic Touch 4 row still exists

### Claude's Discretion
- Exact shared constant shape beyond the locked requirements, as long as raw values and labels are both exported
- Exact enforcement point for the new single-touch Example rule across schema validation, API validation, and UI guards
- Exact SQL strategy needed to preserve one non-Touch-4 row per touch type while using nullable `artifactType`

</decisions>

<specifics>
## Specific Ideas

- Examples are touch-specific; Templates can remain multi-touch
- Artifact type is a Touch 4-only concept, not a general classification dimension across all touch types
- Phase 35 should establish a clean data contract for downstream phases rather than trying to pre-populate inferred data

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/schemas/constants.ts`: Existing home of `TOUCH_TYPES`; natural place to add `ARTIFACT_TYPES` and shared display labels
- `packages/schemas/index.ts`: Barrel export point for making artifact constants available to both web and agent
- `apps/agent/prisma/schema.prisma`: Existing `Template` and `DeckStructure` models already hold the fields Phase 35 extends

### Established Patterns
- Shared domain constants live in `@lumenalta/schemas` and are imported across web and agent
- Prisma schema changes are forward-only migrations; project rules forbid reset and `prisma db push`
- Current deck intelligence logic keys persisted structures only by `touchType`, so this phase's schema identity decisions directly shape Phase 36 updates

### Integration Points
- `apps/agent/prisma/schema.prisma`: Add nullable `artifactType` columns and replace single-touch uniqueness on `DeckStructure`
- `apps/agent/src/deck-intelligence/infer-deck-structure.ts`: Currently filters and upserts by `touchType` only; downstream work will thread artifact type through this path
- `apps/agent/src/mastra/index.ts`: Existing deck structure routes return one record per touch type today; downstream routes will need the new key shape
- `apps/web/src/components/template-card.tsx` and `apps/web/src/components/slide-viewer/classification-panel.tsx`: Current Example classification UI allows multi-touch binding, which conflicts with the newly locked touch-specific Example rule
- `apps/web/src/lib/api-client.ts`: Current deck structure types and fetch methods assume touch-only identity, so they will consume the new schema contract in later phases

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 35-schema-constants-foundation*
*Context gathered: 2026-03-07*
