"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { rollbackAction } from "@/lib/actions/agent-config-actions";

interface RollbackDialogProps {
  agentId: string;
  currentVersion: number;
  targetVersion: number;
  onRolledBack: () => void;
  onCancel: () => void;
}

export function RollbackDialog({
  agentId,
  currentVersion,
  targetVersion,
  onRolledBack,
  onCancel,
}: RollbackDialogProps) {
  const [isRollingBack, startRollbackTransition] = useTransition();

  function handleRollback() {
    startRollbackTransition(async () => {
      try {
        await rollbackAction(agentId, { targetVersion });
        toast.success(`Rolled back to v${targetVersion}`);
        onRolledBack();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to rollback",
        );
      }
    });
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Rollback to v{targetVersion}</AlertDialogTitle>
          <AlertDialogDescription>
            This will create a new version with v{targetVersion}&apos;s prompt
            content and publish it immediately. The current live version is v
            {currentVersion}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <Button
            onClick={handleRollback}
            disabled={isRollingBack}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isRollingBack && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            Rollback &amp; Publish
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
