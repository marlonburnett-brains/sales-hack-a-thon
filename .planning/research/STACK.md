# Stack Research

**Domain:** AtlusAI MCP integration, token pool auth, and Discovery UI for agentic sales platform
**Researched:** 2026-03-06
**Confidence:** MEDIUM (AtlusAI endpoint auth mechanism is inferred, not documented)

## Scope

This research covers ONLY new technology additions and configuration changes for v1.4 (AtlusAI Authentication & Discovery). The existing stack (Next.js 15, Mastra AI 1.8, Prisma 6.19 + Supabase PostgreSQL + pgvector, Google Workspace APIs, shadcn/ui, Supabase Auth + Google OAuth, Sonner, CircleCI) is validated and NOT re-researched.

**Focus areas:**
1. @mastra/mcp MCPClient -- wiring to AtlusAI SSE endpoint with auth
2. AtlusAI token pool -- UserAtlusToken model, AES-256-GCM encryption, rotation
3. Replacing Drive API fallback search with direct MCP semantic search
4. Discovery UI -- new sidebar page with browse/search/ingest views

## Recommended Stack Additions

### 1. @mastra/mcp MCPClient (Already in Dependencies -- Wire It Up)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@mastra/mcp` | ^1.0.2 | Connect to AtlusAI MCP server via SSE for semantic search and document discovery | Already declared in `apps/agent/package.json` but NOT installed in `node_modules` and NOT wired up. This is Mastra's official MCP client. It auto-detects transport (tries Streamable HTTP first, falls back to legacy SSE). Provides `listTools()` for tool discovery and namespaced tool execution. |

**Current state:** The package is in `package.json` at `^1.0.2` and locked in `pnpm-lock.yaml` at `1.0.2`, but not actually installed. The existing `atlusai-client.ts` uses raw `fetch()` to probe the SSE endpoint and documents the 401 failure. The existing `atlusai-search.ts` falls back to Drive API `files.list` with `fullText contains` queries -- this is what v1.4 replaces.

**Critical requirement:** The AtlusAI SSE endpoint (`https://knowledge-base-api.lumenalta.com/sse`) returns HTTP 401 without credentials. Claude Code connects via its internal MCP layer (configured in `.mcp.json`). For the agent service to connect programmatically, we need to discover and configure the auth mechanism.

**MCPClient SSE auth configuration pattern:**

When using legacy SSE transport with custom auth headers, BOTH `requestInit` AND `eventSourceInit` must be configured. This is because the SSE connection uses a different fetch path than regular HTTP requests.

```typescript
import { MCPClient } from '@mastra/mcp';

function createAtlusAIClient(bearerToken: string): MCPClient {
  return new MCPClient({
    id: 'atlusai',  // Prevents memory leaks on re-instantiation
    servers: {
      'atlus-ai': {
        url: new URL('https://knowledge-base-api.lumenalta.com/sse'),
        // requestInit covers POST requests (tool calls)
        requestInit: {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        },
        // eventSourceInit covers SSE connection (must use custom fetch)
        eventSourceInit: {
          fetch(input: Request | URL | string, init?: RequestInit) {
            const headers = new Headers(init?.headers || {});
            headers.set('Authorization', `Bearer ${bearerToken}`);
            return fetch(input, { ...init, headers });
          },
        },
      },
    },
    timeout: 30_000,
  });
}
```

**Transport fallback behavior:** MCPClient first tries Streamable HTTP (MCP protocol version 2025-03-26). If the server responds with an error or unsupported status, it falls back to legacy SSE (protocol version 2024-11-05). The AtlusAI endpoint at `/sse` strongly suggests it uses the legacy SSE transport.

**Tool execution pattern:**

```typescript
const client = createAtlusAIClient(token);
const tools = await client.listTools();
// Tools are namespaced: 'atlus-ai_knowledge_base_search_semantic'

// Call a tool directly via the underlying MCP transport
const result = await client.callTool('atlus-ai', 'knowledge_base_search_semantic', {
  query: 'healthcare digital transformation case studies',
});
```

