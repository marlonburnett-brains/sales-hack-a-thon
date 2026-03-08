"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateDealStatusAction } from "@/lib/actions/deal-actions";

const STATUSES = ["open", "won", "lost", "abandoned"] as const;

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  open: { bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-500" },
  won: { bg: "bg-emerald-100", text: "text-emerald-800", dot: "bg-emerald-500" },
  lost: { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" },
  abandoned: { bg: "bg-slate-200", text: "text-slate-700", dot: "bg-slate-500" },
};

const TERMINAL_STATUSES = new Set(["won", "lost", "abandoned"]);

interface DealStatusActionProps {
  dealId: string;
  currentStatus: string;
  onStatusChange?: (newStatus: string) => void;
}

export function DealStatusAction({
  dealId,
  currentStatus,
  onStatusChange,
}: DealStatusActionProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);

  const colors = STATUS_COLORS[currentStatus] ?? STATUS_COLORS.open;
  const label = currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1);

  async function applyStatus(newStatus: string) {
    setUpdating(true);
    try {
      await updateDealStatusAction(dealId, newStatus);
      const newLabel = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
      toast.success(`Status updated to ${newLabel}`);
      onStatusChange?.(newStatus);
      router.refresh();
    } catch (err) {
      toast.error("Failed to update status");
      console.error(err);
    } finally {
      setUpdating(false);
    }
  }

  function handleSelect(status: string) {
    if (TERMINAL_STATUSES.has(status)) {
      setConfirmStatus(status);
    } else {
      applyStatus(status);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={updating}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${colors.bg} ${colors.text} hover:opacity-80 disabled:opacity-50`}
          >
            {updating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              label
            )}
            <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {STATUSES.filter((s) => s !== currentStatus).map((status) => {
            const sc = STATUS_COLORS[status];
            return (
              <DropdownMenuItem
                key={status}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(status);
                }}
                className="cursor-pointer gap-2"
              >
                <span
                  className={`inline-block h-2 w-2 rounded-full ${sc.dot}`}
                />
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirmStatus !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmStatus(null);
        }}
      >
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Change status to{" "}
              {confirmStatus
                ? confirmStatus.charAt(0).toUpperCase() +
                  confirmStatus.slice(1)
                : ""}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This marks the deal as{" "}
              {confirmStatus ?? ""}. You can change it back
              later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              onClick={() => {
                if (confirmStatus) {
                  applyStatus(confirmStatus);
                }
                setConfirmStatus(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
