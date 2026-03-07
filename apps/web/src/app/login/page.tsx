"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

function GoogleLogo() {
  return (
    <svg
      className="mr-2 h-5 w-5"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const next = searchParams.get("next") ?? "/deals";
  const needsConsent = searchParams.get("reconsent") === "1";

  useEffect(() => {
    if (searchParams.get("token_error") === "1") {
      toast.warning("Drive access setup incomplete. Sign out and back in to retry.");
    }
  }, [searchParams]);

  async function handleGoogleSignIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/presentations https://www.googleapis.com/auth/documents",
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: {
          hd: "lumenalta.com",
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 px-4">
        {/* Branding */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <Briefcase className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-semibold text-slate-900">
              Lumenalta Sales
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Agentic Sales Orchestration
          </p>
        </div>

        {/* Re-consent message */}
        {needsConsent && (
          <p className="max-w-sm text-center text-sm text-blue-600">
            We&apos;ve upgraded Drive access. Please sign in again to continue.
          </p>
        )}

        {/* Error messages */}
        {error === "domain" && (
          <p className="max-w-sm text-center text-sm text-destructive">
            Access is restricted to @lumenalta.com accounts. Please sign in with
            your Lumenalta Google account.
          </p>
        )}
        {error === "auth" && (
          <p className="max-w-sm text-center text-sm text-destructive">
            Sign-in failed. Please try again.
          </p>
        )}

        {/* Sign in button */}
        <Button
          variant="outline"
          size="lg"
          className="w-full cursor-pointer"
          onClick={handleGoogleSignIn}
        >
          <GoogleLogo />
          Sign in with Google
        </Button>

        {/* Domain note */}
        <p className="text-xs text-muted-foreground">
          @lumenalta.com accounts only
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <div className="flex flex-col items-center gap-2">
            <Briefcase className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-semibold text-slate-900">
              Lumenalta Sales
            </span>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
