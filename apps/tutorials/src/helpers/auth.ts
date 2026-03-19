import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as path from "node:path";

/**
 * Auth Helper for Tutorial Captures
 *
 * Signs in a real Supabase test user via signInWithPassword() and injects
 * the session into the Playwright browser. This produces valid tokens that
 * satisfy both middleware auth paths:
 *   - getSession() (fast, cookie-only, RSC requests)
 *   - getUser() (full server validation, page loads)
 */

const STORAGE_STATE_DIR = path.join(
  process.cwd(),
  "apps",
  "tutorials",
  ".auth"
);

/**
 * Get the file path for cached auth storage state.
 */
export function getStorageStatePath(): string {
  return path.join(STORAGE_STATE_DIR, "state.json");
}

/**
 * Ensure a valid Supabase auth session is injected into the browser page.
 *
 * Flow:
 * 1. Signs in via Supabase REST API (signInWithPassword)
 * 2. Injects session into localStorage (for client-side Supabase reads)
 * 3. Sets Supabase auth cookies (for SSR middleware getSession/getUser)
 *
 * Required env vars:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   - TUTORIAL_USER_EMAIL
 *   - TUTORIAL_USER_PASSWORD
 */
export async function ensureAuthState(page: Page): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.TUTORIAL_USER_EMAIL;
  const password = process.env.TUTORIAL_USER_PASSWORD;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is required. Set it in apps/tutorials/.env"
    );
  }
  if (!supabaseAnonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is required. Set it in apps/tutorials/.env"
    );
  }
  if (!email || !password) {
    throw new Error(
      "TUTORIAL_USER_EMAIL and TUTORIAL_USER_PASSWORD are required. " +
        "Create a test user in Supabase with password auth enabled, " +
        "then set these in apps/tutorials/.env"
    );
  }

  // Create Supabase client and sign in
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    throw new Error(
      `Supabase auth failed: ${error?.message ?? "No session returned"}. ` +
        "Ensure the test user exists and password auth is enabled in Supabase."
    );
  }

  const session = data.session;

  // Extract Supabase project ref from URL (e.g., "abcdefgh" from "https://abcdefgh.supabase.co")
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  const storageKey = `sb-${ref}-auth-token`;

  // Inject session into browser localStorage (for client-side Supabase reads)
  await page.addInitScript(
    (args: { key: string; session: unknown }) => {
      localStorage.setItem(args.key, JSON.stringify(args.session));
    },
    { key: storageKey, session }
  );

  // Set Supabase auth cookies (for SSR middleware)
  // The @supabase/ssr package stores the session in chunked cookies
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
    : new URL("http://localhost:3000");

  const cookieBase = `sb-${ref}-auth-token`;
  const sessionJson = JSON.stringify(session);

  // Supabase SSR stores session as base64 chunks in cookies
  // For simplicity, set a single cookie (works for sessions under ~4KB)
  const cookies = [
    {
      name: `${cookieBase}`,
      value: `base64-${Buffer.from(sessionJson).toString("base64")}`,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
      expires: Math.floor(Date.now() / 1000) + 3600,
    },
  ];

  // If session is large, chunk it (Supabase SSR uses .0, .1, .2 suffixes)
  const maxChunkSize = 3180; // ~3KB per cookie chunk (leaves room for cookie overhead)
  const encoded = `base64-${Buffer.from(sessionJson).toString("base64")}`;

  if (encoded.length > maxChunkSize) {
    // Clear the single cookie approach -- use chunks
    cookies.length = 0;
    const chunks = Math.ceil(encoded.length / maxChunkSize);
    for (let i = 0; i < chunks; i++) {
      cookies.push({
        name: `${cookieBase}.${i}`,
        value: encoded.slice(i * maxChunkSize, (i + 1) * maxChunkSize),
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax" as const,
        expires: Math.floor(Date.now() / 1000) + 3600,
      });
    }
  }

  await page.context().addCookies(cookies);

  // Also set the google-token-status cookie to prevent middleware token check
  await page.context().addCookies([
    {
      name: "google-token-status",
      value: "valid",
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
      expires: Math.floor(Date.now() / 1000) + 3600,
    },
  ]);
}
