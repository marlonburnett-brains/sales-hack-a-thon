/**
 * Per-Deal Drive Folder Management
 *
 * Creates and manages per-deal subfolders in the shared Lumenalta Drive folder.
 * Each deal gets a named folder for storing generated presentations and assets.
 *
 * Pattern: idempotent getOrCreate — safe to call multiple times for the same deal.
 * All Drive API calls use supportsAllDrives: true for Shared Drive compatibility.
 */

import { getDriveClient } from "./google-auth";

/**
 * Get or create a per-deal folder in the shared Lumenalta Drive.
 *
 * Folder naming convention: "${companyName} - ${dealName}"
 * Idempotent: returns existing folder ID if already created.
 */
export async function getOrCreateDealFolder(params: {
  companyName: string;
  dealName: string;
  parentFolderId: string;
}): Promise<string> {
  const drive = getDriveClient();
  const folderName = `${params.companyName} - ${params.dealName}`;

  // Check if folder already exists (idempotent)
  const existing = await drive.files.list({
    q: `'${params.parentFolderId}' in parents and name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (existing.data.files?.length) {
    return existing.data.files[0].id!;
  }

  // Create the per-deal folder
  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [params.parentFolderId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  console.log(`[drive-folders] Created deal folder: ${folderName} (${created.data.id})`);
  return created.data.id!;
}

/**
 * Make a Drive file publicly viewable (anyone with the link can view).
 *
 * Required for Google Slides iframe preview to work — service-account-created
 * presentations default to private access. The /preview URL needs at least
 * read access for the viewer.
 */
export async function makePubliclyViewable(fileId: string): Promise<void> {
  const drive = getDriveClient();
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
    supportsAllDrives: true,
  });
}
