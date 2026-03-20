import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { TutorialScriptSchema } from "../src/types/tutorial-script.js";
import type { TutorialStep } from "../src/types/tutorial-script.js";
import { ensureAuthState } from "../src/helpers/auth.js";
import { mockBrowserAPIs } from "../src/helpers/route-mocks.js";
import { captureStep } from "../src/helpers/screenshot.js";
import { loadFixtures } from "../fixtures/loader.js";
import { waitForText } from "../src/helpers/determinism.js";

/**
 * Deal Chat Tutorial Capture
 *
 * This spec is driven by the tutorial script JSON at
 * fixtures/deal-chat/script.json. The capture loop is generic --
 * it iterates the script's steps, navigates, waits, performs actions,
 * then captures a screenshot at each step.
 */

const TUTORIAL_ID = "deal-chat";
const MOCK_SERVER_URL = `http://localhost:${process.env.MOCK_SERVER_PORT ?? "4112"}`;

// Load and validate the script at module level
const scriptPath = path.join(
  process.cwd(),
  "fixtures",
  TUTORIAL_ID,
  "script.json"
);
const scriptRaw = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
const script = TutorialScriptSchema.parse(scriptRaw);

test.describe("Deal Chat Tutorial Capture", () => {
  // Mutable stage ref -- updated by capture loop, read by browser-side mocks
  let currentStageRef = "idle";

  test.beforeEach(async ({ page }) => {
    // Set up auth state (injects Supabase session + cookies)
    await ensureAuthState(page);

    // Set up browser-side API route mocks with stage/sequence awareness
    const fixtures = loadFixtures(TUTORIAL_ID);
    await mockBrowserAPIs(page, fixtures, {
      stageGetter: () => currentStageRef,
    });
  });

  test("capture all steps", async ({ page }) => {
    let currentUrl = "";

    for (let i = 0; i < script.steps.length; i++) {
      const step: TutorialStep = script.steps[i];

      await test.step(`Step ${i + 1}: ${step.id}`, async () => {
        // ── Pre-step: set mock stage if specified ──
        if (step.mockStage) {
          currentStageRef = step.mockStage;
          await fetch(`${MOCK_SERVER_URL}/mock/set-stage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stage: step.mockStage }),
          });
        }

        // ── Pre-step: reset sequences if specified ──
        if (step.resetSequences) {
          for (const key of step.resetSequences) {
            await fetch(`${MOCK_SERVER_URL}/mock/reset-sequence`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key }),
            });
          }
        }

        // Navigate if URL changed
        if (step.url && step.url !== currentUrl) {
          await page.goto(step.url, { waitUntil: "domcontentloaded" });
          currentUrl = step.url;

          // Wait for page to settle
          await page.waitForLoadState("networkidle").catch(() => {
            // networkidle may time out if polling -- acceptable
          });
        } else if (step.mockStage) {
          // Stage changed but same URL — reload to fetch fresh data from mock server
          await page.reload({ waitUntil: "domcontentloaded" });
          await page.waitForLoadState("networkidle").catch(() => {});
        }

        // Ensure sidebar is expanded (if sidebar exists)
        const sidebar = page.locator(
          '[data-testid="sidebar"], nav[role="navigation"], aside'
        );
        if (await sidebar.count()) {
          const collapsed = page.locator(
            '[data-testid="sidebar-collapsed"], [data-state="collapsed"]'
          );
          if (await collapsed.count()) {
            const expandBtn = page.locator(
              '[data-testid="sidebar-toggle"], [aria-label="Expand sidebar"]'
            );
            if (await expandBtn.count()) {
              await expandBtn.first().click();
              await page.waitForTimeout(300);
            }
          }
        }

        // Wait for specific selector if specified
        if (step.waitFor) {
          await page
            .waitForSelector(step.waitFor, {
              state: "visible",
              timeout: 10_000,
            })
            .catch(() => {
              // Selector may not exist -- continue with capture anyway
              console.warn(
                `Warning: waitFor selector "${step.waitFor}" not found for ${step.id}`
              );
            });
        }

        // Execute actions if specified
        if (step.actions) {
          for (const action of step.actions) {
            switch (action.type) {
              case "click":
                await page.click(action.selector, { timeout: 5_000 });
                break;
              case "fill":
                await page.fill(action.selector, action.value);
                break;
              case "select":
                await page.selectOption(action.selector, action.value);
                break;
              case "wait":
                await page.waitForSelector(action.selector, {
                  state: "visible",
                  timeout: 10_000,
                });
                break;
              case "hover":
                await page.hover(action.selector);
                break;
              case "keyboard":
                await page.keyboard.press(action.key);
                break;
            }
          }
        }

        // ── Post-action: wait for text if specified ──
        if (step.waitForText) {
          await waitForText(page, step.waitForText).catch(() => {
            console.warn(
              `Warning: waitForText "${step.waitForText}" not found for ${step.id}`
            );
          });
        }

        // ── Post-action: delay if specified ──
        if (step.delayMs) {
          await page.waitForTimeout(step.delayMs);
        }

        // Capture the screenshot
        await captureStep(page, TUTORIAL_ID, i);
      });
    }

    // Verify output
    const outputDir = path.join(process.cwd(), "output", TUTORIAL_ID);
    const screenshots = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter((f) => f.endsWith(".png"))
      : [];

    expect(screenshots.length).toBe(script.steps.length);
    console.log(
      `\nCapture complete: ${screenshots.length} screenshots in ${outputDir}`
    );
  });
});
