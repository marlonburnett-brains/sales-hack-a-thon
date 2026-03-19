import type { Page, Route } from "@playwright/test";
import type { FixtureSet } from "../../fixtures/types.js";

/**
 * Browser-Side API Route Mocks
 *
 * Uses Playwright's page.route() to intercept browser-initiated fetch calls
 * to Next.js API routes (/api/*). These are routes that the browser calls
 * directly (polling, streaming, thumbnails) rather than via Server Actions.
 *
 * Server Actions go through api-client.ts -> fetchAgent() -> mock server,
 * so they don't need page.route() interception.
 */

/**
 * Options for stage-aware and sequence-aware browser-side mocks (Phase 63).
 *
 * When provided, the workflow status polling handler uses these to derive
 * dynamic responses based on the current HITL stage.
 */
export interface MockBrowserOptions {
  /** Returns the current HITL stage (e.g., "idle", "generating", "skeleton") */
  stageGetter?: () => string;
  /** Returns the next sequence response for a named key, or null if no sequence */
  sequenceGetter?: (key: string) => unknown | null;
}

/**
 * Mock all browser-side /api/* routes with fixture data.
 *
 * Intercepts:
 * - /api/workflows/status (workflow status polling)
 * - /api/generation-logs (generation log polling)
 * - /api/presentations/{id}/thumbnails (presentation thumbnail images)
 * - /api/deals/{dealId}/chat (deal chat streaming)
 * - /api/deals/{dealId}/chat/bindings (chat binding operations)
 * - /api/agents/chat (agent chat streaming)
 * - /api/deck-structures/chat (deck structure chat)
 * - /api/drive/token (Google Drive token)
 * - /api/visual-qa (visual QA)
 * - Catch-all for any unhandled /api/* routes
 *
 * @param options - Optional stage/sequence getters for HITL tutorials (Phase 63)
 */
export async function mockBrowserAPIs(
  page: Page,
  fixtures: FixtureSet,
  options?: MockBrowserOptions
): Promise<void> {
  // ────────────────────────────────────────────────────────────
  // Workflow Status Polling
  // ────────────────────────────────────────────────────────────

  await page.route("**/api/workflows/status*", async (route: Route) => {
    // Try sequence getter first (highest priority)
    const seqResponse = options?.sequenceGetter?.("workflow-status");
    if (seqResponse !== null && seqResponse !== undefined) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(seqResponse),
      });
      return;
    }

    // Derive status from current stage if stageGetter provided
    let workflowStatus = "completed";
    if (options?.stageGetter) {
      const stage = options.stageGetter();
      switch (stage) {
        case "generating":
          workflowStatus = "running";
          break;
        case "skeleton":
        case "lowfi":
        case "hifi":
          workflowStatus = "suspended";
          break;
        case "idle":
        case "completed":
        default:
          workflowStatus = "completed";
          break;
      }
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        runId: new URL(route.request().url()).searchParams.get("runId") ?? "mock-run",
        status: workflowStatus,
        steps: {},
        result: {},
      }),
    });
  });

  // ────────────────────────────────────────────────────────────
  // Generation Logs Polling
  // ────────────────────────────────────────────────────────────

  await page.route("**/api/generation-logs*", async (route: Route) => {
    // Try sequence getter first
    const seqResponse = options?.sequenceGetter?.("generation-logs");
    if (seqResponse !== null && seqResponse !== undefined) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(seqResponse),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ logs: [] }),
    });
  });

  // ────────────────────────────────────────────────────────────
  // Presentation Thumbnails
  // ────────────────────────────────────────────────────────────

  await page.route(
    "**/api/presentations/*/thumbnails*",
    async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ thumbnails: [], caching: false }),
      });
    }
  );

  // ────────────────────────────────────────────────────────────
  // Deal Chat (streaming response)
  // ────────────────────────────────────────────────────────────

  await page.route("**/api/deals/*/chat", async (route: Route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "text/plain",
        body: "This is a mock response from the deal chat assistant.",
      });
    } else {
      // GET -- bootstrap
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          messages: [],
          greeting: "Hello! How can I help you with this deal?",
          suggestions: [],
        }),
      });
    }
  });

  // ────────────────────────────────────────────────────────────
  // Deal Chat Bindings
  // ────────────────────────────────────────────────────────────

  await page.route("**/api/deals/*/chat/bindings*", async (route: Route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          source: {
            id: "mock-source",
            dealId: "mock-deal",
            sourceType: "note",
            status: "confirmed",
          },
          confirmationChip: { label: "Note saved", type: "success" },
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    }
  });

  // ────────────────────────────────────────────────────────────
  // Agent Chat (AtlusAI streaming)
  // ────────────────────────────────────────────────────────────

  await page.route("**/api/agents/chat*", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/plain",
      body: "This is a mock response from the AI agent.",
    });
  });

  // ────────────────────────────────────────────────────────────
  // Deck Structure Chat
  // ────────────────────────────────────────────────────────────

  await page.route("**/api/deck-structures/chat*", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/plain",
      body: "Mock deck structure chat response.",
    });
  });

  // ────────────────────────────────────────────────────────────
  // Google Drive Token
  // ────────────────────────────────────────────────────────────

  await page.route("**/api/drive/token*", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accessToken: "mock-google-token" }),
    });
  });

  // ────────────────────────────────────────────────────────────
  // Visual QA
  // ────────────────────────────────────────────────────────────

  await page.route("**/api/visual-qa*", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result: "Mock QA result" }),
    });
  });

  // ────────────────────────────────────────────────────────────
  // Supabase Auth (client-side calls from @supabase/ssr)
  // Intercept any browser-side auth refresh/session calls
  // ────────────────────────────────────────────────────────────

  await page.route("**/auth/v1/user*", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "00000000-0000-0000-0000-000000000001",
        email: "tutorial@example.com",
        aud: "authenticated",
        role: "authenticated",
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: { full_name: "Tutorial User" },
        created_at: "2025-01-01T00:00:00.000Z",
        updated_at: "2025-01-01T00:00:00.000Z",
      }),
    });
  });

  await page.route("**/auth/v1/token*", async (route: Route) => {
    const now = Math.floor(Date.now() / 1000);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        token_type: "bearer",
        expires_in: 86400,
        expires_at: now + 86400,
        user: {
          id: "00000000-0000-0000-0000-000000000001",
          email: "tutorial@example.com",
          aud: "authenticated",
          role: "authenticated",
        },
      }),
    });
  });

  // ────────────────────────────────────────────────────────────
  // Catch-all for unhandled /api/* routes
  // Warns but still returns 200 to prevent UI errors
  // ────────────────────────────────────────────────────────────

  await page.route("**/api/**", async (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();
    console.warn(
      `[route-mocks] Unhandled browser API call: ${method} ${url}`
    );
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ _mock: true, _warning: "Unhandled route" }),
    });
  });
}
