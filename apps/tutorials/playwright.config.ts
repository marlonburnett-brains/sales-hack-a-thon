import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./capture",
  outputDir: "./output",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3000",
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
    command: "pnpm --filter web dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    env: {
      // Point ALL external services at the mock server — zero real connections
      AGENT_SERVICE_URL: "http://localhost:4112",
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:4112",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon-key-for-tutorials",
    },
  },
});
