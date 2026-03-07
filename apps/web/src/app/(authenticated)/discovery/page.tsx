import { Brain } from "lucide-react";
import {
  checkAtlusAccessAction,
  browseDocumentsAction,
} from "@/lib/actions/discovery-actions";
import type { BrowseResult } from "@/lib/actions/discovery-actions";
import { DiscoveryClient } from "./discovery-client";

export const dynamic = "force-dynamic";

export default async function DiscoveryPage() {
  let accessResult;
  try {
    accessResult = await checkAtlusAccessAction();
  } catch {
    // Agent service may be unavailable during development
    accessResult = { hasAccess: false, reason: "mcp_unavailable" as const };
  }

  if (!accessResult.hasAccess) {
    const reason = accessResult.reason;

    let description: string;
    let showConnectButton = false;

    switch (reason) {
      case "no_tokens":
        description =
          "No AtlusAI credentials configured. Connect your AtlusAI account to browse and search content.";
        showConnectButton = true;
        break;
      case "disabled":
        description = "AtlusAI integration is currently disabled.";
        break;
      case "mcp_unavailable":
      default:
        description =
          "AtlusAI service is temporarily unavailable. Please try again later.";
        break;
    }

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <Brain className="h-12 w-12 text-slate-300" />
        <h1 className="text-xl font-semibold text-slate-900">
          AtlusAI Not Available
        </h1>
        <p className="max-w-md text-sm text-slate-500">{description}</p>
        {showConnectButton && (
          <a
            href="/auth/atlus/connect"
            className="mt-2 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Connect AtlusAI
          </a>
        )}
      </div>
    );
  }

  // Has access -- fetch initial browse data
  let browseResult: BrowseResult = {
    documents: [],
    ingestedHashes: [],
  };

  try {
    browseResult = await browseDocumentsAction({ limit: 20 });
  } catch {
    // Non-fatal: render client with empty initial data
  }

  return <DiscoveryClient initialBrowse={browseResult} />;
}
