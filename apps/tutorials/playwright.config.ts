import { defineConfig, devices } from "@playwright/test";

// Dedicated port for tutorial captures — avoids conflict with normal dev server
const TUTORIAL_WEB_PORT = 3099;
const MOCK_SERVER_PORT = 4112;

export default defineConfig({
  testDir: "./capture",
  outputDir: "./output",
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${TUTORIAL_WEB_PORT}`,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    screenshot: "off",
    video: "off",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "capture",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm --filter web dev --port ${TUTORIAL_WEB_PORT}`,
    url: `http://localhost:${TUTORIAL_WEB_PORT}`,
    reuseExistingServer: false,
    env: {
      // Point ALL external services at the mock server — zero real connections
      AGENT_SERVICE_URL: `http://localhost:${MOCK_SERVER_PORT}`,
      NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${MOCK_SERVER_PORT}`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon-key-for-tutorials",
    },
  },
});
