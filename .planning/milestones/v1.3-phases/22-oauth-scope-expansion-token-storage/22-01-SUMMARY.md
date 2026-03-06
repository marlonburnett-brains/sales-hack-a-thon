---
phase: 22-oauth-scope-expansion-token-storage
plan: 01
subsystem: auth
tags: [aes-256-gcm, crypto, prisma, encryption, google-oauth, token-storage]
requirements_completed: [TOKS-01, TOKS-02, TOKS-03, TOKS-04, TOKS-05]

# Dependency graph
requires: []
provides:
  - "UserGoogleToken Prisma model for encrypted per-user refresh token storage"
  - "AES-256-GCM encrypt/decrypt module (encryptToken, decryptToken, getEncryptionKey)"
  - "POST /tokens agent API endpoint for token storage"
  - "GET /tokens/check/:userId agent API endpoint for middleware re-consent check"
  - "GOOGLE_TOKEN_ENCRYPTION_KEY env var (optional, validated at call time)"
affects: [22-02, 22-03, 23, 24]

# Tech tracking
tech-stack:
  added: []
  patterns: ["AES-256-GCM encryption with randomized IV and authTag verification"]

key-files:
  created:
    - "apps/agent/src/lib/token-encryption.ts"
    - "apps/agent/src/lib/__tests__/token-encryption.test.ts"
    - "apps/agent/prisma/migrations/20260306131204_add_user_google_token/migration.sql"
  modified:
    - "apps/agent/prisma/schema.prisma"
    - "apps/agent/src/env.ts"
    - "apps/agent/src/mastra/index.ts"

key-decisions:
  - "Used manual migration + resolve --applied to work around migration drift (0_init modified)"
  - "GOOGLE_TOKEN_ENCRYPTION_KEY is optional in env.ts so server starts without it; validated at encryption call time"
  - "Key validation uses regex /^[0-9a-fA-F]{64}$/ for 64 hex chars instead of just Buffer.from length check"

patterns-established:
  - "Token encryption pattern: encryptToken returns {encrypted, iv, authTag} as base64 strings"
  - "Manual Prisma migration workflow: create migration dir + SQL, db execute, resolve --applied"

requirements-completed: [TOKS-01, TOKS-02, TOKS-03, TOKS-04, TOKS-05]

# Metrics
duration: 4min
completed: 2026-03-06
---

# Phase 22 Plan 01: Token Encryption & Storage Infrastructure Summary

**AES-256-GCM token encryption module with UserGoogleToken Prisma model and POST /tokens + GET /tokens/check/:userId agent API routes**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-06T16:09:59Z
- **Completed:** 2026-03-06T16:13:37Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Token encryption module with AES-256-GCM using only Node.js crypto (zero new dependencies)
- UserGoogleToken Prisma model with userId unique constraint, encrypted fields, and tracking columns (lastUsedAt, isValid, revokedAt)
- POST /tokens endpoint that encrypts and upserts refresh tokens with Zod validation
- GET /tokens/check/:userId endpoint for lightweight token existence checks
- 7 unit tests covering roundtrip encryption, randomized IV, key validation, and tamper detection
- Forward-only database migration applied without resetting

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing encryption tests** - `2f06924` (test)
2. **Task 1 GREEN: Encryption module + model + migration** - `09e1b2a` (feat)
3. **Task 2: POST /tokens and GET /tokens/check/:userId routes** - `3c8d50b` (feat)

## Files Created/Modified
- `apps/agent/src/lib/token-encryption.ts` - AES-256-GCM encrypt/decrypt with getEncryptionKey validation
- `apps/agent/src/lib/__tests__/token-encryption.test.ts` - 7 vitest tests for encryption behaviors
- `apps/agent/prisma/schema.prisma` - Added UserGoogleToken model
- `apps/agent/prisma/migrations/20260306131204_add_user_google_token/migration.sql` - CreateTable + indexes
- `apps/agent/src/env.ts` - Added optional GOOGLE_TOKEN_ENCRYPTION_KEY
- `apps/agent/src/mastra/index.ts` - Added POST /tokens and GET /tokens/check/:userId routes

## Decisions Made
- Used manual migration + `prisma migrate resolve --applied` to handle migration drift (0_init was modified post-apply). This follows CLAUDE.md's guidance for drift recovery without reset.
- GOOGLE_TOKEN_ENCRYPTION_KEY is optional in env.ts validation so the server starts without it. The encryption module validates at call time, providing graceful degradation for existing deploys.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma migration drift required manual migration approach**
- **Found during:** Task 1 (migration step)
- **Issue:** `prisma migrate dev` detected that `0_init` migration was modified after application, requiring a reset (which CLAUDE.md forbids)
- **Fix:** Created migration directory manually, wrote SQL, executed with `prisma db execute`, and marked as applied with `prisma migrate resolve --applied`
- **Files modified:** prisma/migrations/20260306131204_add_user_google_token/migration.sql
- **Verification:** Migration SQL executed successfully, Prisma client regenerated, all tests pass
- **Committed in:** 09e1b2a (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Migration approach changed but outcome identical. No scope creep.

## Issues Encountered
None beyond the migration drift handled above.

## User Setup Required

The following environment variable must be set before token storage will work:

- `GOOGLE_TOKEN_ENCRYPTION_KEY` - 64 hex character string (32 bytes). Generate with: `openssl rand -hex 32`

The server will start without this key, but any call to POST /tokens will fail until it is set.

## Next Phase Readiness
- POST /tokens endpoint ready for web auth callback (Plan 02) to call
- GET /tokens/check/:userId ready for middleware re-consent check (Plan 02)
- Encryption module ready for decryption when tokens are used in Phase 23-24

---
*Phase: 22-oauth-scope-expansion-token-storage*
*Completed: 2026-03-06*
