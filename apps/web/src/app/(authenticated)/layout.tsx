import { redirect } from "next/navigation";
import { Briefcase } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { UserNav } from "@/components/user-nav";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const name = (user.user_metadata?.full_name as string) ?? "User";
  const email = user.email ?? "";
  const avatarUrl = (user.user_metadata?.avatar_url as string) ?? "";

  return (
    <>
      <nav className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a
            href="/deals"
            className="flex items-center gap-2 font-semibold text-slate-900 cursor-pointer"
          >
            <Briefcase className="h-5 w-5 text-blue-600" />
            <span>Lumenalta Sales</span>
          </a>
          <UserNav user={{ name, email, avatarUrl }} />
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </>
  );
}
