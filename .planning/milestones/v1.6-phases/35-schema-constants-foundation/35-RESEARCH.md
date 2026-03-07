# Phase 35: Schema & Constants Foundation - Research

**Researched:** 2026-03-07
**Domain:** Prisma/PostgreSQL schema evolution and shared domain constants
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCHM-01 | Prisma migration adds nullable `artifactType` column to Template model | Add nullable `String?` field, no backfill, and keep enforcement mostly application-side because current touch bindings are JSON strings |
| SCHM-02 | Prisma migration adds nullable `artifactType` column to DeckStructure model with composite unique constraint `(touchType, artifactType)` replacing single-column `touchType @unique` | Use composite uniqueness in Prisma schema, inspect generated SQL with `--create-only`, and add raw SQL cleanup/partial uniqueness enforcement for non-Touch-4 null rows |
| SCHM-03 | Shared `ARTIFACT_TYPES` constant (`proposal`, `talk_track`, `faq`) defined in `@lumenalta/schemas` | Add constants and labels in `packages/schemas/constants.ts` and re-export from `packages/schemas/index.ts` |
</phase_requirements>

## Summary

Phase 35 should stay narrow: add nullable `artifactType` fields to `Template` and `DeckStructure`, publish shared artifact constants from `@lumenalta/schemas`, and clean up the old generic `touch_4` deck structure row. The repo already follows the right foundation patterns for this: string-backed domain fields in Prisma, shared constants in `packages/schemas/constants.ts`, and forward-only Prisma migrations using PostgreSQL/Supabase.

The main planning risk is **nullable uniqueness semantics**. In PostgreSQL, a plain unique constraint on `(touchType, artifactType)` does **not** prevent duplicate rows with the same `touchType` when `artifactType` is `NULL`, because `NULL` values are distinct by default. That means the locked intent of “one non-Touch-4 row per touch type” is **not fully enforced** by the composite unique alone. With the project pinned to Prisma 6.19.2, Prisma schema support for partial indexes is not available, so the safest plan is: keep the Prisma-level composite unique, then add a manual SQL partial unique index in the migration for rows where `artifactType IS NULL AND touchType <> 'touch_4'`.

Also plan around repo-wide downstream impact even if this phase does not implement it: once `DeckStructure` stops being uniquely identified by `touchType` alone, later phases must update `findUnique`/`upsert` call sites. This phase can still stay schema-only, but the planner should treat migration SQL review and explicit follow-on work as mandatory.

**Primary recommendation:** Use nullable string columns plus shared constants, add `@@unique([touchType, artifactType])`, and manually harden the migration with idempotent SQL cleanup plus a partial unique index for non-Touch-4 null rows.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma / `@prisma/client` | 6.19.2 | ORM, schema, migrations | Already pinned in repo; project rules require forward-only Prisma migrations |
| PostgreSQL (Supabase) | current project DB | Constraint/index semantics | Official runtime database; null uniqueness behavior matters here |
| `@lumenalta/schemas` | 0.0.1 | Shared constants package | Existing cross-app source of truth for domain enums/constants |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Prisma Migrate | 6.19.2 | Generate and apply forward-only migrations | Always for schema changes; use `--create-only` before applying non-trivial SQL |
| Raw SQL in migration files | n/a | Partial unique index, idempotent cleanup | Use when PostgreSQL capability is needed but Prisma schema cannot express it in this repo version |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shared string constants | Prisma enum | Enum adds DB/schema coupling and diverges from existing project pattern of string fields + shared TS constants |
| Raw SQL partial unique index | Composite unique only | Simpler, but fails to enforce the locked “one non-Touch-4 row per touch type” rule for `NULL` artifactType rows |
| Prisma partial index syntax | Upgrade to Prisma 7.4+ preview feature | Out of scope and conflicts with project note to stay on Prisma 6.19.x |

**Installation:**
```bash
# from apps/agent
npx prisma migrate dev --create-only --name add_artifact_type_foundation
npx prisma migrate dev
```

## Architecture Patterns

### Recommended Project Structure
```text
packages/schemas/
├── constants.ts      # shared raw values + labels
└── index.ts          # barrel export

apps/agent/prisma/
├── schema.prisma     # nullable artifactType fields
└── migrations/       # generated SQL + manual SQL hardening
```

