# Phase 27: Auth Foundation - Research

**Researched:** 2026-03-06
**Domain:** Token storage, pool rotation, access detection, ActionRequired UX
**Confidence:** HIGH

## Summary

Phase 27 adds AtlusAI credential storage (mirroring the existing Google token infrastructure), a token pool with env var fallback, 3-tier access detection that creates ActionRequired items, and a UX overhaul of ActionRequired (replacing Dismiss with Silence, adding dimming, auto-resolve, and re-surfacing). The codebase already has mature patterns for all of these: `token-encryption.ts` for AES-256-GCM, `getPooledGoogleAuth()` for pool rotation, and the `ActionRequired` model with CRUD routes. This phase clones and adapts these patterns rather than inventing new ones.

The key unknown is the AtlusAI auth mechanism. The CONTEXT.md notes that AtlusAI uses Google OAuth SSO with @lumenalta.com emails, and Plan 27-01 must discover the actual auth mechanism by probing the SSE endpoint. The data model, pool logic, and ActionRequired changes can proceed in parallel since they don't depend on the auth discovery.

**Primary recommendation:** Clone `UserGoogleToken` model and `getPooledGoogleAuth()` pattern verbatim, extend `ActionRequired` schema with `silenced`/`seenAt` fields via forward-only migration, refactor `actions-client.tsx` to replace Dismiss with Silence UX.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- AtlusAI uses Google OAuth SSO with @lumenalta.com emails -- same identity provider as the app
- Strategy: try reusing existing Google OAuth tokens first, fall back to separate AtlusAI auth if different scopes/client are needed
- Auth mechanism specifics are unknown -- Plan 27-01 must discover by probing the AtlusAI SSE endpoint
- UserAtlusToken model mirrors UserGoogleToken structure but may need adaptation based on discovery findings
- No dedicated settings page or credential form -- AtlusAI uses SSO, same as the MCP endpoint expects
- Credential capture is triggered from ActionRequired items in the sidebar
- If token reuse fails and separate auth is needed, the ActionRequired item provides the SSO entry point
- Check on login (try reusing Google token against AtlusAI) and on credential update
- Toast notification (Sonner) when AtlusAI access is missing -- non-blocking, user can proceed with other features
- Automatic cascade: resolving tier 1 immediately re-checks tiers 2/3 (TIER-04)
- No background periodic polling -- checks happen at login and on credential events only
- Actions are persistent -- they exist as long as the issue exists, auto-resolved by the system when fixed
- No more "Dismiss" button -- replaced with "Silence" that mutes the badge count
- Silenced items: don't count toward badge AND appear visually dimmed in the list
- Re-surfacing: when the system detects the issue again, bump to top (update timestamp), un-silence automatically
- Auto-resolve: items disappear immediately when the system detects the issue is fixed
- This applies to ALL action types (reauth_needed, share_with_sa, drive_access + new AtlusAI types)
- New action types: atlus_account_required, atlus_project_required

