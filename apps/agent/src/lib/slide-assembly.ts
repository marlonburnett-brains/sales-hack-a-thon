/**
 * Template Merge Slide Assembly Engine
 *
 * REUSABLE module for all deck generation (Touch 1, 2, 3, and Phase 8).
 * No touch-specific logic — accepts generic template parameters.
 *
 * Pattern: Copy branded template via Drive API, then customize with
 * Slides API batchUpdate (replaceAllText + replaceAllShapesWithImage).
 *
 * Tags in templates use {{tag-name}} format (matchCase: true).
 * After assembly, the deck is made publicly viewable for iframe preview.
 */

import type { slides_v1 } from "googleapis";
import { getDriveClient, getSlidesClient } from "./google-auth";
import { makePubliclyViewable } from "./drive-folders";

export interface AssemblyParams {
  /** Source template presentation ID to copy from */
  templateId: string;
  /** Target Drive folder ID for the new presentation */
  targetFolderId: string;
  /** Name for the generated deck */
  deckName: string;
  /** Text replacements: { "{{tag}}": "value" } */
  textReplacements: Record<string, string>;
  /** Image replacements: { "{{image-tag}}": "publicImageUrl" } */
  imageReplacements?: Record<string, string>;
}

export interface AssemblyResult {
  /** Google Slides presentation ID */
  presentationId: string;
  /** Direct edit URL for the generated deck */
  driveUrl: string;
}

/**
 * Assemble a deck from a branded template using the template merge pattern.
 *
 * Steps:
 * 1. Copy template to target folder via Drive API (supportsAllDrives)
 * 2. Build batchUpdate requests (text + image replacements)
 * 3. Execute batchUpdate on the copy
 * 4. Make the copy publicly viewable for iframe preview
 *
 * This is the REUSABLE module that Phase 8 will extend.
 * Keep it generic — no touch-specific logic.
 */
export async function assembleFromTemplate(
  params: AssemblyParams
): Promise<AssemblyResult> {
  const drive = getDriveClient();
  const slides = getSlidesClient();

  // Step 1: Copy template to the per-deal folder
  const copy = await drive.files.copy({
    fileId: params.templateId,
    requestBody: {
      name: params.deckName,
      parents: [params.targetFolderId],
    },
    supportsAllDrives: true,
  });
  const presentationId = copy.data.id!;

  // Step 2: Build batchUpdate requests
  const requests: slides_v1.Schema$Request[] = [];

  // Text replacements (e.g., {{company-name}} -> "Acme Corp")
  for (const [tag, value] of Object.entries(params.textReplacements)) {
    requests.push({
      replaceAllText: {
        containsText: { text: tag, matchCase: true },
        replaceText: value,
      },
    });
  }

  // Image replacements (e.g., {{company-logo}} -> public image URL)
  if (params.imageReplacements) {
    for (const [tag, imageUrl] of Object.entries(params.imageReplacements)) {
      requests.push({
        replaceAllShapesWithImage: {
          imageUrl,
          imageReplaceMethod: "CENTER_INSIDE",
          containsText: { text: tag, matchCase: true },
        },
      });
    }
  }

  // Step 3: Execute batch update if there are any replacements
  if (requests.length > 0) {
    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests },
    });
  }

  // Step 4: Make publicly viewable for iframe preview
  await makePubliclyViewable(presentationId);

  return {
    presentationId,
    driveUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
  };
}