### Pattern 1: Shared constant + label pair
**What:** Keep canonical stored values and friendly labels together in `@lumenalta/schemas`.
**When to use:** Any domain classification consumed by both web and agent.
**Example:**
```typescript
// Source: current repo pattern in packages/schemas/constants.ts + index.ts
export const ARTIFACT_TYPES = ["proposal", "talk_track", "faq"] as const;

export const ARTIFACT_TYPE_LABELS: Record<(typeof ARTIFACT_TYPES)[number], string> = {
  proposal: "Proposal",
  talk_track: "Talk Track",
  faq: "FAQ",
};

export type ArtifactType = (typeof ARTIFACT_TYPES)[number];
```

### Pattern 2: Nullable subtype column on existing model
**What:** Add `artifactType String?` to existing models instead of splitting tables.
**When to use:** Only a subset of records needs a sub-classification dimension.
**Example:**
```prisma
// Source: repo schema pattern + Prisma schema docs
model Template {
  id                    String    @id @default(cuid())
  touchTypes            String
  contentClassification String?
  artifactType          String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}

model DeckStructure {
  id            String   @id @default(cuid())
  touchType     String
  artifactType  String?
  structureJson String

  @@unique([touchType, artifactType])
  @@index([touchType])
}
```

### Pattern 3: Manual SQL hardening for null-row uniqueness
**What:** Use migration SQL for DB behavior Prisma 6.19.2 cannot model cleanly here.
**When to use:** You need one `NULL` subtype row per non-Touch-4 touch type.
**Example:**
```sql
-- Source: PostgreSQL unique/partial index docs
CREATE UNIQUE INDEX IF NOT EXISTS "DeckStructure_non_touch4_null_artifact_key"
ON "DeckStructure" ("touchType")
WHERE "artifactType" IS NULL AND "touchType" <> 'touch_4';

DELETE FROM "DeckStructure"
WHERE "touchType" = 'touch_4' AND "artifactType" IS NULL;
```

### Anti-Patterns to Avoid
- **Composite unique alone is enough:** It is not enough for `NULL` rows in PostgreSQL.
- **Hardcode artifact strings in app code:** Use `@lumenalta/schemas` only.
- **Introduce Prisma enum just for this field:** Breaks repo consistency without clear gain.
- **Use `prisma db push`:** Project rules explicitly forbid it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Shared artifact vocabulary | Per-app string literals | `@lumenalta/schemas` export | Prevents drift between agent and web |
| Schema rollout | Manual ad hoc DB edits | Prisma migration + reviewed SQL | Keeps migration history and deployment safe |
| Non-Touch-4 null uniqueness | App-side “be careful” logic | PostgreSQL partial unique index in migration SQL | DB constraint is the only reliable enforcement |
| Cleanup of legacy generic Touch 4 row | One-off script outside migration history | Idempotent `DELETE` in migration SQL | Repeatable across environments |

**Key insight:** The deceptively hard part here is not the new column; it is expressing the intended uniqueness semantics for nullable rows without relying on later application code.

## Common Pitfalls

### Pitfall 1: Assuming `@@unique([touchType, artifactType])` blocks duplicate null rows
**What goes wrong:** Multiple `("touch_1", NULL)` rows can still exist.
**Why it happens:** PostgreSQL unique constraints treat `NULL` values as distinct by default.
**How to avoid:** Review generated SQL and add a partial unique index for non-Touch-4 null rows.
**Warning signs:** Migration looks correct on paper, but DB still permits duplicate null artifact rows.

### Pitfall 2: Letting the old generic `touch_4` row survive
**What goes wrong:** You end up with a phantom generic Touch 4 structure plus future artifact-specific rows.
**Why it happens:** Existing v1.5 data already has `touchType = 'touch_4'` as a catch-all.
**How to avoid:** Delete it in the migration with idempotent SQL.
**Warning signs:** A `touch_4` record with `artifactType IS NULL` remains after migration.

### Pitfall 3: Duplicating touch/artifact labels outside shared schemas
**What goes wrong:** UI text and stored values drift apart across apps.
**Why it happens:** Repo already has a local `apps/web/src/lib/template-utils.ts` touch label map; it is easy to repeat that pattern.
**How to avoid:** Add artifact labels to `@lumenalta/schemas` and plan later cleanup for duplicated local constants.
**Warning signs:** New artifact labels appear in web-only files instead of shared package exports.

### Pitfall 4: Trying to enforce Template rules at the DB layer too early
**What goes wrong:** Overcomplicated SQL checks against JSON-string `touchTypes` and classification state.
**Why it happens:** `Template.touchTypes` is stored as a JSON string, not a normalized relation.
**How to avoid:** In this phase, add the nullable column and shared constants; enforce the single-touch Example rule in later API/UI validation.
**Warning signs:** Migration starts casting/parsing text JSON just to validate business rules.