### Claude's Discretion
- SSO redirect approach (new tab vs in-app redirect) for AtlusAI authentication
- Exact ActionRequired component refactoring approach (retrofit existing vs new component)
- Token pool health check threshold and warning log format (mirror Google pool pattern)
- Database migration strategy for ActionRequired schema changes (add silenced/seenAt fields)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ATLS-01 | UserAtlusToken Prisma model encrypted per user | Clone UserGoogleToken model structure; same fields + userId unique constraint |
| ATLS-02 | AES-256-GCM via existing token-encryption.ts | Reuse `encryptToken`/`decryptToken` from `apps/agent/src/lib/token-encryption.ts` directly |
| ATLS-03 | Track lastUsedAt, isValid, revokedAt | Same fields as UserGoogleToken -- copy verbatim |
| ATLS-04 | Web UI for credential input | Triggered from ActionRequired items; no dedicated settings page per user decision |
| ATLS-05 | Upsert on userId | Use Prisma `upsert({ where: { userId }, create: {...}, update: {...} })` |
| POOL-01 | getPooledAtlusAuth() iterates valid tokens | Mirror `getPooledGoogleAuth()` pattern in `apps/agent/src/lib/google-auth.ts` |
| POOL-02 | Failed tokens marked isValid: false | Same invalidation pattern as Google pool |
| POOL-03 | Successful usage updates lastUsedAt | Fire-and-forget `.update().catch(() => {})` pattern |
| POOL-04 | Warning when pool < 3 tokens | Same `console.warn` pattern as Google pool |
| POOL-05 | ATLUS_API_TOKEN env var fallback | Check env var when pool exhausted, before returning null |
| TIER-01 | Detect no AtlusAI account (401/403) | Auth probe during login; create atlus_account_required ActionRequired |
| TIER-02 | Detect has account but no project access | Secondary probe after auth succeeds; create atlus_project_required ActionRequired |
| TIER-03 | Detect full access, pool the token | No ActionRequired created; token stored/updated in pool |
| TIER-04 | Re-trigger on new credentials | Cascade: resolve tier 1 action -> immediately check tiers 2/3 |
| TIER-05 | De-duplicate ActionRequired per user+type | Existing pattern: `findFirst({ where: { userId, actionType, resolved: false } })` |
| ACTN-01 | atlus_account_required action type with icon | Add to getActionIcon switch in actions-client.tsx |
| ACTN-02 | atlus_project_required action type with icon | Add to getActionIcon switch in actions-client.tsx |
| ACTN-03 | Action type constants in packages/schemas | Add ACTION_TYPES const to packages/schemas/constants.ts |
| ACTN-04 | Resolution guidance in description | Description text tells user what to do (request account, request project access) |
| ACTN-05 | Sidebar badge includes AtlusAI types | Existing `/api/actions/count` counts ALL unresolved -- works unchanged, but must exclude silenced |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 6.19.x | ORM + migrations | Already in use; NEVER use `db push` per CLAUDE.md |
| Node crypto | built-in | AES-256-GCM encryption | Already used in `token-encryption.ts` |
| Hono | existing | Agent API routes | All agent routes registered via `registerApiRoute` |
| Next.js | existing | Web app server actions | Actions in `apps/web/src/lib/actions/` |
| Sonner | existing | Toast notifications | Already integrated for non-blocking alerts |
| Lucide React | existing | Icons | All sidebar/action icons use Lucide |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.0.18 | Unit tests (agent) | Testing pool logic, encryption, tier detection |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shared GOOGLE_TOKEN_ENCRYPTION_KEY | Separate ATLUS_TOKEN_ENCRYPTION_KEY | Unnecessary -- same encryption, same key is fine for same-app tokens |

**Installation:** No new packages needed. Everything is already in the workspace.

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/src/lib/
  atlus-auth.ts           # getPooledAtlusAuth() + tier detection logic
  token-encryption.ts     # REUSE -- no changes needed

apps/agent/prisma/
  schema.prisma           # Add UserAtlusToken model, extend ActionRequired
  migrations/             # Forward-only migration for new model + schema changes

apps/web/src/app/(authenticated)/actions/
  actions-client.tsx      # Refactor: Silence UX, dimming, new action types

apps/web/src/lib/actions/
  action-required-actions.ts  # Add silenceAction server action

apps/web/src/lib/
  api-client.ts           # Add silence endpoint, update ActionRequiredItem type

packages/schemas/
  constants.ts            # Add ACTION_TYPES constant
```

### Pattern 1: Token Pool Cloning
**What:** `getPooledAtlusAuth()` mirrors `getPooledGoogleAuth()` exactly
**When to use:** Any background process needing AtlusAI credentials
**Example:**
```typescript
// Source: apps/agent/src/lib/google-auth.ts (existing pattern to clone)
export async function getPooledAtlusAuth(): Promise<PooledAtlusAuthResult> {
  const tokens = await prisma.userAtlusToken.findMany({
    where: { isValid: true },
    orderBy: { lastUsedAt: 'desc' },
  });

  for (const token of tokens) {
    try {
      const decrypted = decryptToken(token.encryptedToken, token.iv, token.authTag);
      // Use decrypted token against AtlusAI endpoint
      // On success: update lastUsedAt (fire-and-forget)
      // Return token
    } catch {
      // Mark invalid, create ActionRequired
    }
  }

  // Fallback to ATLUS_API_TOKEN env var
  const envToken = process.env.ATLUS_API_TOKEN;
  if (envToken) return { token: envToken, source: 'env' };

  return null;
}
```

### Pattern 2: ActionRequired Silence UX
**What:** Replace Dismiss with Silence; silenced items don't count in badge but remain visible (dimmed)
**When to use:** All action types (existing + new AtlusAI types)
**Example:**
```typescript
// New schema fields on ActionRequired
silenced   Boolean   @default(false)
seenAt     DateTime?

