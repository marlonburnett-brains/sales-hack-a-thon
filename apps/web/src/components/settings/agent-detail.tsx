"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AgentPromptEditor } from "@/components/settings/agent-prompt-editor";
import { PublishDialog } from "@/components/settings/publish-dialog";
import {
  discardDraftAction,
  type AgentConfigDetail as AgentConfigDetailType,
  type AgentConfigVersionItem,
} from "@/lib/actions/agent-config-actions";

interface AgentDetailProps {
  config: AgentConfigDetailType;
  versions: AgentConfigVersionItem[];
}

const FAMILY_DISPLAY_NAMES: Record<string, string> = {
  "pre-call": "Pre-Call",
  "touch-1": "Touch 1",
  "touch-4": "Touch 4",
  "deck-selection": "Deck Selection",
  "deck-intelligence": "Deck Intelligence",
  ingestion: "Ingestion",
  "knowledge-extraction": "Knowledge Extraction",
  validation: "Validation",
};

export function AgentDetail({ config, versions }: AgentDetailProps) {
  const router = useRouter();
  const [isDiscarding, startDiscardTransition] = useTransition();
  const [showPublishDialog, setShowPublishDialog] = useState(false);

  const familyLabel = FAMILY_DISPLAY_NAMES[config.family] ?? config.family;

  function handleDiscard() {
    startDiscardTransition(async () => {
      try {
        await discardDraftAction(config.agentId);
        toast.success("Draft discarded");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to discard draft",
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-slate-900">
            {config.name}
          </h2>
          <Badge
            variant="secondary"
            className="text-xs font-normal"
          >
            {familyLabel}
          </Badge>
        </div>
        <p className="text-sm text-slate-500">{config.responsibility}</p>
      </div>

      {/* Draft publish bar */}
      {config.draft && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">
            You have unpublished changes
          </p>
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isDiscarding}
                  className="border-amber-300 text-amber-800 hover:bg-amber-100"
                >
                  {isDiscarding ? "Discarding..." : "Discard Draft"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Discard Draft?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your unpublished changes. The
                    current published version will remain active.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDiscard}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Discard Draft
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              size="sm"
              onClick={() => setShowPublishDialog(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Publish
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="prompts">
        <TabsList>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="prompts" className="mt-4">
          <AgentPromptEditor
            agentId={config.agentId}
            baselinePrompt={config.publishedVersion?.baselinePrompt ?? ""}
            rolePrompt={config.publishedVersion?.rolePrompt ?? ""}
            draftRolePrompt={config.draft?.rolePrompt}
            publishedVersion={config.publishedVersion?.version ?? 0}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Version history coming soon
          </div>
        </TabsContent>
      </Tabs>

      {/* Publish dialog */}
      {showPublishDialog && config.publishedVersion && config.draft && (
        <PublishDialog
          agentId={config.agentId}
          currentRolePrompt={config.publishedVersion.rolePrompt}
          draftRolePrompt={config.draft.rolePrompt}
          onPublished={() => {
            setShowPublishDialog(false);
            router.refresh();
          }}
          onCancel={() => setShowPublishDialog(false)}
        />
      )}
    </div>
  );
}
