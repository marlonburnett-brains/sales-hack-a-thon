import type { Page } from "@playwright/test";

/**
 * Determinism Helpers for Screenshot Capture
 *
 * Ensures repeatable, pixel-consistent screenshots by:
 * 1. Disabling all CSS animations and transitions
 * 2. Waiting for network idle, font loading, and skeleton/spinner removal
 * 3. Providing element-wait utilities for specific UI states
 */

/**
 * Selector matching common skeleton/spinner/loading indicators.
 */
const LOADING_SELECTOR = [
  '[class*="skeleton"]',
  '[class*="Skeleton"]',
  '[class*="spinner"]',
  '[class*="Spinner"]',
  '[class*="loading"]',
  '[role="progressbar"]',
].join(", ");

/**
 * Default timeout for waiting for loading indicators to disappear.
 */
const SKELETON_TIMEOUT_MS = 10_000;

/**
 * Disable all CSS animations and transitions on the page.
 *
 * Injects a <style> tag with universal selector that forces:
 * - animation-duration: 0s
 * - animation-delay: 0s
 * - transition-duration: 0s
 * - transition-delay: 0s
 *
 * Uses !important to override all specificity levels.
 * Must be called BEFORE navigation for best results (via addStyleTag).
 */
export async function disableAnimations(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
      /* Hide Next.js dev indicator — not visible to real users */
      nextjs-portal { display: none !important; }
    `,
  });
}

/**
 * Wait for the page to reach a visually stable state.
 *
 * Steps:
 * 1. Wait for network idle (no pending requests for 500ms)
 * 2. Wait for all fonts to load (document.fonts.ready)
 * 3. Wait for skeleton/spinner/loading indicators to disappear
 *
 * The skeleton wait has a graceful timeout -- pages without skeletons
 * won't hang.
 */
export async function waitForStableState(page: Page): Promise<void> {
  // Wait for network idle
  await page.waitForLoadState("networkidle");

  // Wait for fonts to load
  await page.evaluate(() => document.fonts.ready);

  // Wait for skeletons/spinners to disappear
  await page
    .waitForFunction(
      (selector: string) => {
        const loadingElements = document.querySelectorAll(selector);
        return loadingElements.length === 0;
      },
      LOADING_SELECTOR,
      { timeout: SKELETON_TIMEOUT_MS }
    )
    .catch(() => {
      // Timeout is acceptable -- some pages may not have loading indicators,
      // or they might persist (e.g., progress bars in active views).
    });
}

/**
 * Prepare the page for a deterministic screenshot.
 *
 * Convenience function combining disableAnimations + waitForStableState.
 * Call this before every page.screenshot() for consistent captures.
 */
export async function prepareForScreenshot(page: Page): Promise<void> {
  await disableAnimations(page);
  await waitForStableState(page);
}

/**
 * Wait for a specific element to appear on the page.
 *
 * Useful for waiting for dynamically loaded content before capture.
 * Throws if the element doesn't appear within the timeout.
 *
 * @param page - Playwright page instance
 * @param selector - CSS selector to wait for
 * @param timeout - Maximum wait time in milliseconds (default: 15000)
 */
export async function waitForElement(
  page: Page,
  selector: string,
  timeout: number = 15_000
): Promise<void> {
  await page.waitForSelector(selector, {
    state: "visible",
    timeout,
  });
}

/**
 * Wait for specific text to appear anywhere on the page.
 *
 * Searches the full page body text content (not DOM selectors).
 * Useful for HITL tutorials where UI state depends on text content
 * that appears after stage transitions or polling responses.
 *
 * Separate from waitForElement which uses CSS selectors -- this searches
 * the full innerText of document.body.
 *
 * @param page - Playwright page instance
 * @param text - Text string to wait for
 * @param timeout - Maximum wait time in milliseconds (default: 15000)
 */
export async function waitForText(
  page: Page,
  text: string,
  timeout: number = 15_000
): Promise<void> {
  await page.waitForFunction(
    (t: string) => document.body.innerText.includes(t),
    text,
    { timeout }
  );
}
