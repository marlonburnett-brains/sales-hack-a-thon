# Project Rules

## Database / Prisma Migration Discipline

- **NEVER** use `prisma db push` in this project. All schema changes MUST go through `prisma migrate dev --name <descriptive-name>`.
- **NEVER** reset or recreate the database (`prisma migrate reset`). Treat the dev database as if it were production — write forward-only migrations that evolve the schema incrementally.
- If the migration history drifts from the actual DB (e.g., tables exist that migrations don't know about), fix it by creating a baseline migration and marking it as applied with `prisma migrate resolve --applied <name>` — do NOT reset.
- Every new model or schema change = a new migration file committed alongside the code change.
- Use `--create-only` to inspect migration SQL before applying when making non-trivial changes.

## Google Service Account Credential Separation

- **`GOOGLE_SERVICE_ACCOUNT_KEY`** — ONLY for accessing Google documents (Drive, Slides, Docs). Never use for paid inference services.
- **`VERTEX_SERVICE_ACCOUNT_KEY`** — For ALL paid Google Cloud services: Vertex AI, GCS, Model Garden, etc.
- **NEVER** use `GOOGLE_SERVICE_ACCOUNT_KEY` for Vertex AI or any paid compute/inference service. Always use `VERTEX_SERVICE_ACCOUNT_KEY`.
- The OpenAI model `gpt-oss-120b-maas` is served via **Vertex AI Model Garden**, NOT OpenAI's API. Use the Vertex AI OpenAI-compatible endpoint with `VERTEX_SERVICE_ACCOUNT_KEY` credentials.
