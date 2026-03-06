import { listActionsAction } from "@/lib/actions/action-required-actions";
import { ActionsClient } from "./actions-client";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ActionsPage() {
  let actions: Awaited<ReturnType<typeof listActionsAction>> = [];
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  try {
    actions = await listActionsAction();
  } catch {
    // Agent service may be unavailable during development
  }

  return (
    <ActionsClient
      initialActions={actions}
      userId={user?.id ?? ""}
      email={user?.email ?? ""}
    />
  );
}