**Connection lifecycle:** Create ONE MCPClient instance per request or pool it with connection health checks. Call `client.disconnect()` when done. The `id` parameter prevents memory leaks from repeated instantiation.

### 2. AtlusAI Token Pool (New Prisma Model + Existing Encryption)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| AES-256-GCM (Node.js crypto) | Built-in | Encrypt AtlusAI tokens at rest | Identical to the existing `token-encryption.ts` pattern used for `UserGoogleToken`. Reuse the same `encryptToken()` / `decryptToken()` functions and `GOOGLE_TOKEN_ENCRYPTION_KEY` env var. Zero new dependencies. |

**New Prisma model -- `UserAtlusToken`:**

This mirrors `UserGoogleToken` exactly. Same encryption pattern, same pool rotation logic, same health alerting. The only difference is what the token authenticates against (AtlusAI MCP vs Google APIs).

```prisma
model UserAtlusToken {
  id               String    @id @default(cuid())
  userId           String    @unique // Supabase Auth user ID
  email            String    // User email for logging/debugging
  encryptedToken   String    // AES-256-GCM encrypted AtlusAI API token
  iv               String    // Base64-encoded initialization vector
  authTag          String    // Base64-encoded GCM authentication tag
  lastUsedAt       DateTime  @default(now())
  isValid          Boolean   @default(true)
  revokedAt        DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([isValid, lastUsedAt])
  @@index([email])
}
```

**Pool rotation pattern -- reuse `getPooledGoogleAuth` structure:**

```typescript
export async function getPooledAtlusToken(): Promise<{ token: string; source: 'pool' | 'env_fallback'; userId?: string }> {
  const tokens = await prisma.userAtlusToken.findMany({
    where: { isValid: true },
    orderBy: { lastUsedAt: 'desc' },
  });

  for (const tokenRecord of tokens) {
    try {
      const plainToken = decryptToken(tokenRecord.encryptedToken, tokenRecord.iv, tokenRecord.authTag);
      // Validate by attempting a lightweight MCP call (e.g., discover_documents)
      // On success: update lastUsedAt, return token
      // On failure: mark isValid=false, create ActionRequired
      return { token: plainToken, source: 'pool', userId: tokenRecord.userId };
    } catch {
      // Mark invalid, continue to next token
    }
  }

  // Fallback: use env var if configured
  const envToken = process.env.ATLUS_API_TOKEN;
  if (envToken) return { token: envToken, source: 'env_fallback' };

  throw new Error('No valid AtlusAI tokens available');
}
```

**Why NOT a separate encryption key:** The `GOOGLE_TOKEN_ENCRYPTION_KEY` is a 256-bit key used for AES-256-GCM. It secures tokens at rest regardless of what they authenticate. Using a single encryption key for both Google and AtlusAI tokens simplifies operations. The tokens are still isolated by table (different Prisma models). If security policy requires separate keys, add `ATLUS_TOKEN_ENCRYPTION_KEY` later.

### 3. New ActionRequired Types (Schema Extension Only)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Existing `ActionRequired` model | N/A | Add `atlus_account_required` and `atlus_project_required` action types | The `ActionRequired` model already exists with `actionType: String`. No schema migration needed -- just use new string values. The sidebar already shows action counts via `/api/actions/count`. |

**New action types (no schema change needed):**

```typescript
// Existing actionType values: 'reauth_needed', 'share_with_sa', 'drive_access'
// New actionType values:
// - 'atlus_account_required': User needs an AtlusAI account
// - 'atlus_project_required': User needs access to the AtlusAI project/knowledge base
```

**3-tier access detection flow:**

1. **No token stored** -> Create `atlus_account_required` ActionRequired
2. **Token stored but 401 on MCP connect** -> Create `atlus_project_required` ActionRequired (token valid but no project access)
3. **Token stored and MCP connects** -> Full access, proceed with MCP calls

