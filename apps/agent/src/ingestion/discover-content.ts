/**
 * Drive Content Discovery
 *
 * Recursively discovers all Google Slides presentations in the
 * Hack-a-thon Drive folder. Handles pagination, shared drives,
 * and subfolder traversal.
 */

import { getDriveClient } from "../lib/google-auth";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface DrivePresentation {
  id: string;
  name: string;
  mimeType: string;
  /** Slash-separated path of parent folder names (e.g., "02 Decks/Touch 2") */
  folderPath: string;
}

interface DriveFolder {
  id: string;
  name: string;
}

// ────────────────────────────────────────────────────────────
// Implementation
// ────────────────────────────────────────────────────────────

const PRESENTATION_MIME = "application/vnd.google-apps.presentation";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const RATE_LIMIT_DELAY = 200; // ms between API calls

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * List all Google Slides presentations in a single folder (non-recursive).
 * Handles pagination via nextPageToken.
 */
async function listPresentationsInFolder(
  folderId: string
): Promise<Array<{ id: string; name: string; mimeType: string }>> {
  const drive = getDriveClient();
  const presentations: Array<{ id: string; name: string; mimeType: string }> =
    [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = '${PRESENTATION_MIME}' and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType)",
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken,
    });

    for (const file of response.data.files ?? []) {
      presentations.push({
        id: file.id!,
        name: file.name!,
        mimeType: file.mimeType!,
      });
    }

    pageToken = response.data.nextPageToken ?? undefined;

    if (pageToken) {
      await delay(RATE_LIMIT_DELAY);
    }
  } while (pageToken);

  return presentations;
}

/**
 * List all subfolders in a given folder.
 * Handles pagination via nextPageToken.
 */
async function listSubfolders(folderId: string): Promise<DriveFolder[]> {
  const drive = getDriveClient();
  const folders: DriveFolder[] = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
      fields: "nextPageToken, files(id, name)",
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken,
    });

    for (const file of response.data.files ?? []) {
      folders.push({
        id: file.id!,
        name: file.name!,
      });
    }

    pageToken = response.data.nextPageToken ?? undefined;

    if (pageToken) {
      await delay(RATE_LIMIT_DELAY);
    }
  } while (pageToken);

  return folders;
}

/**
 * Recursively discover all Google Slides presentations in the given
 * Drive folder and all its subfolders.
 *
 * @param folderId - The root Google Drive folder ID to scan
 * @param currentPath - The current folder path (for building folderPath)
 * @returns Array of DrivePresentation with full folder paths
 */
export async function discoverPresentations(
  folderId: string,
  currentPath: string = ""
): Promise<DrivePresentation[]> {
  const results: DrivePresentation[] = [];

  // List presentations in this folder
  const presentations = await listPresentationsInFolder(folderId);
  for (const pres of presentations) {
    results.push({
      id: pres.id,
      name: pres.name,
      mimeType: pres.mimeType,
      folderPath: currentPath,
    });
  }

  await delay(RATE_LIMIT_DELAY);

  // Recursively traverse subfolders
  const subfolders = await listSubfolders(folderId);
  for (const folder of subfolders) {
    await delay(RATE_LIMIT_DELAY);
    const subPath = currentPath ? `${currentPath}/${folder.name}` : folder.name;
    console.log(`  Scanning folder: ${subPath}`);
    const subResults = await discoverPresentations(folder.id, subPath);
    results.push(...subResults);
  }

  return results;
}
