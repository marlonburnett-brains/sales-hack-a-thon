import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";

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
    <Sidebar user={{ name, email, avatarUrl }}>
      {children}
    </Sidebar>
  );
}
