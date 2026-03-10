/**
 * Deck Customizer & Cross-Presentation Assembly
 *
 * Provides two core capabilities:
 *   1. applyDeckCustomizations() — Inject salesperson/customer branding
 *      into generated decks via Google Slides batchUpdate
 *   2. assembleDeckFromSlides() — Create a deck from selected slides using
 *      the "copy entire source, delete unwanted" strategy
 *
 * This module is Touch-agnostic: it accepts generic parameters and is
 * consumed by Touch 2, Touch 3, and later Phase 8 workflows.
 *
 * Key patterns:
 *   - Template merge via replaceAllText + replaceAllShapesWithImage
 *   - Cross-presentation assembly via copy-and-prune strategy
 *   - Image URLs must be publicly accessible for Slides API
 *   - supportsAllDrives: true on all Drive API calls
 */

import { getDriveClient, getSlidesClient, type GoogleAuthOptions } from "./google-auth";
import { shareWithOrg } from "./drive-folders";
import type { slides_v1 } from "googleapis";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface DeckCustomizations {
  /** Salesperson display name */
  salespersonName?: string;
  /** Publicly accessible URL for salesperson headshot */
  salespersonPhotoUrl?: string;
  /** Customer/prospect company name */
  customerName?: string;
  /** Publicly accessible URL for customer logo */
  customerLogoUrl?: string;
}

export interface AssembleDeckParams {
  /** Source presentation to copy from */
  sourcePresentationId: string;
  /** Slide objectIds to keep from the source presentation */
  selectedSlideIds: string[];
  /** Desired slide order (by objectId) */
  slideOrder: string[];
  /** Target Drive folder for the assembled deck */
  targetFolderId: string;
  /** Name for the new presentation */
  deckName: string;
  /** Optional branding customizations */
  customizations?: DeckCustomizations;
  /** Optional auth options (pooled user token) */
  authOptions?: GoogleAuthOptions;
}

export interface AssembleDeckResult {
  /** ID of the created presentation */
  presentationId: string;
  /** Direct Drive URL to the presentation */
  driveUrl: string;
}

// ────────────────────────────────────────────────────────────
// Public API: Deck Customization
// ────────────────────────────────────────────────────────────

/**
 * Apply salesperson and customer branding customizations to a presentation.
 *
 * Uses Google Slides batchUpdate with:
 *   - replaceAllText for text placeholders ({{salesperson-name}}, {{customer-name}})
 *   - replaceAllShapesWithImage for image placeholders ({{salesperson-photo}}, {{customer-logo}})
 *
 * IMPORTANT: Image URLs must be publicly accessible. If a photo/logo is stored
 * in Google Drive, it must have "anyone with the link" sharing enabled, or use
 * the authenticated URL pattern: https://www.googleapis.com/drive/v3/files/{id}?alt=media
 *
 * @param params - Presentation ID and customization values
 */
export async function applyDeckCustomizations(params: {
  presentationId: string;
  salespersonName?: string;
  salespersonPhotoUrl?: string;
  customerName?: string;
  customerLogoUrl?: string;
}): Promise<void> {
  const slides = getSlidesClient();
  const requests: slides_v1.Schema$Request[] = [];

  // Text replacements
  if (params.salespersonName) {
    requests.push({
      replaceAllText: {
        containsText: { text: "{{salesperson-name}}", matchCase: true },
        replaceText: params.salespersonName,
      },
    });
  }

  if (params.customerName) {
    requests.push({
      replaceAllText: {
        containsText: { text: "{{customer-name}}", matchCase: true },
        replaceText: params.customerName,
      },
    });
  }

  // Image replacements
  // Note per Pitfall 1 from research: image URLs must be publicly accessible.
  // If the URL is a Drive file ID, the caller should ensure "anyone with link" sharing
  // or construct the public URL before passing it here.
  if (params.salespersonPhotoUrl) {
    requests.push({
      replaceAllShapesWithImage: {
        imageUrl: params.salespersonPhotoUrl,
        imageReplaceMethod: "CENTER_INSIDE",
        containsText: {
          text: "{{salesperson-photo}}",
          matchCase: true,
        },
      },
    });
  }

  if (params.customerLogoUrl) {
    requests.push({
      replaceAllShapesWithImage: {
        imageUrl: params.customerLogoUrl,
        imageReplaceMethod: "CENTER_INSIDE",
        containsText: { text: "{{customer-logo}}", matchCase: true },
      },
    });
  }

  // Execute batch update if there are any requests
  if (requests.length > 0) {
    await slides.presentations.batchUpdate({
      presentationId: params.presentationId,
      requestBody: { requests },
    });
  }
}

