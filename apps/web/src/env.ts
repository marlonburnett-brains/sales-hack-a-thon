import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    AGENT_SERVICE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  client: {},
  runtimeEnv: {
    AGENT_SERVICE_URL: process.env.AGENT_SERVICE_URL,
    NODE_ENV: process.env.NODE_ENV,
  },
});
