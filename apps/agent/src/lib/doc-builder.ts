/**
 * Google Docs Document Builder
 *
 * Shared utilities for creating structured Google Docs with headings,
 * paragraphs, and bold text formatting. Used by the Talk Track and
 * Buyer FAQ workflow steps in Phase 8.
 *
 * Pattern: Create doc -> move to folder -> insert all text -> apply styles
 * in a single batchUpdate. This avoids index drift from incremental inserts.
 */

import type { docs_v1 } from "googleapis";
import { getDocsClient } from "./google-auth";
import { getDriveClient } from "./google-auth";
import { shareWithOrg } from "./drive-folders";

export interface DocSection {
  heading: string;
  headingLevel: "HEADING_1" | "HEADING_2";
  body: string;
  boldRanges?: Array<{ start: number; end: number }>;
}

/**
 * Build Google Docs API batchUpdate requests for a list of sections.
 *
 * Strategy: Build all text as a single string, then compute absolute indices
 * for heading styles and bold formatting. Requests are returned in reverse
 * index order so that applying them sequentially does not shift indices.
 *
 * @param sections - Document sections with headings, body text, and optional bold ranges
 * @returns Array of Docs API requests ready for batchUpdate
 */
export function buildDocRequests(
  sections: DocSection[]
): docs_v1.Schema$Request[] {
  // Phase 1: Build the full document text and track boundaries
  const boundaries: Array<{
    headingStart: number;
    headingEnd: number;
    headingLevel: "HEADING_1" | "HEADING_2";
    bodyStart: number;
    bodyEnd: number;
    boldRanges?: Array<{ start: number; end: number }>;
  }> = [];

  let fullText = "";

  for (const section of sections) {
    const headingStart = fullText.length;
    fullText += section.heading + "\n";
    const headingEnd = fullText.length;

    const bodyStart = fullText.length;
    fullText += section.body + "\n\n";
    const bodyEnd = fullText.length;

    boundaries.push({
      headingStart,
      headingEnd,
      headingLevel: section.headingLevel,
      bodyStart,
      bodyEnd,
      boldRanges: section.boldRanges,
    });
  }

  // Phase 2: Build requests
  const requests: docs_v1.Schema$Request[] = [];

  // Insert all text at index 1 (after the initial empty paragraph)
  requests.push({
    insertText: {
      location: { index: 1 },
      text: fullText,
    },
  });

  // Apply heading styles (offset by 1 for the insertion point)
  for (const boundary of boundaries) {
    requests.push({
      updateParagraphStyle: {
        range: {
          startIndex: boundary.headingStart + 1,
          endIndex: boundary.headingEnd + 1,
        },
        paragraphStyle: {
          namedStyleType: boundary.headingLevel,
        },
        fields: "namedStyleType",
      },
    });
  }

  // Apply bold ranges within body text (offset by 1)
  for (const boundary of boundaries) {
    if (boundary.boldRanges) {
      for (const bold of boundary.boldRanges) {
        requests.push({
          updateTextStyle: {
            range: {
              startIndex: boundary.bodyStart + bold.start + 1,
              endIndex: boundary.bodyStart + bold.end + 1,
            },
            textStyle: { bold: true },
            fields: "bold",
          },
        });
      }
    }
  }

  return requests;
}

/**
 * Create a Google Doc with structured sections in a Deal folder.
 *
 * @param params.title - Document title
 * @param params.dealFolderId - Target Drive folder ID
 * @param params.sections - Document content sections
 * @returns Document ID and URL
 */
export async function createGoogleDoc(params: {
  title: string;
  dealFolderId: string;
  sections: DocSection[];
}): Promise<{ documentId: string; docUrl: string }> {
  const docs = getDocsClient();
  const drive = getDriveClient();

  // 1. Create the document
  const doc = await docs.documents.create({
    requestBody: { title: params.title },
  });
  const documentId = doc.data.documentId!;

  // 2. Move to deal folder (remove from root, add to deal folder)
  await drive.files.update({
    fileId: documentId,
    addParents: params.dealFolderId,
    removeParents: "root",
    supportsAllDrives: true,
  });

  // 3. Build and execute content requests
  if (params.sections.length > 0) {
    const requests = buildDocRequests(params.sections);
    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });
  }

  // 4. Share with org (domain-wide viewer access)
  await shareWithOrg({ fileId: documentId });

  const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;
  return { documentId, docUrl };
}