// ────────────────────────────────────────────────────────────
// Public API: Cross-Presentation Assembly
// ────────────────────────────────────────────────────────────

/**
 * Assemble a deck from selected slides using the "copy and prune" strategy.
 *
 * Strategy (per Research recommendation for single-source assembly):
 *   1. Copy the entire source presentation to the target folder via Drive files.copy
 *   2. Read all slides from the copy via presentations.get
 *   3. Identify slides to keep (matching selectedSlideIds by objectId)
 *   4. Delete slides NOT in the selected list via batchUpdate deleteObject
 *   5. Reorder remaining slides to match slideOrder via updateSlidesPosition
 *   6. Apply customizations via applyDeckCustomizations
 *   7. Make publicly viewable for iframe preview
 *
 * MULTI-SOURCE LIMITATION:
 * This function handles the single-source "copy and prune" approach which covers
 * 90% of cases. For multi-source assembly (Touch 3 with slides from multiple
 * source presentations), the caller should:
 *   1. Use this function with the primary source as the base
 *   2. For slides from additional sources, manually add content via the Slides API
 *      (createSlide + insertText requests)
 * Full multi-source merging is documented but deferred to Phase 8 if needed.
 *
 * @param params - Assembly parameters including source, selection, and customizations
 * @returns Presentation ID and Drive URL of the assembled deck
 */
export async function assembleDeckFromSlides(
  params: AssembleDeckParams
): Promise<AssembleDeckResult> {
  const drive = getDriveClient(params.authOptions);
  const slides = getSlidesClient(params.authOptions);

  // Step 1: Copy the source presentation to the target folder
  const copy = await drive.files.copy({
    fileId: params.sourcePresentationId,
    requestBody: {
      name: params.deckName,
      parents: [params.targetFolderId],
    },
    supportsAllDrives: true,
  });
  const presentationId = copy.data.id!;

  // Step 2: Read all slides from the copy
  const presentation = await slides.presentations.get({
    presentationId,
  });
  const allSlides = presentation.data.slides ?? [];

  // Step 3: Identify slides to keep and delete
  // Match by objectId -- the selectedSlideIds should contain objectIds
  // from the source presentation (which are preserved in the copy)
  const selectedSet = new Set(params.selectedSlideIds);
  const slidesToDelete: string[] = [];
  const slidesToKeep: string[] = [];

  for (const slide of allSlides) {
    const objectId = slide.objectId;
    if (!objectId) continue;

    if (selectedSet.has(objectId)) {
      slidesToKeep.push(objectId);
    } else {
      slidesToDelete.push(objectId);
    }
  }

  // Step 4: Delete unselected slides
  if (slidesToDelete.length > 0) {
    const deleteRequests: slides_v1.Schema$Request[] = slidesToDelete.map(
      (objectId) => ({
        deleteObject: { objectId },
      })
    );

    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests: deleteRequests },
    });
  }

  // Step 5: Reorder remaining slides to match slideOrder
  // updateSlidesPosition moves slides to a specific index
  // Process in reverse order to build the correct sequence
  if (params.slideOrder.length > 0) {
    const reorderRequests: slides_v1.Schema$Request[] = [];

    // Move each slide to its target position (0-based index)
    for (let targetIndex = 0; targetIndex < params.slideOrder.length; targetIndex++) {
      const slideId = params.slideOrder[targetIndex];
      // Only reorder slides that exist in the deck
      if (slidesToKeep.includes(slideId)) {
        reorderRequests.push({
          updateSlidesPosition: {
            slideObjectIds: [slideId],
            insertionIndex: targetIndex,
          },
        });
      }
    }

    if (reorderRequests.length > 0) {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests: reorderRequests },
      });
    }
  }

  // Step 6: Apply customizations
  if (params.customizations) {
    await applyDeckCustomizations({
      presentationId,
      salespersonName: params.customizations.salespersonName,
      salespersonPhotoUrl: params.customizations.salespersonPhotoUrl,
      customerName: params.customizations.customerName,
      customerLogoUrl: params.customizations.customerLogoUrl,
    });
  }

  // Step 7: Share with org (domain-wide viewer access)
  await shareWithOrg({ fileId: presentationId });

  const driveUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;

  return {
    presentationId,
    driveUrl,
  };
}
