/**
 * Post-Modification Visual QA — Autofit + Vision-based Overlap Detection
 *
 * After text modifications are applied to Google Slides, replacement text can
 * overflow bounding boxes or overlap adjacent elements. This module:
 *   1. Applies TEXT_AUTOFIT to all modified shapes (best-effort)
 *   2. Renders slide thumbnails and sends them to Gemini 3 Flash for vision check
 *   3. Runs up to 2 correction iterations if overlap/overflow issues are found
 */

import { GoogleGenAI } from "@google/genai";

import type { ModificationPlan } from "./modification-plan-schema";
import { getSlidesClient, type GoogleAuthOptions } from "../lib/google-auth";
import { env } from "../env";

const LOG_PREFIX = "[visual-qa]";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface VisualQAParams {
  presentationId: string;
  modifiedPlans: ModificationPlan[];
  authOptions?: GoogleAuthOptions;
}

export interface VisualQAResult {
  status: "clean" | "corrected" | "warning";
  iterations: number;
  issues?: string[];
}

interface OverlapCheckResult {
  hasIssues: boolean;
  issues: string[];
}

// ────────────────────────────────────────────────────────────
// applyAutofitToModifiedShapes
// ────────────────────────────────────────────────────────────

/**
 * Apply TEXT_AUTOFIT to all modified shapes so text shrinks to fit bounding boxes.
 * Best-effort: some shapes (tables, groups) may not support autofit.
 */
export async function applyAutofitToModifiedShapes(
  presentationId: string,
  modifiedElementIds: string[],
  authOptions?: GoogleAuthOptions,
): Promise<void> {
  if (modifiedElementIds.length === 0) {
    console.log(`${LOG_PREFIX} No modified elements to apply autofit to`);
    return;
  }

  const slides = getSlidesClient(authOptions);

  const requests = modifiedElementIds.map((elementId) => ({
    updateShapeProperties: {
      objectId: elementId,
      shapeProperties: {
        autofit: { autofitType: "TEXT_AUTOFIT" as const },
      },
      fields: "autofit",
    },
  }));

  try {
    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests },
    });
    console.log(
      `${LOG_PREFIX} Applied TEXT_AUTOFIT to ${modifiedElementIds.length} elements`,
    );
  } catch (error) {
    // Best-effort: some shapes (tables, grouped elements) may not support autofit
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(
      `${LOG_PREFIX} Autofit warning (non-fatal): ${msg}`,
    );
  }
}

// ────────────────────────────────────────────────────────────
// checkSlideForOverlap
// ────────────────────────────────────────────────────────────

/**
 * Fetch a slide thumbnail and send it to Gemini 3 Flash for visual overlap detection.
 * Fail-open: returns no issues on vision errors to avoid blocking the pipeline.
 */
async function checkSlideForOverlap(
  presentationId: string,
  slideObjectId: string,
  authOptions?: GoogleAuthOptions,
): Promise<OverlapCheckResult> {
  try {
    // Fetch slide thumbnail
    const slides = getSlidesClient(authOptions);
    const thumbResult = await slides.presentations.pages.getThumbnail({
      presentationId,
      pageObjectId: slideObjectId,
      "thumbnailProperties.thumbnailSize": "LARGE",
    });

    const contentUrl = thumbResult.data.contentUrl;
    if (!contentUrl) {
      console.warn(`${LOG_PREFIX} No thumbnail URL for slide ${slideObjectId}`);
      return { hasIssues: false, issues: [] };
    }

    const response = await fetch(contentUrl);
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    console.log(
      `${LOG_PREFIX} Fetched thumbnail for slide ${slideObjectId} (${imageBuffer.length} bytes)`,
    );

    // Send to Gemini 3 Flash for vision analysis
    const ai = new GoogleGenAI({ apiKey: env.GOOGLE_AI_STUDIO_API_KEY });

    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: imageBuffer.toString("base64"),
              },
            },
            {
              text: "Analyze this presentation slide. Does any text overlap with other text elements? Does any text appear cut off or overflow its container? Are there any visual layout issues? Respond with JSON: { \"hasIssues\": boolean, \"issues\": string[] } where issues describes each problem found including which text elements are affected.",
            },
          ],
        },
      ],
      config: { responseMimeType: "application/json" },
    });

    const responseText = result.text ?? "";
    const parsed = JSON.parse(responseText) as OverlapCheckResult;

    console.log(
      `${LOG_PREFIX} Vision check for slide ${slideObjectId}: hasIssues=${parsed.hasIssues}, issues=${parsed.issues?.length ?? 0}`,
    );

    return {
      hasIssues: !!parsed.hasIssues,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    };
  } catch (error) {
    // Fail-open: don't block pipeline on vision errors
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(
      `${LOG_PREFIX} Vision check failed for slide ${slideObjectId} (non-fatal): ${msg}`,
    );
    return { hasIssues: false, issues: [] };
  }
}

// ────────────────────────────────────────────────────────────
// applyCorrectionPass
// ────────────────────────────────────────────────────────────

/**
 * For each issue identified by the vision model, attempt to shorten text in
 * the corresponding modification plans and re-apply via Slides API.
 */
