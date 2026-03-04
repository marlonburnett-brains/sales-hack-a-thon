/**
 * Drive Content Discovery
 *
 * Recursively discovers all Google Slides presentations in the
 * Hack-a-thon Drive folder. Handles pagination, shared drives,
 * subfolder traversal, and Google Drive shortcut resolution.
 *
 * Key insight: The Hack-a-thon Drive folder contains mostly shortcuts
 * (application/vnd.google-apps.shortcut) pointing to presentations stored
 * in other Shared Drives or personal drives. This module resolves shortcuts
 * to their target presentation IDs, though the service account may not have
 * access to all target files.
 */

import { getDriveClient } from "../lib/google-auth";
import type { drive_v3 } from "googleapis";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface DrivePresentation {
  /** The presentation ID to use with Slides API. For shortcuts, this is the target ID. */
  id: string;
  name: string;
  mimeType: string;
  /** Slash-separated path of parent folder names (e.g., "02 Decks/Touch 2") */
  folderPath: string;
  /** Whether this was discovered via a Drive shortcut */
  isShortcut: boolean;
  /** The original shortcut file ID (if isShortcut) */
  shortcutId?: string;
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
const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";
const RATE_LIMIT_DELAY = 200; // ms between API calls

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * List all Google Slides presentations in a single folder (non-recursive).
 * Includes both direct presentations AND shortcuts to presentations.
 * Handles pagination via nextPageToken.
 */
async function listPresentationsInFolder(
  folderId: string,
  currentPath: string
): Promise<DrivePresentation[]> {
  const drive = getDriveClient();
  const presentations: DrivePresentation[] = [];
  const seenIds = new Set<string>();

  // 1. Find direct presentations
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
      if (!seenIds.has(file.id!)) {
        seenIds.add(file.id!);
        presentations.push({
          id: file.id!,
          name: file.name!,
          mimeType: file.mimeType!,
          folderPath: currentPath,
          isShortcut: false,
        });
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
    if (pageToken) await delay(RATE_LIMIT_DELAY);
  } while (pageToken);

  await delay(RATE_LIMIT_DELAY);

  // 2. Find shortcuts to presentations
  pageToken = undefined;
  do {
    const response: { data: drive_v3.Schema$FileList } = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = '${SHORTCUT_MIME}' and trashed = false`,
      fields:
        "nextPageToken, files(id, name, mimeType, shortcutDetails)",
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken,
    });

    for (const file of response.data.files ?? []) {
      const details = file.shortcutDetails;
      if (
        details?.targetMimeType === PRESENTATION_MIME &&
        details.targetId &&
        !seenIds.has(details.targetId)
      ) {
        seenIds.add(details.targetId);
        presentations.push({
          id: details.targetId,
          name: file.name!,
          mimeType: PRESENTATION_MIME,
          folderPath: currentPath,
          isShortcut: true,
          shortcutId: file.id!,
        });
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
    if (pageToken) await delay(RATE_LIMIT_DELAY);
  } while (pageToken);

  return presentations;
}

/**
 * List all subfolders in a given folder.
 * Also resolves folder shortcuts.
 * Handles pagination via nextPageToken.
 */
async function listSubfolders(folderId: string): Promise<DriveFolder[]> {
  const drive = getDriveClient();
  const folders: DriveFolder[] = [];
  const seenIds = new Set<string>();

  // Direct folders
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
      if (!seenIds.has(file.id!)) {
        seenIds.add(file.id!);
        folders.push({ id: file.id!, name: file.name! });
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
    if (pageToken) await delay(RATE_LIMIT_DELAY);
  } while (pageToken);

  // Folder shortcuts are already handled above (shortcutDetails.targetMimeType check)
  // But we also need to find shortcuts to folders
  await delay(RATE_LIMIT_DELAY);
  pageToken = undefined;
  do {
    const response: { data: drive_v3.Schema$FileList } = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = '${SHORTCUT_MIME}' and trashed = false`,
      fields: "nextPageToken, files(id, name, shortcutDetails)",
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken,
    });

    for (const file of response.data.files ?? []) {
      const details = file.shortcutDetails;
      if (
        details?.targetMimeType === FOLDER_MIME &&
        details.targetId &&
        !seenIds.has(details.targetId)
      ) {
        seenIds.add(details.targetId);
        folders.push({ id: details.targetId, name: file.name! });
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
    if (pageToken) await delay(RATE_LIMIT_DELAY);
  } while (pageToken);

  return folders;
}

/**
 * Recursively discover all Google Slides presentations in the given
 * Drive folder and all its subfolders.
 *
 * Handles:
 * - Direct presentation files
 * - Shortcuts to presentations (resolves to target ID)
 * - Shortcuts to folders (recursively traverses target)
 * - Pagination on all API calls
 * - Rate limiting (200ms between calls)
 * - Deduplication (same target ID found via multiple paths)
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
  const seenPresentationIds = new Set<string>();

  // List presentations (direct + shortcuts) in this folder
  const presentations = await listPresentationsInFolder(folderId, currentPath);
  for (const pres of presentations) {
    if (!seenPresentationIds.has(pres.id)) {
      seenPresentationIds.add(pres.id);
      results.push(pres);
    }
  }

  await delay(RATE_LIMIT_DELAY);

  // Recursively traverse subfolders (direct + shortcut folders)
  let subfolders: DriveFolder[];
  try {
    subfolders = await listSubfolders(folderId);
  } catch (error) {
    // May not have access to some folders (especially shortcut targets)
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`  WARNING: Could not list subfolders of ${folderId}: ${msg}`);
    subfolders = [];
  }

  for (const folder of subfolders) {
    // Skip our own ingestion folder to avoid infinite recursion
    if (folder.name === "_slide-level-ingestion") continue;

    await delay(RATE_LIMIT_DELAY);
    const subPath = currentPath
      ? `${currentPath}/${folder.name}`
      : folder.name;
    console.log(`  Scanning folder: ${subPath}`);

    try {
      const subResults = await discoverPresentations(folder.id, subPath);
      for (const pres of subResults) {
        if (!seenPresentationIds.has(pres.id)) {
          seenPresentationIds.add(pres.id);
          results.push(pres);
        }
      }
    } catch (error) {
      // May not have access to some shortcut target folders
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(
        `  WARNING: Could not scan folder "${subPath}": ${msg}`
      );
    }
  }

  return results;
}
