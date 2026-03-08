"use client";

import { useCallback, useEffect, useState } from "react";
import { DrivePicker, DrivePickerDocsView } from "@googleworkspace/drive-picker-react";
import { Button } from "@/components/ui/button";
import { Loader2, FolderOpen } from "lucide-react";
import { env } from "@/env";

interface DriveFolderPickerProps {
  onSelect: (folder: { id: string; name: string }) => void;
  currentFolder?: { id: string; name: string } | null;
}

export function DriveFolderPicker({
  onSelect,
  currentFolder,
}: DriveFolderPickerProps) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    async function fetchToken() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/drive/token");
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.error || `Failed to get access token (${res.status})`,
          );
        }
        const data = await res.json();
        setAccessToken(data.accessToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to get access token");
      } finally {
        setLoading(false);
      }
    }
    fetchToken();
  }, []);

  const handlePicked = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: CustomEvent<any>) => {
      const docs = e.detail?.docs as
        | Array<{ id: string; name: string }>
        | undefined;
      if (docs && docs.length > 0) {
        const folder = docs[0];
        onSelect({
          id: folder.id,
          name: folder.name,
        });
      }
      setPickerOpen(false);
    },
    [onSelect],
  );

  const handleCanceled = useCallback(() => {
    setPickerOpen(false);
  }, []);

  if (loading) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </Button>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-600">{error}</p>
        <p className="text-xs text-slate-500">
          Please ensure you are logged in with Google and have granted Drive
          access.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        className="gap-2 cursor-pointer"
        onClick={() => setPickerOpen(true)}
      >
        <FolderOpen className="h-4 w-4" />
        {currentFolder ? "Change Folder" : "Choose Folder"}
      </Button>

      {pickerOpen && accessToken && (
        <DrivePicker
          app-id={env.NEXT_PUBLIC_GOOGLE_CLIENT_ID.split("-")[0] || ""}
          client-id={env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}
          developer-key={env.NEXT_PUBLIC_GOOGLE_API_KEY}
          oauth-token={accessToken}
          onPicked={handlePicked}
          onCanceled={handleCanceled}
        >
          <DrivePickerDocsView
            mime-types="application/vnd.google-apps.folder"
            select-folder-enabled="true"
            include-folders="true"
            enable-drives="true"
          />
        </DrivePicker>
      )}
    </div>
  );
}
