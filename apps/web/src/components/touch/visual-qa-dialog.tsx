"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface VisualQADialogProps {
  open: boolean;
  onConfirm: (enableVisualQA: boolean) => void;
  onCancel: () => void;
}

/**
 * Dialog shown before deck generation to let the user choose
 * whether to enable post-modification Visual QA.
 *
 * Visual QA runs autofit + vision-based overlap detection on
 * modified slides and adds ~30-60 seconds to generation time.
 */
export function VisualQADialog({ open, onConfirm, onCancel }: VisualQADialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Enable Visual Quality Check?</AlertDialogTitle>
          <AlertDialogDescription>
            Visual QA automatically checks each slide for text overflow and
            layout issues after content is placed, then applies corrections.
            This adds roughly 30-60 seconds to generation but produces
            cleaner results.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onConfirm(false)}>
            Skip
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(true)}>
            Enable Visual QA
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
