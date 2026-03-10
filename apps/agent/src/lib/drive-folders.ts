/**
 * Per-Deal Drive Folder Management
 *
 * Creates and manages per-deal subfolders in the shared Lumenalta Drive folder.
 * Each deal gets a named folder for storing generated presentations and assets.
 *
 * Pattern: idempotent getOrCreate -- safe to call multiple times for the same deal.
 * All Drive API calls use supportsAllDrives: true for Shared Drive compatibility.
 */

import { getDriveClient } from "./google-auth";
import { prisma } from "./db";
import { env } from "../env";

/**
 * Resolve the root Drive folder ID for a given user.
 *
 * Priority:
 * 1. UserSetting "drive_root_folder_id" for this userId (if set)
 * 2. GOOGLE_DRIVE_FOLDER_ID env var fallback
 *
 * Returns empty string if neither is configured.
 */
export async function resolveRootFolderId(userId?: string): Promise<string> {
  if (userId) {
    const setting = await prisma.userSetting.findUnique({
      where: { userId_key: { userId, key: "drive_root_folder_id" } },
    });
    if (setting?.value) {
      return setting.value;
    }
  }
  return env.GOOGLE_DRIVE_FOLDER_ID;
}

/**
 * Share a Drive file/folder with the Lumenalta org.
 *
 * Replaces the old makePubliclyViewable pattern with org-scoped access:
 * - Domain-wide viewer access for @lumenalta.com
 * - Deal owner gets editor access (if ownerEmail provided)
 * - Service account already has access as file creator
 *
 * All calls use sendNotificationEmail: false per Drive API best practices.
 */
export async function shareWithOrg(params: {
  fileId: string;
  ownerEmail?: string;
}): Promise<void> {
  const drive = getDriveClient();

  // Grant @lumenalta.com domain-wide viewer access
  await drive.permissions.create({
    fileId: params.fileId,
    requestBody: {
      type: "domain",
      domain: "lumenalta.com",
      role: "reader",
    },
    supportsAllDrives: true,
    sendNotificationEmail: false,
  });

  // Grant deal owner editor access (if provided)
  if (params.ownerEmail) {
    await drive.permissions.create({
      fileId: params.fileId,
      requestBody: {
        type: "user",
        emailAddress: params.ownerEmail,
        role: "writer",
      },
      supportsAllDrives: true,
      sendNotificationEmail: false,
    });
  }
}

/**
 * Share a newly created file with org + service account.
 *
 * Called right after files.copy using the CALLER's auth (pool user owns the file).
 * Grants:
 * - Domain-wide reader access for @lumenalta.com
 * - Service account writer access (so SA can manage the file later)
 * - Deal owner editor access (if ownerEmail provided)
 */
export async function shareNewFile(params: {
  fileId: string;
  drive: ReturnType<typeof getDriveClient>;
  ownerEmail?: string;
}): Promise<void> {
  const { drive, fileId } = params;
  const saCredentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);

  // Grant org-wide reader access
  await drive.permissions.create({
    fileId,
    requestBody: {
      type: "domain",
      domain: "lumenalta.com",
      role: "reader",
    },
    supportsAllDrives: true,
    sendNotificationEmail: false,
  });

  // Grant service account writer access
  await drive.permissions.create({
    fileId,
    requestBody: {
      type: "user",
      emailAddress: saCredentials.client_email,
      role: "writer",
    },
    supportsAllDrives: true,
    sendNotificationEmail: false,
  });

  // Grant deal owner editor access (if provided)
  if (params.ownerEmail) {
    await drive.permissions.create({
      fileId,
      requestBody: {
        type: "user",
        emailAddress: params.ownerEmail,
        role: "writer",
      },
      supportsAllDrives: true,
      sendNotificationEmail: false,
    });
  }
}

/**
 * Get or create a subfolder inside a parent folder.
 *
 * Generic idempotent helper used for "Archive" and other subfolders.
 * Same check-before-create pattern as getOrCreateDealFolder.
 */
export async function getOrCreateSubfolder(
  parentFolderId: string,
  folderName: string,
): Promise<string> {
  const drive = getDriveClient();

  // Check if subfolder already exists (idempotent)
  const existing = await drive.files.list({
    q: `'${parentFolderId}' in parents and name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (existing.data.files?.length) {
    return existing.data.files[0].id!;
  }

  // Create the subfolder
  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  console.log(
    `[drive-folders] Created subfolder: ${folderName} in ${parentFolderId} (${created.data.id})`,
  );
  return created.data.id!;
}

/**
 * Archive an existing file by moving it into an "Archive" subfolder.
 *
 * Creates the Archive subfolder inside the deal folder if it doesn't exist,
 * then moves the file from the deal folder into Archive using addParents/removeParents.
 */
export async function archiveExistingFile(params: {
  dealFolderId: string;
  fileId: string;
}): Promise<void> {
  const drive = getDriveClient();
  const archiveFolderId = await getOrCreateSubfolder(
    params.dealFolderId,
    "Archive",
  );

  await drive.files.update({
    fileId: params.fileId,
    addParents: archiveFolderId,
    removeParents: params.dealFolderId,
    supportsAllDrives: true,
  });

  console.log(
    `[drive-folders] Archived file ${params.fileId} to Archive in ${params.dealFolderId}`,
  );
}

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

  console.log(
    `[drive-folders] Created deal folder: ${folderName} (${created.data.id})`,
  );
  return created.data.id!;
}

