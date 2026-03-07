import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

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
    GOOGLE_DRIVE_FOLDER_ID: z.string().min(1),

    // Google Slides template presentation ID (Lumenalta branded template)
    GOOGLE_TEMPLATE_PRESENTATION_ID: z.string().min(1),

    // Source presentation ID for Touch 2 "Meet Lumenalta" intro deck
    // AI selects slides from this presentation for industry-relevant intro decks
    MEET_LUMENALTA_PRESENTATION_ID: z.string().default(''),

    // Source presentation ID for Touch 3 capability alignment deck
    // Falls back to MEET_LUMENALTA_PRESENTATION_ID if not set
    CAPABILITY_DECK_PRESENTATION_ID: z.string().default(''),

    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),

    // Google Cloud project ID for Vertex AI
    GOOGLE_CLOUD_PROJECT: z.string().min(1),
    // Google Cloud region for Vertex AI (e.g., us-central1)
    GOOGLE_CLOUD_LOCATION: z.string().min(1),
    // Note: GOOGLE_APPLICATION_CREDENTIALS is read automatically by
    // @google/genai when vertexai: true is set. No need to validate here.

    // Port for the Mastra HTTP server (default 4111)
    MASTRA_PORT: z.string().default('4111'),

    // Shared API key for service-to-service auth (web <-> agent)
    // Generate with: openssl rand -base64 32
    AGENT_API_KEY: z.string().min(32, "AGENT_API_KEY must be at least 32 characters"),

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
