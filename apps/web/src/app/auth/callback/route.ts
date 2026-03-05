import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/deals";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // SERVER-SIDE domain enforcement
      if (user?.email && !user.email.endsWith("@lumenalta.com")) {
        await supabase.auth.signOut();
        const url = new URL("/login", origin);
        url.searchParams.set("error", "domain");
        return NextResponse.redirect(url.toString());
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth error fallback
  const url = new URL("/login", origin);
  url.searchParams.set("error", "auth");
  return NextResponse.redirect(url.toString());
}