## Code Examples

Verified patterns from official sources:

### Composite unique constraint for Prisma unique queries
```typescript
// Source: https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-composite-ids-and-constraints
await prisma.deckStructure.findUnique({
  where: {
    touchType_artifactType: {
      touchType: "touch_4",
      artifactType: "proposal",
    },
  },
});
```

### PostgreSQL partial unique index for subset enforcement
```sql
-- Source: https://www.postgresql.org/docs/current/indexes-partial.html
CREATE UNIQUE INDEX "DeckStructure_non_touch4_null_artifact_key"
ON "DeckStructure" ("touchType")
WHERE "artifactType" IS NULL AND "touchType" <> 'touch_4';
```

### Forward-only migration workflow
```bash
# Source: Prisma Migrate docs + project CLAUDE.md rules
npx prisma migrate dev --create-only --name add_artifact_type_foundation
# inspect migration.sql, then apply
npx prisma migrate dev
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `DeckStructure.touchType @unique` | `touchType + artifactType` identity for Touch 4, plus DB hardening for null rows | v1.6 / Phase 35 | Enables separate Proposal / Talk Track / FAQ structures |
| App-local label maps | Shared domain constants in `@lumenalta/schemas` | existing project pattern | Keeps web and agent aligned |
| Pure Prisma schema for all index semantics | Prisma schema + manual migration SQL for advanced PostgreSQL constraints | needed because project is on Prisma 6.19.2 | Avoids forced ORM upgrade for one feature |

**Deprecated/outdated:**
- Generic `touch_4` deck structure row: must be removed.
- New constants defined only in web or agent: use shared package instead.

## Open Questions

1. **Should Phase 35 add DB-level check constraints for allowed artifact values?**
   - What we know: Closed set is locked (`proposal`, `talk_track`, `faq`), but repo convention today uses string columns rather than Prisma enums.
   - What's unclear: Whether planners want DB enforcement now or to rely on later API/UI validation.
   - Recommendation: Keep `String?` columns in Prisma either way; if extra hardening is desired, add raw SQL `CHECK` constraints in the migration rather than introducing Prisma enums.

2. **How much compile-safety work belongs in this phase?**
   - What we know: After Prisma Client regeneration, existing `findUnique({ where: { touchType } })` usage will no longer match the model identity.
   - What's unclear: Whether Phase 35 may include minimal non-behavioral compile fixes, or whether that is intentionally deferred to Phase 36.
   - Recommendation: Plan for at least a follow-on audit immediately after this phase; do not let the planner treat schema change as isolated.

## Sources

### Primary (HIGH confidence)
- Current repo: `apps/agent/prisma/schema.prisma` - existing `Template` and `DeckStructure` model shapes
- Current repo: `packages/schemas/constants.ts` and `packages/schemas/index.ts` - established shared constant/barrel export pattern
- Prisma docs: https://www.prisma.io/docs/orm/prisma-migrate/getting-started - forward-only migration workflow
- Prisma docs: https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-composite-ids-and-constraints - composite unique query pattern
- Prisma docs: https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes - index capabilities and partial-index support docs
- PostgreSQL docs: https://www.postgresql.org/docs/current/ddl-constraints.html - unique constraint semantics
- PostgreSQL docs: https://www.postgresql.org/docs/current/indexes-unique.html - `NULLS DISTINCT` default behavior for unique indexes
- PostgreSQL docs: https://www.postgresql.org/docs/current/indexes-partial.html - partial unique index pattern

### Secondary (MEDIUM confidence)
- Prisma release notes: https://github.com/prisma/prisma/releases/tag/7.4.0 - partial indexes introduced as preview feature
- Current repo lockfile/package manifests - project is pinned to Prisma 6.19.2 and should stay on 6.19.x

### Tertiary (LOW confidence)
- Existing internal research notes in `.planning/research/*` - useful cross-checks, but not authoritative on current Prisma/PostgreSQL behavior

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - derived from current repo manifests and established project patterns
- Architecture: MEDIUM - core schema direction is clear, but exact DB hardening choice depends on how strictly Phase 35 owns uniqueness enforcement
- Pitfalls: HIGH - backed by official PostgreSQL null-uniqueness rules and current repo call-site patterns

**Research date:** 2026-03-07
**Valid until:** 2026-04-06
