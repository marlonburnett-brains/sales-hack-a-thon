import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  skipValidation: !!process.env.CI,
  server: {
    AGENT_SERVICE_URL: z.string().url().default("http://localhost:4111"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    // Shared API key for service-to-service auth (web <-> agent)
    // Generate with: openssl rand -base64 32
    AGENT_API_KEY: z.string().min(32, "AGENT_API_KEY must be at least 32 characters"),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_GOOGLE_API_KEY: z.string().min(1).default(""),
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().min(1).default(""),
  },
  runtimeEnv: {
    AGENT_SERVICE_URL: process.env.AGENT_SERVICE_URL,
    NODE_ENV: process.env.NODE_ENV,
    AGENT_API_KEY: process.env.AGENT_API_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_GOOGLE_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  },
});
