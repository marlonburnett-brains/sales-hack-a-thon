"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Share2, FolderOpen, CheckCircle2 } from "lucide-react";
import type { ActionRequiredItem } from "@/lib/api-client";
import { resolveActionAction } from "@/lib/actions/action-required-actions";

function getActionIcon(actionType: string) {
  switch (actionType) {
    case "reauth_needed":
      return <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />;
    case "share_with_sa":
      return <Share2 className="h-5 w-5 shrink-0 text-amber-500" />;
    case "drive_access":
      return <FolderOpen className="h-5 w-5 shrink-0 text-blue-500" />;
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

interface ActionsClientProps {
  initialActions: ActionRequiredItem[];
}

export function ActionsClient({ initialActions }: ActionsClientProps) {
  const [actions, setActions] = useState(initialActions);
  const [isPending, startTransition] = useTransition();
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const pendingActions = actions.filter((a) => !a.resolved);

  function handleDismiss(id: string) {
    setDismissingId(id);
    // Optimistic removal
    setActions((prev) => prev.filter((a) => a.id !== id));

    startTransition(async () => {
      try {
        await resolveActionAction(id);
      } catch {
        // Revert on error
        setActions(initialActions);
      } finally {
        setDismissingId(null);
      }
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Action Required</h1>
        {pendingActions.length > 0 && (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-2 text-xs font-medium text-white">
            {pendingActions.length}
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
              className="flex items-start gap-4 rounded-lg border border-slate-200 bg-white p-4"
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
                  {formatDate(action.createdAt)}
                </p>
              </div>
              <button
                onClick={() => handleDismiss(action.id)}
                disabled={dismissingId === action.id || isPending}
                className="cursor-pointer text-sm text-slate-500 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Dismiss action: ${action.title}`}
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
