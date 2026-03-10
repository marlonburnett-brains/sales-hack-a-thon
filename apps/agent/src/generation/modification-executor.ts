import type { slides_v1 } from "googleapis";

import type { ModificationPlan } from "./modification-plan-schema";
import { getSlidesClient, type GoogleAuthOptions } from "../lib/google-auth";

export interface ExecuteModificationsParams {
  presentationId: string;
  plans: ModificationPlan[];
  authOptions?: GoogleAuthOptions;
}

export interface SlideModificationResult {
  slideId: string;
  slideObjectId: string;
  status: "success" | "skipped" | "no_modifications";
  modificationsApplied: number;
  error?: string;
}

export interface ExecuteModificationsResult {
  results: SlideModificationResult[];
  totalApplied: number;
  totalSkipped: number;
}

const LOG_PREFIX = "[modification-executor]";

function getSlideElementIds(
  slide: slides_v1.Schema$Page | undefined,
): Set<string> {
  return new Set(
    (slide?.pageElements ?? [])
      .map((element) => element.objectId)
      .filter((elementId): elementId is string => Boolean(elementId)),
  );
}

function buildRequests(
  plan: ModificationPlan,
  currentElementIds: Set<string>,
): {
  requests: slides_v1.Schema$Request[];
  modificationsApplied: number;
} {
  const requests: slides_v1.Schema$Request[] = [];
  let modificationsApplied = 0;

  for (const modification of plan.modifications) {
    if (!currentElementIds.has(modification.elementId)) {
      console.warn(
        `${LOG_PREFIX} Element ${modification.elementId} not found on slide ${plan.slideObjectId}, skipping`,
      );
      continue;
    }

    requests.push(
      {
        deleteText: {
          objectId: modification.elementId,
          textRange: { type: "ALL" },
        },
      },
      {
        insertText: {
          objectId: modification.elementId,
          insertionIndex: 0,
          text: modification.newContent.replace(/\n$/, ""),
        },
      },
    );
    modificationsApplied += 1;
  }

  return { requests, modificationsApplied };
}

export async function executeModifications(
  params: ExecuteModificationsParams,
): Promise<ExecuteModificationsResult> {
  const { presentationId, plans, authOptions } = params;
  const slides = getSlidesClient(authOptions);
  const results: SlideModificationResult[] = [];

  for (const plan of plans) {
    if (plan.modifications.length === 0) {
      results.push({
        slideId: plan.slideId,
        slideObjectId: plan.slideObjectId,
        status: "no_modifications",
        modificationsApplied: 0,
      });
      continue;
    }

    try {
      const presentation = await slides.presentations.get({ presentationId });
      const targetSlide = presentation.data.slides?.find(
        (slide) => slide.objectId === plan.slideObjectId,
      );

      if (!targetSlide) {
        const error = `Slide objectId ${plan.slideObjectId} not found in presentation`;
        console.warn(`${LOG_PREFIX} ${error}`);
        results.push({
          slideId: plan.slideId,
          slideObjectId: plan.slideObjectId,
          status: "skipped",
          modificationsApplied: 0,
          error,
        });
        continue;
      }

      const currentElementIds = getSlideElementIds(targetSlide);
      const { requests, modificationsApplied } = buildRequests(
        plan,
        currentElementIds,
      );

      if (requests.length > 0) {
        await slides.presentations.batchUpdate({
          presentationId,
          requestBody: { requests },
        });
      }

      results.push({
        slideId: plan.slideId,
        slideObjectId: plan.slideObjectId,
        status: "success",
        modificationsApplied,
      });
    } catch (error) {
      console.warn(
        `${LOG_PREFIX} Slide ${plan.slideId} failed:`,
        error instanceof Error ? error.message : error,
      );
      results.push({
        slideId: plan.slideId,
        slideObjectId: plan.slideObjectId,
        status: "skipped",
        modificationsApplied: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    results,
    totalApplied: results.reduce(
      (sum, result) => sum + result.modificationsApplied,
      0,
    ),
    totalSkipped: results.filter((result) => result.status === "skipped").length,
  };
}