// Badge count query changes from:
prisma.actionRequired.count({ where: { resolved: false } })
// To:
prisma.actionRequired.count({ where: { resolved: false, silenced: false } })
```

### Pattern 3: 3-Tier Cascade Detection
**What:** On login or credential update, probe AtlusAI in sequence: auth -> project access -> full access
**When to use:** Login callback, credential submission
**Example:**
```typescript
async function detectAtlusAccess(userId: string, token: string) {
  // Tier 1: Can we authenticate?
  const authResult = await probeAtlusAuth(token);
  if (!authResult.ok) {
    await upsertActionRequired(userId, 'atlus_account_required', ...);
    return;
  }
  // Auto-resolve any existing tier 1 action
  await resolveActionsByType(userId, 'atlus_account_required');

  // Tier 2: Do we have project access?
  const projectResult = await probeAtlusProject(token);
  if (!projectResult.ok) {
    await upsertActionRequired(userId, 'atlus_project_required', ...);
    return;
  }
  await resolveActionsByType(userId, 'atlus_project_required');

  // Tier 3: Full access -- pool the token
  await upsertAtlusToken(userId, token);
}
```

### Pattern 4: ActionRequired Re-surfacing
**What:** When the system detects an issue again for an already-silenced action, un-silence and bump to top
**When to use:** Any code that creates/updates ActionRequired records
**Example:**
```typescript
// Instead of just findFirst + create, do upsert-like logic:
const existing = await prisma.actionRequired.findFirst({
  where: { userId, actionType, resolved: false },
});
if (existing) {
  // Re-surface: bump timestamp, un-silence
  await prisma.actionRequired.update({
    where: { id: existing.id },
    data: { updatedAt: new Date(), silenced: false },
  });
} else {
  await prisma.actionRequired.create({ data: { ... } });
}
```

### Anti-Patterns to Avoid
- **Dismissing/deleting ActionRequired records:** Actions are persistent; only the system resolves them when the underlying issue is fixed
- **Separate encryption key for AtlusAI:** Reuse `GOOGLE_TOKEN_ENCRYPTION_KEY` -- same app, same security boundary
- **Building a dedicated settings page:** User decision says credential capture happens via ActionRequired items
- **Background polling for access detection:** Checks happen only at login and on credential events

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token encryption | Custom crypto | Existing `token-encryption.ts` | AES-256-GCM already implemented, tested |
| Pool rotation | New pool logic | Clone `getPooledGoogleAuth()` | Battle-tested pattern with error handling |
| ActionRequired dedup | Custom dedup | Existing `findFirst + create` pattern | Already handles race conditions |
| Toast notifications | Custom toast system | Sonner (already integrated) | Styling and animation already configured |
| Migration creation | `prisma db push` | `prisma migrate dev --name` | CLAUDE.md mandates migrations, never push |

**Key insight:** This phase is 90% cloning existing patterns (Google token -> AtlusAI token, Google pool -> AtlusAI pool) and 10% new work (ActionRequired UX overhaul, tier detection logic).

## Common Pitfalls

### Pitfall 1: Using `prisma db push` instead of migrations
**What goes wrong:** Schema changes are applied without migration files, causing drift
**Why it happens:** `db push` is faster during development
**How to avoid:** CLAUDE.md explicitly forbids it. Always use `prisma migrate dev --name <descriptive-name>`
**Warning signs:** Missing migration files in `prisma/migrations/`

### Pitfall 2: Breaking the badge count with silence
**What goes wrong:** Adding `silenced` field but forgetting to update the count query
**Why it happens:** The count endpoint is in a different file than the ActionRequired list
**How to avoid:** Update BOTH `/actions/count` route AND the sidebar fetch to exclude silenced items
**Warning signs:** Badge count doesn't match visible non-silenced items

### Pitfall 3: Race condition in ActionRequired dedup
**What goes wrong:** Two concurrent requests both see no existing record and both create one
**Why it happens:** `findFirst` + `create` is not atomic
**How to avoid:** Use unique constraint on `(userId, actionType)` for active records, or accept minor duplication since it's non-critical
**Warning signs:** Duplicate ActionRequired records for same user + type

### Pitfall 4: Forgetting to update ActionRequiredItem type
**What goes wrong:** New `silenced`/`seenAt` fields not reflected in the TypeScript interface
**Why it happens:** `ActionRequiredItem` is manually defined in `api-client.ts`, not auto-generated
**How to avoid:** Update the interface in `apps/web/src/lib/api-client.ts` when adding schema fields
**Warning signs:** TypeScript doesn't catch missing field usage

### Pitfall 5: Token field naming mismatch
**What goes wrong:** UserAtlusToken uses `encryptedRefresh` but AtlusAI may not use refresh tokens
**Why it happens:** Blindly copying UserGoogleToken field names
**How to avoid:** Use generic field name like `encryptedToken` since the auth mechanism is TBD
**Warning signs:** Field name implies refresh token but stores something else

### Pitfall 6: ActionRequired re-surface forgetting to update timestamp
**What goes wrong:** Re-surfaced items don't appear at top of list because `updatedAt` isn't bumped
**Why it happens:** Only un-silencing without updating the sort field
**How to avoid:** Always set `updatedAt: new Date()` when re-surfacing; change sort order to `updatedAt desc`
**Warning signs:** Re-surfaced items buried in the list

## Code Examples

### Existing Token Encryption (reuse directly)
```typescript
// Source: apps/agent/src/lib/token-encryption.ts
import { encryptToken, decryptToken } from './token-encryption';

