# Project Rules

## Database / Prisma Migration Discipline

- **NEVER** use `prisma db push` in this project. All schema changes MUST go through `prisma migrate dev --name <descriptive-name>`.
- **NEVER** reset or recreate the database (`prisma migrate reset`, dropping dev.db). Treat the dev database as if it were production — write forward-only migrations that evolve the schema incrementally.
- If the migration history drifts from the actual DB (e.g., tables exist that migrations don't know about), fix it by creating a baseline migration and marking it as applied with `prisma migrate resolve --applied <name>` — do NOT reset.
- Every new model or schema change = a new migration file committed alongside the code change.
- Use `--create-only` to inspect migration SQL before applying when making non-trivial changes.
