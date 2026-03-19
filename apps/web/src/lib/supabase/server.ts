import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Synthetic user returned in mock auth mode (tutorial captures). */
const MOCK_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "tutorial@example.com",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Tutorial User" },
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

const MOCK_SESSION = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  token_type: "bearer" as const,
  expires_in: 86400,
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  user: MOCK_USER,
};

export async function createClient() {
  // Tutorial mock mode — return a lightweight Supabase-compatible client
  // that never makes network calls. All auth methods return synthetic data.
  if (process.env.MOCK_AUTH === "true") {
    return {
      auth: {
        getUser: async () => ({ data: { user: MOCK_USER }, error: null }),
        getSession: async () => ({ data: { session: MOCK_SESSION }, error: null }),
      },
    } as unknown as ReturnType<typeof createServerClient>;
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component.
            // Can be ignored if middleware handles session refresh.
          }
        },
      },
    }
  );
}