### 4. Discovery UI Components (Existing shadcn/ui + Lucide Icons)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| shadcn/ui (EXISTING) | N/A | Cards, Tabs, Input, Button, Dialog for browse/search views | Already installed and used throughout the web app. The Discovery UI needs: `Tabs` for browse/search toggle, `Card` for document results, `Input` for search box, `Dialog` for ingestion confirmation. All these components exist in the project. |
| lucide-react (EXISTING) | ^0.576.0 | Icons for the Discovery sidebar nav item and UI elements | Already installed. Use `Search`, `BookOpen`, `Download`, or `Compass` for the nav item. |

**New sidebar nav item:**

```typescript
// Add to navItems array in sidebar.tsx
{ href: "/discovery", label: "AtlusAI Discovery", icon: Compass },
```

**No new UI dependencies needed.** The existing component library covers all Discovery UI requirements:

- **Browse view:** `Tabs` + server-fetched document list rendered as `Card` components
- **Search view:** `Input` for query + search results as `Card` components with similarity scores
- **Ingestion action:** `Button` + `Dialog` for confirmation, `Progress` component (already in radix) for ingestion progress
- **Access status banner:** Conditional banner using existing `Alert` pattern when user lacks AtlusAI access

**Existing Radix components already installed that the Discovery UI will use:**
- `@radix-ui/react-tabs` (^1.1.13) -- browse/search toggle
- `@radix-ui/react-dialog` (^1.1.15) -- ingestion confirmation
- `@radix-ui/react-progress` (^1.1.8) -- ingestion progress bar
- `@radix-ui/react-alert-dialog` (^1.1.15) -- destructive action confirmations

### 5. Environment Variables

| Variable | Where | Purpose | Notes |
|----------|-------|---------|-------|
| `ATLUS_API_TOKEN` | `apps/agent/.env` | Fallback AtlusAI API token when pool is empty | Optional. Pool-first, env-fallback. Same pattern as service account fallback for Google APIs. |

**No new env vars for encryption.** Reuse `GOOGLE_TOKEN_ENCRYPTION_KEY` for AtlusAI token encryption.

## Installation

```bash
# Ensure @mastra/mcp is actually installed (it's in package.json but missing from node_modules)
pnpm install

# That's it. No new dependencies to add.
```

**Zero new npm packages need to be added.** The only action is running `pnpm install` to ensure `@mastra/mcp@1.0.2` is actually installed in `node_modules` (it is declared in `package.json` but was never installed).

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@mastra/mcp` MCPClient | Raw `fetch()` to SSE endpoint | Never. The MCPClient handles SSE connection management, reconnection, message parsing, and tool invocation. Raw fetch requires reimplementing all of this. |
| `@mastra/mcp` MCPClient | `@modelcontextprotocol/sdk` (official MCP SDK) | Only if Mastra MCPClient has a blocking bug. The official SDK is lower-level and requires more boilerplate. `@mastra/mcp` wraps it with ergonomic APIs. |
| Reuse `token-encryption.ts` | Separate encryption module for AtlusAI tokens | Only if security policy mandates separate encryption keys per service. Same AES-256-GCM, same key length, same crypto -- no reason to duplicate. |
| `UserAtlusToken` Prisma model | JSON column on existing `UserGoogleToken` | Never. Separate models keep concerns clean. A user may have Google tokens but no AtlusAI token, or vice versa. |
| Existing shadcn/ui components | New UI library (e.g., Mantine, Chakra) | Never. Adding a second component library to a project is always wrong. |
| Single `GOOGLE_TOKEN_ENCRYPTION_KEY` | Separate `ATLUS_TOKEN_ENCRYPTION_KEY` | Only if compliance requires key separation per external service. Adds operational complexity. |
| Drive API fallback retained temporarily | Immediate Drive API removal | Keep Drive fallback behind a feature flag during v1.4. Remove in v1.5 once MCP path is proven stable. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Raw `fetch()` for MCP SSE connection | The SSE protocol requires message parsing, connection management, and reconnection logic. Raw fetch is error-prone and incomplete. | `@mastra/mcp` MCPClient |
| `EventSource` browser API | Not available in Node.js without polyfills. MCPClient handles SSE internally. | `@mastra/mcp` MCPClient |
| `@mastra/mcp` versions newer than lockfile | The project locks 1.0.2. Jumping to a newer version without testing risks breaking changes. | `@mastra/mcp@1.0.2` (from lockfile) |
| Prisma 7.x | Known regression with `Unsupported("vector")` columns (prisma/prisma#28867). Still applies. | Prisma 6.19.x |
| `prisma db push` | Prohibited by CLAUDE.md rules | `prisma migrate dev --name <name>` |
| WebSocket for Discovery UI | The browse/search pattern is request-response, not real-time streaming. Server Actions + REST is sufficient. | Next.js Server Actions + REST API |
| Global MCPClient singleton | MCP connections carry auth context. A singleton with one user's token would leak access to other users' requests. | Per-request or pooled MCPClient with token injection |
| Storing AtlusAI tokens in plaintext | Violates the encryption-at-rest pattern established in v1.3 for Google tokens. | AES-256-GCM encryption via existing `token-encryption.ts` |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@mastra/mcp` 1.0.2 | `@mastra/core` ^1.8.0, Node 22 | Requires Node >= 22.13.0 per `engines` field. Project uses Node 22 -- compatible. |
| `@mastra/mcp` 1.0.2 | MCP Protocol 2024-11-05 (SSE) and 2025-03-26 (Streamable HTTP) | Tries Streamable HTTP first, falls back to SSE. AtlusAI endpoint is likely SSE-only. |
| `@mastra/mcp` 1.0.2 | `pnpm` lockfile | Already resolved in `pnpm-lock.yaml`. Run `pnpm install` to populate `node_modules`. |
| Prisma 6.19.x | New `UserAtlusToken` model | Standard model with String/DateTime/Boolean fields. No vector columns. Safe to add via migration. |
| `token-encryption.ts` | AES-256-GCM (Node.js built-in crypto) | No version dependency. Works with any Node.js 16+. |
| shadcn/ui components | Next.js 15, React 19, Radix UI | All Discovery UI components already installed and validated. |

