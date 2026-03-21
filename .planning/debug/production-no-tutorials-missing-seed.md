---
status: awaiting_human_verify
trigger: "Production has no tutorials — it's like there was no seed migration. We need to seed the same tutorial and links data that exists in the dev database."
created: 2026-03-20T00:00:00Z
updated: 2026-03-20T00:00:00Z
---

## Current Focus

hypothesis: The Tutorial table exists in production (schema migrations applied) but no data was ever seeded, because the seed script reads from local filesystem paths that don't exist in production
test: Confirmed by reading seed.ts — it depends on apps/tutorials/output/tutorials-manifest.json and apps/tutorials/fixtures/*/script.json, neither of which are available in production
expecting: Creating a forward-only migration with INSERT statements will seed the data idempotently in production
next_action: Await human verification that running prisma migrate deploy in production resolves the empty Tutorial table

## Symptoms

expected: Production database should have 17 tutorials with titles, descriptions, GCS URLs, thumbnail URLs, durations, and sort orders
actual: Production has no tutorials — the Tutorial table is empty
errors: No explicit error — just empty data in production
reproduction: Visit production app and check tutorials section — no tutorials appear
started: Unclear when it started; may have never been seeded in production

## Eliminated

- hypothesis: Tutorial schema tables don't exist in production
  evidence: Migrations 20260320204500_add_tutorial_models and 20260320221000_add_tutorial_thumbnail_url create the schema; if those ran, the table exists. The symptom is empty data, not missing tables.
  timestamp: 2026-03-20T00:00:00Z

- hypothesis: There's a migration that contains INSERT statements for tutorials
  evidence: Read all migration SQL files — no INSERT statements exist in any migration. Data seeding was only in seed.ts which requires local filesystem.
  timestamp: 2026-03-20T00:00:00Z

## Evidence

- timestamp: 2026-03-20T00:00:00Z
  checked: apps/agent/prisma/seed.ts
  found: seed.ts reads tutorials-manifest.json and fixtures/*/script.json from the local filesystem (path.resolve(__dirname, '../../tutorials/output/...')). These paths do not exist in a production environment.
  implication: The seed script can never run against production unless run from the local machine pointed at the production DATABASE_URL.

- timestamp: 2026-03-20T00:00:00Z
  checked: apps/tutorials/output/tutorials-manifest.json and tutorial-thumbnails-manifest.json
  found: 17 tutorials with slug, gcsUrl, durationSec, and thumbnailUrl. All data is static and fully known.
  implication: All values needed for the INSERT statements are available and can be embedded directly in a migration SQL file.

- timestamp: 2026-03-20T00:00:00Z
  checked: apps/tutorials/fixtures/*/script.json for all 17 slugs
  found: All 17 fixture files exist and contain title, description, and steps array. Step counts: getting-started=8, deals=12, deal-overview=8, deal-chat=12, briefing=12, touch-1-pager=15, touch-2-intro-deck=13, touch-3-capability-deck=13, touch-4-hitl=16, template-library=12, slide-library=10, deck-structures=12, atlus-integration=12, asset-review=17, action-center=8, agent-prompts=12, google-drive-settings=6
  implication: All 17 rows can be fully specified in a migration SQL file.

- timestamp: 2026-03-20T00:00:00Z
  checked: apps/agent/prisma/migrations/20260320204500_add_tutorial_models/migration.sql
  found: Only DDL (CREATE TABLE) — no INSERT statements. The thumbnailUrl column was added later in 20260320221000_add_tutorial_thumbnail_url.
  implication: Schema is in place but no data migration was ever created.

## Resolution

root_cause: The Tutorial table schema was properly migrated to production, but no seed data migration exists. The seed script depends on local filesystem paths unavailable in production, so it was never run against the production database. The result is an empty Tutorial table.
fix: Create a new migration 20260320230000_seed_tutorial_data containing INSERT ... ON CONFLICT DO NOTHING statements for all 17 tutorials, embedding all data (title, description, gcsUrl, thumbnailUrl, durationSec, sortOrder, stepCount, category, slug) directly in the SQL.
verification: Migration created and validated. Contains 17 INSERT rows covering all tutorial slugs, all values sourced directly from tutorials-manifest.json, tutorial-thumbnails-manifest.json, and fixtures/*/script.json. Uses ON CONFLICT ("slug") DO NOTHING so it is idempotent.
files_changed:
  - apps/agent/prisma/migrations/20260320230000_seed_tutorial_data/migration.sql (new)
