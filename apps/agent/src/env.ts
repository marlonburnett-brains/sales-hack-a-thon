import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

// Write VERTEX_SERVICE_ACCOUNT_KEY (inline JSON) to a temp file and set
// GOOGLE_APPLICATION_CREDENTIALS so the @google/genai Vertex SDK can find it.
// This avoids all relative-path resolution issues with mastra dev.
if (process.env.VERTEX_SERVICE_ACCOUNT_KEY && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const tmpPath = join(tmpdir(), `vertex-sa-${process.pid}.json`)
  writeFileSync(tmpPath, process.env.VERTEX_SERVICE_ACCOUNT_KEY, 'utf-8')
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath
}

export const env = createEnv({
  server: {
    // Supabase pooled connection (port 6543, pgbouncer)
    DATABASE_URL: z.string().url(),
    // Supabase direct connection (port 5432, for migrations/introspection)
    DIRECT_URL: z.string().url(),

    // JSON string of Google service account credentials
    // Format: { "type": "service_account", "project_id": "...", "private_key": "...", ... }
    GOOGLE_SERVICE_ACCOUNT_KEY: z.string().min(1),

    // Google Drive folder ID where generated presentations are stored
    // Optional: users can override via UserSetting "drive_root_folder_id"
    GOOGLE_DRIVE_FOLDER_ID: z.string().default(''),

    // DEPRECATED: Legacy hardcoded presentation IDs — no longer used.
    // All touch workflows now use the structure-driven pipeline with
    // example presentations registered in the Template table.
    // These are kept as optional to avoid breaking existing .env files.
    GOOGLE_TEMPLATE_PRESENTATION_ID: z.string().optional(),
    MEET_LUMENALTA_PRESENTATION_ID: z.string().optional(),
    CAPABILITY_DECK_PRESENTATION_ID: z.string().optional(),

    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),

    // Google Cloud project ID for Vertex AI
    GOOGLE_CLOUD_PROJECT: z.string().min(1),
    // Google Cloud region for Vertex AI (e.g., us-central1)
    GOOGLE_CLOUD_LOCATION: z.string().min(1),
    // Vertex AI service account credentials as inline JSON string.
    // At startup this is written to a temp file and GOOGLE_APPLICATION_CREDENTIALS
    // is set so the @google/genai SDK can read it.
    VERTEX_SERVICE_ACCOUNT_KEY: z.string().min(1),

    // Port for the Mastra HTTP server.
    // Railway injects PORT for health checks, so prefer that when MASTRA_PORT is unset.
    MASTRA_PORT: z.string().default(process.env.PORT ?? '4111'),

    // Supabase project URL for JWKS-based JWT verification
    // The agent fetches public keys from {SUPABASE_URL}/auth/v1/.well-known/jwks.json
    SUPABASE_URL: z.string().url("SUPABASE_URL required for JWT verification"),

    // Web app origin URL for CORS restriction (default: http://localhost:3000)
    WEB_APP_URL: z.string().url().default('http://localhost:3000'),

    // AES-256-GCM encryption key for Google refresh tokens (64 hex chars = 32 bytes)
    // Generate with: openssl rand -hex 32
    // Optional: server starts without it; encryption module validates at call time
    GOOGLE_TOKEN_ENCRYPTION_KEY: z.string().length(64).optional(),

    // Google OAuth 2.0 client credentials (for refresh token -> access token exchange)
    // Source: Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Client IDs
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),

    // GCS bucket for cached slide thumbnails (optional — thumbnails served live if unset)
    GCS_THUMBNAIL_BUCKET: z.string().optional(),

    // Tavily web search API key (optional — web research disabled if unset)
    TAVILY_API_KEY: z.string().min(1).optional(),

    // Google AI Studio API key for Gemini model inference (non-Vertex path)
    GOOGLE_AI_STUDIO_API_KEY: z.string().min(1),

    // MCP integration controls
    // Kill switch for MCP search (set to 'false' to disable)
    ATLUS_USE_MCP: z.string().default('true'),
    // AtlusAI project ID for scoping MCP searches (optional)
    ATLUS_PROJECT_ID: z.string().optional(),
    // Max lifetime for MCP client connection in ms (default: 1 hour)
    ATLUS_MCP_MAX_LIFETIME_MS: z.coerce.number().default(3_600_000),
  },
  runtimeEnv: process.env,
})