## Migration Strategy

```bash
# 1. Add UserAtlusToken table
pnpm --filter agent exec prisma migrate dev --name add-user-atlus-token

# No other schema changes needed for v1.4.
# ActionRequired model already supports new actionType strings without migration.
```

## Key Integration Points

### Replacing `atlusai-search.ts` Drive Fallback

The current search flow is:
```
slide-selection.ts -> atlusai-search.ts -> Drive API files.list(fullText contains)
```

The v1.4 target flow is:
```
slide-selection.ts -> atlusai-mcp-search.ts -> @mastra/mcp MCPClient -> AtlusAI SSE endpoint
```

**Files to modify:**
- `apps/agent/src/lib/atlusai-search.ts` -- Replace Drive API calls with MCPClient tool invocations
- `apps/agent/src/lib/slide-selection.ts` -- No changes needed (it calls `searchSlides` which is the interface)
- `apps/agent/src/lib/atlusai-client.ts` -- Refactor to use MCPClient instead of raw fetch for discovery

**Consumers of `atlusai-search.ts` (5 files):**
1. `apps/agent/src/lib/slide-selection.ts` -- Touch 2/3 slide selection
2. `apps/agent/src/lib/proposal-assembly.ts` -- Touch 4 proposal assembly
3. `apps/agent/src/mastra/workflows/pre-call-workflow.ts` -- Pre-call briefing
4. `apps/agent/src/mastra/workflows/touch-4-workflow.ts` -- Touch 4 workflow
5. `apps/agent/src/scripts/verify-rag-quality.ts` -- RAG quality verification

All five import `searchSlides` or `searchForProposal` from `atlusai-search.ts`. The interface stays the same -- only the implementation changes from Drive API to MCP.

### Discovery UI Route Structure

```
apps/web/src/app/(authenticated)/discovery/
  page.tsx          -- Main Discovery page with tabs
  loading.tsx       -- Loading skeleton
  actions.ts        -- Server Actions for search/browse/ingest
```

This follows the existing route pattern (e.g., `/templates`, `/slides`, `/actions`).

## Open Questions

