import { defineConfig, devices } from "@playwright/test";

// Port configuration — capture.ts manages both servers, not Playwright
const TUTORIAL_WEB_PORT = Number(process.env.TUTORIAL_WEB_PORT ?? 3099);

export default defineConfig({
  testDir: "./capture",
  outputDir: "./test-results",
  timeout: 180_000,
  use: {
    baseURL: `http://localhost:${TUTORIAL_WEB_PORT}`,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
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
  // No webServer — capture.ts starts both mock server and Next.js with mock env vars
});
