"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FolderOpen, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getDriveRootFolder,
  setDriveRootFolder,
} from "@/lib/actions/settings-actions";
import { DriveFolderPicker } from "@/components/settings/drive-folder-picker";

interface FolderState {
  folderId: string | null;
  folderName: string | null;
}

export default function DriveSettingsPage() {
  const [folder, setFolder] = useState<FolderState>({
    folderId: null,
    folderName: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);

        const result = await getDriveRootFolder(user.id);
        setFolder(result);
      } catch (err) {
        console.error("Failed to load drive settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleFolderSelect = useCallback(
    async (selected: { id: string; name: string }) => {
      if (!userId) return;
      setSaving(true);
      try {
        await setDriveRootFolder(userId, selected.id, selected.name);
        setFolder({ folderId: selected.id, folderName: selected.name });
        toast.success("Drive folder updated", {
          description: `Root folder set to "${selected.name}"`,
        });
      } catch (err) {
        console.error("Failed to save drive folder:", err);
        toast.error("Failed to save folder selection");
      } finally {
        setSaving(false);
      }
    },
    [userId],
  );

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">
        Google Drive
      </h2>
      <p className="mb-6 text-sm text-slate-500">
        Choose the Google Drive folder where generated deal artifacts will be
        saved. Each deal gets a subfolder automatically.
      </p>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-4">
          <h3 className="text-sm font-medium text-slate-700">
            Root Folder
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            All generated presentations, talk tracks, and other deal artifacts
            will be organized under this folder.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading settings...
          </div>
        ) : (
          <div className="space-y-4">
            {/* Current folder display */}
            <div className="flex items-center gap-3 rounded-md border border-slate-100 bg-slate-50 px-4 py-3">
              <FolderOpen className="h-5 w-5 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {folder.folderName || "Not configured"}
                </p>
                {folder.folderId ? (
                  <p className="text-xs text-slate-500">
                    ID: {folder.folderId}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Using system default folder
                  </p>
                )}
              </div>
            </div>

            {/* Picker */}
            <div className="flex items-center gap-3">
              <DriveFolderPicker
                onSelect={handleFolderSelect}
                currentFolder={
                  folder.folderId && folder.folderName
                    ? { id: folder.folderId, name: folder.folderName }
                    : null
                }
              />
              {saving && (
                <span className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
