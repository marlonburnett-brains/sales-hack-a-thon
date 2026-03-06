import { listActionsAction } from "@/lib/actions/action-required-actions";
import { ActionsClient } from "./actions-client";

export const dynamic = "force-dynamic";

export default async function ActionsPage() {
  let actions: Awaited<ReturnType<typeof listActionsAction>> = [];

  try {
    actions = await listActionsAction();
  } catch {
    // Agent service may be unavailable during development
  }

  return <ActionsClient initialActions={actions} />;
}
