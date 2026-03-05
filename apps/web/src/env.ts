import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    AGENT_SERVICE_URL: z.string().url().default("http://localhost:4111"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    // Shared API key for service-to-service auth (web <-> agent)
    AGENT_API_KEY: z.string().min(1),
  },
  client: {},
  runtimeEnv: {
    AGENT_SERVICE_URL: process.env.AGENT_SERVICE_URL,
    NODE_ENV: process.env.NODE_ENV,
    AGENT_API_KEY: process.env.AGENT_API_KEY,
  },
});
