import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  server: {
    // SQLite file path — used by Prisma for app-level job records
    DATABASE_URL: z.string().min(1),

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

    // Google Gemini API key for AI-powered content generation
    // Get from: https://aistudio.google.com/apikey
    // Required for Touch 1/2/3 workflows (Gemini 2.5 Flash)
    GEMINI_API_KEY: z.string().min(1),

    // Port for the Mastra HTTP server (default 4111)
    MASTRA_PORT: z.string().default('4111'),
  },
  runtimeEnv: process.env,
})