// Encrypt before storage
const { encrypted, iv, authTag } = encryptToken(rawToken);

// Decrypt for use
const rawToken = decryptToken(encrypted, iv, authTag);
```

### Existing Pool Pattern (clone for AtlusAI)
```typescript
// Source: apps/agent/src/lib/google-auth.ts lines 92-174
// Key elements to preserve:
// 1. findMany({ where: { isValid: true }, orderBy: { lastUsedAt: 'desc' } })
// 2. For-loop with try/catch per token
// 3. Fire-and-forget lastUsedAt update on success
// 4. Mark invalid + create ActionRequired on failure
// 5. Pool health warning when < 3 valid tokens
```

### Existing ActionRequired Dedup (reuse pattern)
```typescript
// Source: apps/agent/src/lib/google-auth.ts lines 144-158
const existing = await prisma.actionRequired.findFirst({
  where: { userId: token.userId, actionType: 'reauth_needed', resolved: false },
});
if (!existing) {
  await prisma.actionRequired.create({ data: { ... } });
}
```

### Migration Template for New Model
```sql
-- Forward-only migration: add UserAtlusToken + extend ActionRequired
CREATE TABLE "UserAtlusToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserAtlusToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserAtlusToken_userId_key" ON "UserAtlusToken"("userId");
CREATE INDEX "UserAtlusToken_isValid_lastUsedAt_idx" ON "UserAtlusToken"("isValid", "lastUsedAt");
CREATE INDEX "UserAtlusToken_email_idx" ON "UserAtlusToken"("email");

-- Extend ActionRequired with silence/seen tracking
ALTER TABLE "ActionRequired" ADD COLUMN "silenced" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ActionRequired" ADD COLUMN "seenAt" TIMESTAMP(3);
```

### Sidebar Badge Count Update
```typescript
// Current (counts ALL unresolved):
prisma.actionRequired.count({ where: { resolved: false } });

// Updated (excludes silenced):
prisma.actionRequired.count({ where: { resolved: false, silenced: false } });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dismiss ActionRequired | Silence (mute badge, dim visually) | Phase 27 | All action types affected |
| Manual resolve only | Auto-resolve when system detects fix | Phase 27 | Reduces stale actions |
| Static action list | Re-surface with timestamp bump | Phase 27 | Important items float to top |
| Google-only token pool | Google + AtlusAI dual pools | Phase 27 | Enables AtlusAI integration |

## Open Questions

1. **AtlusAI Auth Mechanism**
   - What we know: Uses Google OAuth SSO with @lumenalta.com emails
   - What's unclear: Whether existing Google OAuth tokens can be reused or if a separate OAuth flow is needed
   - Recommendation: Plan 27-01 must probe the SSE endpoint to discover this. Design the model generically (`encryptedToken` not `encryptedRefresh`)

