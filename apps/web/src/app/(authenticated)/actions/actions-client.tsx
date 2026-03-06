"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Share2,
  FolderOpen,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  BellOff,
  VolumeX,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import type { ActionRequiredItem } from "@/lib/api-client";
import {
  silenceActionAction,
  submitAtlusCredentialsAction,
} from "@/lib/actions/action-required-actions";

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
  userId: string;
  email: string;
}

export function ActionsClient({ initialActions, userId, email }: ActionsClientProps) {
  const [actions, setActions] = useState(initialActions);
  const [isPending, startTransition] = useTransition();
  const [silencingId, setSilencingId] = useState<string | null>(null);
  const [atlusToken, setAtlusToken] = useState("");
  const [submittingCredentials, setSubmittingCredentials] = useState(false);

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

  async function handleSubmitCredentials() {
    if (!atlusToken.trim()) return;
    setSubmittingCredentials(true);
    try {
      const result = await submitAtlusCredentialsAction(userId, email, atlusToken.trim());
      if (result.accessResult === "full_access") {
        toast.success("AtlusAI credentials saved and access confirmed!");
        // Remove resolved AtlusAI action cards from the list
        setActions((prev) => prev.filter(
          (a) => a.actionType !== "atlus_account_required" && a.actionType !== "atlus_project_required"
        ));
      } else if (result.accessResult === "no_project") {
        toast.info("Credentials saved. You still need project access -- see updated action items.");
      } else {
        toast.warning("Credentials saved but authentication failed. Please verify your token is correct.");
      }
      setAtlusToken("");
    } catch {
      toast.error("Failed to submit AtlusAI credentials. Please try again.");
    } finally {
      setSubmittingCredentials(false);
    }
  }

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

                {/* AtlusAI credential submission form */}
                {isAtlusActionType(action.actionType) && !action.silenced && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="relative flex-1">
                      <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="password"
                        value={atlusToken}
                        onChange={(e) => setAtlusToken(e.target.value)}
                        placeholder="Paste your AtlusAI API token"
                        className="w-full rounded-md border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100 transition-colors duration-150"
                        aria-label="AtlusAI API token"
                        disabled={submittingCredentials}
                      />
                    </div>
                    <button
                      onClick={() => handleSubmitCredentials()}
                      disabled={!atlusToken.trim() || submittingCredentials}
                      className="inline-flex items-center rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors duration-150"
                      aria-label="Submit AtlusAI credentials"
                    >
                      {submittingCredentials ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        "Submit"
                      )}
                    </button>
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
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