1. **AtlusAI SSE endpoint authentication mechanism**
   - What we know: Returns 401 without auth. Claude Code connects via `.mcp.json` config with no visible credentials (internal MCP layer handles auth).
   - What's unclear: Does it use Bearer tokens? API keys? OAuth? What header name?
   - Impact: BLOCKING for MCPClient configuration. The code pattern above assumes Bearer token auth.
   - Recommendation: First task of v1.4 Phase 1 must be auth discovery. Try: (a) check if Claude Code stores credentials in `~/.claude/` config, (b) contact AtlusAI team for API documentation, (c) attempt MCPClient connection with various auth header formats.
   - Confidence: LOW -- the auth mechanism is inferred, not verified.

2. **AtlusAI token acquisition flow**
   - What we know: Users need AtlusAI accounts. Tokens need to be stored.
   - What's unclear: How users obtain AtlusAI tokens. Is there an OAuth flow? Do users paste API keys from an AtlusAI dashboard? Are tokens per-user or per-project?
   - Recommendation: Design the `UserAtlusToken` model to be flexible (encrypted blob). The web UI should have a simple "Enter your AtlusAI token" form until the acquisition flow is clarified.
   - Confidence: LOW

3. **MCP tool response format**
   - What we know: Three tools exist (semantic search, structured search, discover_documents). They are read-only.
   - What's unclear: The exact response schema of each tool. What fields come back from `knowledge_base_search_semantic`? Does it return relevance scores? Document IDs? Full text?
   - Recommendation: Phase 1 must include tool discovery via `client.listTools()` and sample invocations to map response schemas.
   - Confidence: MEDIUM (tool names are known from `.claude/settings.local.json`)

## Sources

### HIGH Confidence
- [Mastra MCPClient Reference](https://mastra.ai/reference/tools/mcp-client) -- Constructor API, SSE auth configuration with requestInit + eventSourceInit, transport fallback behavior, listTools() method
- [@mastra/mcp npm](https://www.npmjs.com/package/@mastra/mcp) -- Version 1.0.2 confirmed as latest
- [Mastra MCP Overview](https://mastra.ai/docs/tools-mcp/mcp-overview) -- Transport auto-detection (Streamable HTTP -> SSE fallback)
- Existing codebase: `apps/agent/package.json` declares `@mastra/mcp: ^1.0.2`, `pnpm-lock.yaml` resolves to 1.0.2
- Existing codebase: `apps/agent/src/lib/token-encryption.ts` -- AES-256-GCM encryption pattern
- Existing codebase: `apps/agent/src/lib/google-auth.ts` -- Token pool pattern with `getPooledGoogleAuth()`
- Existing codebase: `apps/agent/prisma/schema.prisma` -- `UserGoogleToken` model structure, `ActionRequired` model
- Existing codebase: `apps/agent/src/lib/atlusai-search.ts` -- Drive API fallback implementation and `SlideSearchResult` interface
- Existing codebase: `.mcp.json` -- AtlusAI SSE endpoint URL configuration

### MEDIUM Confidence
- [MCP SSE Transport Auth](https://mcp-framework.com/docs/Transports/sse/) -- SSE transport auth patterns with custom headers
- [MCP Protocol Transports](https://modelcontextprotocol.io/specification/2024-11-05/basic/transports) -- SSE transport specification (2024-11-05)
- Existing codebase: `.claude/settings.local.json` -- Three whitelisted AtlusAI MCP tools (knowledge_base_search_semantic, knowledge_base_search_structured, discover_documents)
- Existing codebase: `apps/agent/src/lib/atlusai-client.ts` -- 401 response from SSE endpoint, known tool schemas

### LOW Confidence
- AtlusAI SSE endpoint auth mechanism -- No public documentation found. Inferred from 401 response and Claude Code's internal MCP connection. Needs validation.
- AtlusAI token acquisition flow -- No documentation on how users obtain tokens. Needs clarification from AtlusAI team.
- MCP tool response schemas -- Tool names are known but response formats are not documented outside of Claude Code's MCP layer.

---
*Stack research for: Lumenalta v1.4 AtlusAI Authentication & Discovery*
*Researched: 2026-03-06*