2. **ActionRequired Sort Order**
   - What we know: Currently sorted by `createdAt desc`
   - What's unclear: Should re-surfaced items sort by `updatedAt` instead?
   - Recommendation: Change to `updatedAt desc` since re-surfacing bumps `updatedAt`. New items also have `updatedAt = createdAt` so behavior is equivalent for new records.

3. **Silence Persistence Scope**
   - What we know: Silenced items should stay silenced until re-surfaced
   - What's unclear: Should silence survive across sessions? (yes, it's a DB field)
   - Recommendation: `silenced` is a boolean on the ActionRequired model -- persists in DB, survives sessions

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | `apps/agent/vitest.config.ts` |
| Quick run command | `cd apps/agent && npx vitest run --reporter=verbose` |
| Full suite command | `cd apps/agent && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ATLS-01 | UserAtlusToken model CRUD | integration | `cd apps/agent && npx vitest run src/lib/__tests__/atlus-auth.test.ts -x` | Wave 0 |
| ATLS-02 | Encryption via token-encryption.ts | unit | `cd apps/agent && npx vitest run src/lib/__tests__/token-encryption.test.ts -x` | Exists |
| ATLS-05 | Upsert on userId | unit | `cd apps/agent && npx vitest run src/lib/__tests__/atlus-auth.test.ts -x` | Wave 0 |
| POOL-01 | Pool iteration order | unit | `cd apps/agent && npx vitest run src/lib/__tests__/atlus-auth.test.ts -x` | Wave 0 |
| POOL-02 | Invalid token marking | unit | `cd apps/agent && npx vitest run src/lib/__tests__/atlus-auth.test.ts -x` | Wave 0 |
| POOL-04 | Pool health warning | unit | `cd apps/agent && npx vitest run src/lib/__tests__/atlus-auth.test.ts -x` | Wave 0 |
| POOL-05 | Env var fallback | unit | `cd apps/agent && npx vitest run src/lib/__tests__/atlus-auth.test.ts -x` | Wave 0 |
| TIER-01 | Detect no account | unit | `cd apps/agent && npx vitest run src/lib/__tests__/atlus-auth.test.ts -x` | Wave 0 |
| TIER-04 | Cascade re-check | unit | `cd apps/agent && npx vitest run src/lib/__tests__/atlus-auth.test.ts -x` | Wave 0 |
| TIER-05 | ActionRequired dedup | unit | `cd apps/agent && npx vitest run src/lib/__tests__/atlus-auth.test.ts -x` | Wave 0 |
| ACTN-01 | atlus_account_required icon renders | unit | `cd apps/web && npx vitest run src/app/(authenticated)/actions/__tests__/actions-client.test.tsx -x` | Exists (needs update) |
| ACTN-05 | Badge count excludes silenced | unit | Manual verify via API | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/agent && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd apps/agent && npx vitest run && cd ../web && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/agent/src/lib/__tests__/atlus-auth.test.ts` -- covers ATLS-01, ATLS-05, POOL-01-05, TIER-01-05
- [ ] Update `apps/web/src/app/(authenticated)/actions/__tests__/actions-client.test.tsx` -- covers ACTN-01, ACTN-02 new icon types + Silence UX

## Sources

### Primary (HIGH confidence)
- `apps/agent/src/lib/token-encryption.ts` -- AES-256-GCM implementation
- `apps/agent/src/lib/google-auth.ts` -- Pool rotation pattern (lines 92-174)
- `apps/agent/prisma/schema.prisma` -- UserGoogleToken model (lines 252-267), ActionRequired model (lines 274-290)
- `apps/web/src/app/(authenticated)/actions/actions-client.tsx` -- Current ActionRequired UI
- `apps/web/src/components/sidebar.tsx` -- Badge count fetch pattern
- `apps/agent/src/mastra/index.ts` -- ActionRequired CRUD routes
- `apps/web/src/lib/api-client.ts` -- ActionRequiredItem interface

### Secondary (MEDIUM confidence)
- CONTEXT.md user decisions on Silence UX, re-surfacing, auto-resolve behavior

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - cloning existing patterns with well-understood modifications
- Pitfalls: HIGH - based on direct code inspection of existing patterns
- Auth mechanism: LOW - unknown until Plan 27-01 probes the SSE endpoint

**Research date:** 2026-03-06
**Valid until:** 2026-03-20 (stable -- internal codebase patterns)
