/**
 * Post-Modification Visual QA — Autofit + Vision-based Overlap Detection
 *
 * After text modifications are applied to Google Slides, replacement text can
 * overflow bounding boxes or overlap adjacent elements. This module:
 *   1. Applies TEXT_AUTOFIT to all modified shapes (best-effort)
 *   2. Processes each slide individually: assess → fix → re-assess loop
 *   3. Each slide gets up to MAX_ATTEMPTS_PER_SLIDE correction attempts
 *   4. Already-clean slides are never re-analyzed
 */

import { GoogleGenAI } from "@google/genai";

import type { ModificationPlan } from "./modification-plan-schema";
import { getSlidesClient, type GoogleAuthOptions } from "../lib/google-auth";
import { env } from "../env";

const LOG_PREFIX = "[visual-qa]";

/** Max correction attempts per individual slide before giving up. */
const MAX_ATTEMPTS_PER_SLIDE = 5;

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

/** Tracks the outcome of processing a single slide. */
interface SlideOutcome {
  slideObjectId: string;
  status: "clean" | "fixed" | "unfixable";
  attemptsUsed: number;
  remainingIssues: string[];
  /** If unfixable, detailed reasons per issue. */
  unfixableReasons: string[];
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
// applySlideCorrectionPass
// ────────────────────────────────────────────────────────────

/**
 * Apply corrections to a SINGLE slide's modifications.
 * Provides the vision-detected issues as context so Gemini can make targeted fixes.
 */
async function applySlideCorrectionPass(
  presentationId: string,
  slidePlans: ModificationPlan[],
  issues: string[],
  attempt: number,
  authOptions?: GoogleAuthOptions,
): Promise<string[]> {
  const slidesApi = getSlidesClient(authOptions);
  const ai = new GoogleGenAI({ apiKey: env.GOOGLE_AI_STUDIO_API_KEY });
  const corrections: string[] = [];

  const issueContext = issues.join("; ");

  for (const plan of slidePlans) {
    for (const mod of plan.modifications) {
      try {
        // Build a prompt that includes the specific issues found on this slide
        // so Gemini can make a targeted fix rather than a generic 30% reduction.
        const reductionPct = Math.min(20 + attempt * 10, 50); // escalate: 30%, 40%, 50%
        const prompt = attempt === 1
          ? `The following text was placed in a presentation slide text box but causes visual issues: ${issueContext}. ` +
            `Rewrite the text to be ${reductionPct}% shorter while preserving the key message. ` +
            `Original text: ${mod.newContent}\n\nRespond with only the shortened text, no explanation.`
          : `A previous attempt to shorten this text did not fully resolve the visual issues on the slide. ` +
            `Remaining issues: ${issueContext}. ` +
            `The text MUST be significantly shorter (at least ${reductionPct}% reduction) to fit the text box without overflow or overlap. ` +
            `Be aggressive — remove filler words, use shorter synonyms, and condense sentences. ` +
            `Current text: ${mod.newContent}\n\nRespond with only the shortened text, no explanation.`;

        const shortenResult = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
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

        await slidesApi.presentations.batchUpdate({
          presentationId,
          requestBody: { requests },
        });

        // Update the plan's newContent so subsequent checks reflect the change
        mod.newContent = shortenedText;

        corrections.push(
          `Shortened element ${mod.elementId}: "${mod.newContent.slice(0, 40)}..."`,
        );
        console.log(
          `${LOG_PREFIX} Corrected element ${mod.elementId} on slide ${plan.slideObjectId} (attempt ${attempt})`,
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
  const correctedElementIds = slidePlans.flatMap((p) =>
    p.modifications.map((m) => m.elementId),
  );
  await applyAutofitToModifiedShapes(presentationId, correctedElementIds, authOptions);

  return corrections;
}

// ────────────────────────────────────────────────────────────
// processSlide — per-slide assess→fix loop
// ────────────────────────────────────────────────────────────

/**
 * Process a single slide: assess it, and if issues are found, iterate
 * fix → re-assess until clean or max attempts exhausted.
 */
async function processSlide(
  presentationId: string,
  slideObjectId: string,
  slidePlans: ModificationPlan[],
  slideIndex: number,
  totalSlides: number,
  authOptions?: GoogleAuthOptions,
  onLog?: (message: string, detail?: string) => void,
): Promise<SlideOutcome> {
  const slideLabel = `slide ${slideIndex + 1}/${totalSlides} (${slideObjectId})`;

  // Initial assessment
  onLog?.("checking", `Checking ${slideLabel} for issues`);
  let checkResult = await checkSlideForOverlap(presentationId, slideObjectId, authOptions);

  if (!checkResult.hasIssues) {
    onLog?.("slide_clean", `${slideLabel}: no issues found`);
    return {
      slideObjectId,
      status: "clean",
      attemptsUsed: 0,
      remainingIssues: [],
      unfixableReasons: [],
    };
  }

  onLog?.("issue_found", `${slideLabel}: found ${checkResult.issues.length} issue(s) — ${checkResult.issues.join("; ")}`);

  let previousIssueCount = checkResult.issues.length;
  let previousIssues = checkResult.issues;
  let consecutiveNoProgress = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_SLIDE; attempt++) {
    onLog?.("correcting", `Fixing ${slideLabel} (attempt ${attempt}/${MAX_ATTEMPTS_PER_SLIDE})`);

    // Apply corrections with issue context
    await applySlideCorrectionPass(
      presentationId,
      slidePlans,
      checkResult.issues,
      attempt,
      authOptions,
    );

    // Re-assess the same slide
    onLog?.("checking", `Re-checking ${slideLabel} after corrections`);
    checkResult = await checkSlideForOverlap(presentationId, slideObjectId, authOptions);

    if (!checkResult.hasIssues) {
      onLog?.("slide_fixed", `${slideLabel}: all issues resolved after ${attempt} attempt(s)`);
      return {
        slideObjectId,
        status: "fixed",
        attemptsUsed: attempt,
        remainingIssues: [],
        unfixableReasons: [],
      };
    }

    const currentIssueCount = checkResult.issues.length;
    onLog?.("issue_found", `${slideLabel}: ${currentIssueCount} issue(s) remaining after attempt ${attempt} — ${checkResult.issues.join("; ")}`);

    // Track whether we're making progress
    if (currentIssueCount >= previousIssueCount) {
      consecutiveNoProgress++;
    } else {
      consecutiveNoProgress = 0;
    }

    // Only give up if we've had 2+ consecutive attempts with no improvement
    // AND we've tried at least 3 attempts total. The bar is high because
    // text overlaps and cut-off headings are typically fixable.
    if (consecutiveNoProgress >= 2 && attempt >= 3) {
      const reasons = checkResult.issues.map(
        (issue) => `After ${attempt} correction attempts with escalating text reduction, the issue persists: "${issue}". ` +
          `This may require manual layout adjustment (e.g., resizing the text box or repositioning elements) ` +
          `that cannot be done via text shortening alone.`,
      );

      for (const reason of reasons) {
        onLog?.("slide_unfixable", `${slideLabel}: giving up — ${reason}`);
      }

      return {
        slideObjectId,
        status: "unfixable",
        attemptsUsed: attempt,
        remainingIssues: checkResult.issues,
        unfixableReasons: reasons,
      };
    }

    previousIssueCount = currentIssueCount;
    previousIssues = checkResult.issues;
  }

  // Exhausted all attempts
  const reasons = checkResult.issues.map(
    (issue) => `Exhausted ${MAX_ATTEMPTS_PER_SLIDE} correction attempts. Remaining issue: "${issue}". ` +
      `The text has been shortened as much as possible while preserving meaning. ` +
      `Manual layout adjustment may be needed.`,
  );

  for (const reason of reasons) {
    onLog?.("slide_unfixable", `${slideLabel}: giving up — ${reason}`);
  }

  return {
    slideObjectId,
    status: "unfixable",
    attemptsUsed: MAX_ATTEMPTS_PER_SLIDE,
    remainingIssues: checkResult.issues,
    unfixableReasons: reasons,
  };
}

// ────────────────────────────────────────────────────────────
// performVisualQA (main export)
// ────────────────────────────────────────────────────────────

/**
 * Post-modification visual QA — per-slide iteration:
 *   1. Apply autofit to all modified shapes
 *   2. Process each slide individually: assess → fix → re-assess (up to MAX_ATTEMPTS_PER_SLIDE per slide)
 *   3. Already-clean slides are never re-analyzed
 *   4. Only give up on a slide after exhausting attempts with detailed justification
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

  // Step 1: Apply autofit (only if there are modified elements)
  if (modifiedElementIds.length > 0) {
    onLog?.("autofit", `Applying autofit to ${modifiedElementIds.length} elements`);
    await applyAutofitToModifiedShapes(
      presentationId,
      modifiedElementIds,
      authOptions,
    );
  }

  // Step 2: Get slide object IDs to check.
  // If we have modification plans, check only those slides.
  // Otherwise, fetch ALL slides from the presentation so QA can run standalone.
  let slideObjectIds: string[];
  if (modifiedPlans.length > 0) {
    slideObjectIds = [...new Set(modifiedPlans.map((p) => p.slideObjectId))];
  } else {
    onLog?.("info", "No modification plans found — scanning all slides in the presentation");
    const slides = getSlidesClient(authOptions);
    const pres = await slides.presentations.get({ presentationId });
    slideObjectIds = (pres.data.slides ?? [])
      .map((s) => s.objectId)
      .filter((id): id is string => !!id);
    console.log(`${LOG_PREFIX} Fetched ${slideObjectIds.length} slides from presentation`);
  }

  if (slideObjectIds.length === 0) {
    onLog?.("complete", JSON.stringify({ status: "clean", iterations: 0 }));
    return { status: "clean", iterations: 0 };
  }

  // Build a map of slideObjectId -> modification plans for that slide
  const plansBySlide = new Map<string, ModificationPlan[]>();
  for (const plan of modifiedPlans) {
    const existing = plansBySlide.get(plan.slideObjectId) ?? [];
    existing.push(plan);
    plansBySlide.set(plan.slideObjectId, existing);
  }

  onLog?.("info", `Processing ${slideObjectIds.length} slides individually`);

  // Step 3: Process each slide independently
  const outcomes: SlideOutcome[] = [];
  let totalAttempts = 0;

  for (let i = 0; i < slideObjectIds.length; i++) {
    const slideObjectId = slideObjectIds[i];
    const slidePlans = plansBySlide.get(slideObjectId) ?? [];

    const outcome = await processSlide(
      presentationId,
      slideObjectId,
      slidePlans,
      i,
      slideObjectIds.length,
      authOptions,
      onLog,
    );

    outcomes.push(outcome);
    totalAttempts += outcome.attemptsUsed;
  }

  // Compute final result
  const cleanSlides = outcomes.filter((o) => o.status === "clean").length;
  const fixedSlides = outcomes.filter((o) => o.status === "fixed").length;
  const unfixableSlides = outcomes.filter((o) => o.status === "unfixable").length;
  const allRemainingIssues = outcomes.flatMap((o) => o.remainingIssues);

  console.log(
    `${LOG_PREFIX} Visual QA complete: ${cleanSlides} clean, ${fixedSlides} fixed, ${unfixableSlides} unfixable ` +
      `(${totalAttempts} total correction attempts, ${allRemainingIssues.length} remaining issues)`,
  );

  onLog?.("info",
    `Summary: ${cleanSlides} slides clean, ${fixedSlides} slides fixed, ${unfixableSlides} slides with remaining issues`,
  );

  let status: VisualQAResult["status"];
  if (allRemainingIssues.length === 0) {
    status = fixedSlides > 0 ? "corrected" : "clean";
  } else {
    status = "warning";
  }

  const qaResult: VisualQAResult = {
    status,
    iterations: totalAttempts,
    issues: allRemainingIssues.length > 0 ? allRemainingIssues : undefined,
  };
  onLog?.("complete", JSON.stringify(qaResult));

  return qaResult;
}
