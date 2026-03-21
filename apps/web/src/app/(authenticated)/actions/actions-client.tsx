"use client";

import React, { useState, useTransition } from "react";
import {
  AlertTriangle,
  Share2,
  FolderOpen,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  BellOff,
  VolumeX,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import type { ActionRequiredItem } from "@/lib/api-client";
import { silenceActionAction } from "@/lib/actions/action-required-actions";
import { createClient } from "@/lib/supabase/client";

function getActionIcon(actionType: string) {
  switch (actionType) {
    case "reauth_needed":
      return <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />;
    case "share_with_sa":
      return <Share2 className="h-5 w-5 shrink-0 text-amber-500" />;
    case "drive_access":
      return <FolderOpen className="h-5 w-5 shrink-0 text-blue-500" />;
    case "atlus_account_required":
      return <KeyRound className="h-5 w-5 shrink-0 text-purple-500" />;
    case "atlus_project_required":
      return <ShieldCheck className="h-5 w-5 shrink-0 text-indigo-500" />;
    default:
      return <AlertTriangle className="h-5 w-5 shrink-0 text-slate-400" />;
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function isAtlusActionType(actionType: string): boolean {
  return (
    actionType === "atlus_account_required" ||
    actionType === "atlus_project_required"
  );
}

interface ActionsClientProps {
  initialActions: ActionRequiredItem[];
}

export function ActionsClient({ initialActions }: ActionsClientProps): React.JSX.Element {
  const [actions, setActions] = useState(initialActions);
  const [isPending, startTransition] = useTransition();
  const [silencingId, setSilencingId] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const pendingActions = actions.filter((a) => !a.resolved);
  const activeBadgeCount = pendingActions.filter((a) => !a.silenced).length;

  function handleSilence(id: string) {
    setSilencingId(id);
    // Optimistic update: mark as silenced (do NOT remove from list)
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, silenced: true } : a))
    );

    startTransition(async () => {
      try {
        await silenceActionAction(id);
      } catch {
        // Revert on error
        setActions((prev) =>
          prev.map((a) => (a.id === id ? { ...a, silenced: false } : a))
        );
        toast.error("Failed to silence action");
      } finally {
        setSilencingId(null);
      }
    });
  }

  // Show toast feedback from AtlusAI OAuth redirect
  useEffect(() => {
    const success = searchParams.get("atlus_success");
    const error = searchParams.get("atlus_error");
    if (success === "connected") {
      toast.success("AtlusAI connected successfully!");
    } else if (success === "no_project") {
      toast.info(
        "AtlusAI account connected, but you still need project access.",
      );
    } else if (error) {
      toast.error(`AtlusAI connection failed: ${error.replace(/_/g, " ")}`);
    }
  }, [searchParams]);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Action Required</h1>
        {activeBadgeCount > 0 && (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-2 text-xs font-medium text-white">
            {activeBadgeCount}
          </span>
        )}
      </div>

      {pendingActions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white px-6 py-16 text-center">
          <CheckCircle2 className="mb-3 h-10 w-10 text-green-500" />
          <p className="text-lg font-medium text-slate-900">
            No actions required
          </p>
          <p className="mt-1 text-sm text-slate-500">
            All issues have been resolved. You are all set.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingActions.map((action) => (
            <div
              key={action.id}
              className={`flex items-start gap-4 rounded-lg border border-slate-200 bg-white p-4 transition-opacity duration-200${
                action.silenced ? " opacity-50" : ""
              }`}
            >
              <div className="mt-0.5">{getActionIcon(action.actionType)}</div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{action.title}</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  {action.description}
                </p>
                {action.resourceName && (
                  <p className="mt-1 text-xs text-slate-400">
                    Resource: {action.resourceName}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  {formatDate(action.updatedAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Re-authenticate Google via OAuth */}
                {action.actionType === "reauth_needed" && !action.silenced && (
                  <button
                    onClick={async () => {
                      const supabase = createClient();
                      await supabase.auth.signInWithOAuth({
                        provider: "google",
                        options: {
                          scopes:
                            "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/presentations https://www.googleapis.com/auth/documents",
                          queryParams: {
                            hd: "lumenalta.com",
                            access_type: "offline",
                            prompt: "consent",
                          },
                          redirectTo: `${window.location.origin}/auth/callback`,
                        },
                      });
                    }}
                    className="inline-flex cursor-pointer items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <ExternalLink className="mr-1.5 h-4 w-4" />
                    Connect Google
                  </button>
                )}

                {/* Connect to AtlusAI via OAuth */}
                {isAtlusActionType(action.actionType) && !action.silenced && (
                  <a
                    href="/auth/atlus/connect"
                    className="inline-flex cursor-pointer items-center rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                    aria-label="Connect to AtlusAI"
                  >
                    <ExternalLink className="mr-1.5 h-4 w-4" />
                    Connect to AtlusAI
                  </a>
                )}

                {/* Silence / Silenced indicator */}
                {action.silenced ? (
                  <VolumeX className="h-4 w-4 text-slate-300" />
                ) : (
                  <button
                    onClick={() => handleSilence(action.id)}
                    disabled={silencingId === action.id || isPending}
                    className="cursor-pointer rounded-md p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Silence this action"
                    title="Silence"
                  >
                    <BellOff className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