async function applyCorrectionPass(
  presentationId: string,
  modifiedPlans: ModificationPlan[],
  authOptions?: GoogleAuthOptions,
): Promise<string[]> {
  const slides = getSlidesClient(authOptions);
  const ai = new GoogleGenAI({ apiKey: env.GOOGLE_AI_STUDIO_API_KEY });
  const corrections: string[] = [];

  for (const plan of modifiedPlans) {
    for (const mod of plan.modifications) {
      try {
        // Ask Gemini to shorten the text by ~30%
        const shortenResult = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents:
            `The following text was placed in a presentation slide text box but overflows or overlaps other elements. Rewrite it to be 30% shorter while preserving the key message. Original text: ${mod.newContent}. Respond with only the shortened text, no explanation.`,
        });

        const shortenedText = (shortenResult.text ?? "").trim();
        if (!shortenedText || shortenedText.length >= mod.newContent.length) {
          console.log(
            `${LOG_PREFIX} Skipping correction for element ${mod.elementId}: shortened text not shorter`,
          );
          continue;
        }

        // Apply the shortened text via deleteText + insertText
        const requests = [
          {
            deleteText: {
              objectId: mod.elementId,
              textRange: { type: "ALL" as const },
            },
          },
          {
            insertText: {
              objectId: mod.elementId,
              insertionIndex: 0,
              text: shortenedText,
            },
          },
        ];

        await slides.presentations.batchUpdate({
          presentationId,
          requestBody: { requests },
        });

        // Update the plan's newContent so subsequent checks reflect the change
        mod.newContent = shortenedText;

        corrections.push(
          `Shortened element ${mod.elementId}: "${mod.newContent.slice(0, 40)}..."`,
        );
        console.log(
          `${LOG_PREFIX} Corrected element ${mod.elementId} on slide ${plan.slideObjectId}`,
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(
          `${LOG_PREFIX} Correction failed for element ${mod.elementId}: ${msg}`,
        );
      }
    }
  }

  // Re-apply autofit after corrections
  const allElementIds = modifiedPlans.flatMap((p) =>
    p.modifications.map((m) => m.elementId),
  );
  await applyAutofitToModifiedShapes(presentationId, allElementIds, authOptions);

  return corrections;
}

// ────────────────────────────────────────────────────────────
// performVisualQA (main export)
// ────────────────────────────────────────────────────────────

/**
 * Post-modification visual QA loop:
 *   1. Apply autofit to all modified shapes
 *   2. Render slide thumbnails and check for overlap via Gemini vision
 *   3. If issues found, shorten text and re-check (max 2 iterations)
 */
export async function performVisualQA(
  params: VisualQAParams,
  onLog?: (message: string, detail?: string) => void,
): Promise<VisualQAResult> {
  const { presentationId, modifiedPlans, authOptions } = params;

  // Collect all modified element IDs
  const modifiedElementIds = modifiedPlans.flatMap((plan) =>
    plan.modifications.map((m) => m.elementId),
  );

  console.log(
    `${LOG_PREFIX} Starting visual QA for presentation ${presentationId} ` +
      `(${modifiedPlans.length} plans, ${modifiedElementIds.length} modified elements)`,
  );

  // Step 1: Apply autofit
  await applyAutofitToModifiedShapes(
    presentationId,
    modifiedElementIds,
    authOptions,
  );

  // Step 2: Get unique slide object IDs
  const slideObjectIds = [
    ...new Set(modifiedPlans.map((p) => p.slideObjectId)),
  ];

  // Step 3: Vision check + correction loop (max 2 iterations)
  for (let iteration = 1; iteration <= 2; iteration++) {
    console.log(
      `${LOG_PREFIX} Iteration ${iteration}: Checking ${slideObjectIds.length} slides for visual issues`,
    );

    const allIssues: string[] = [];

    for (const slideObjectId of slideObjectIds) {
      const result = await checkSlideForOverlap(
        presentationId,
        slideObjectId,
        authOptions,
      );
      if (result.hasIssues) {
        allIssues.push(...result.issues);
      }
    }

    if (allIssues.length === 0) {
      const status = iteration === 1 ? "clean" : "corrected";
      console.log(
        `${LOG_PREFIX} Visual QA complete: status=${status}, iterations=${iteration}`,
      );
      return { status, iterations: iteration };
    }

    console.log(
      `${LOG_PREFIX} Iteration ${iteration}: Found ${allIssues.length} issues, applying corrections`,
    );

    // Apply corrections
    await applyCorrectionPass(
      presentationId,
      modifiedPlans,
      authOptions,
    );
  }

  // After 2 iterations, still have issues — return warning
  // Do a final check to see what remains
  const remainingIssues: string[] = [];
  for (const slideObjectId of slideObjectIds) {
    const result = await checkSlideForOverlap(
      presentationId,
      slideObjectId,
      authOptions,
    );
    if (result.hasIssues) {
      remainingIssues.push(...result.issues);
    }
  }

  console.warn(
    `${LOG_PREFIX} Visual QA warning: ${remainingIssues.length} issues remain after 2 correction attempts`,
  );

  return {
    status: "warning",
    iterations: 2,
    issues: remainingIssues.length > 0 ? remainingIssues : undefined,
  };
}
