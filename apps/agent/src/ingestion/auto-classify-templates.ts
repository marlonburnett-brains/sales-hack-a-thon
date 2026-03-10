/**
 * Auto-Classify Templates & Auto-Ingest New Templates
 *
 * Background tasks that run periodically to:
 * 1. Classify ingested templates with null contentClassification using LLM
 * 2. Auto-enqueue ingestion for accessible templates that have never been ingested
 */

import { env } from "../env";
import { prisma } from "../lib/db";
import { ingestionQueue } from "./ingestion-queue";
import {
  TemplateAutoClassificationLlmSchema,
  zodToLlmJsonSchema,
} from "@lumenalta/schemas";
import {
  createJsonResponseOptions,
  executeRuntimeProviderNamedAgent,
} from "../lib/agent-executor";

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ────────────────────────────────────────────────────────────
// Auto-Classify: LLM-based classification of ingested templates
// ────────────────────────────────────────────────────────────

/**
 * Finds all templates where contentClassification is null, ingestionStatus
 * is idle, and they have been ingested (lastIngestedAt is not null).
 * Uses LLM to classify each as "template" or "example" and infer touchTypes.
 */
export async function autoClassifyTemplates(): Promise<void> {
  try {
    const templates = await prisma.template.findMany({
      where: {
        contentClassification: null,
        ingestionStatus: "idle",
        lastIngestedAt: { not: null },
      },
      select: { id: true, name: true, presentationId: true },
    });

    if (templates.length === 0) return;

    console.log(
      `[auto-classify] Found ${templates.length} template(s) needing classification`
    );

    for (const template of templates) {
      try {
        // Load first 3 non-archived slides for context
        const slides = await prisma.slideEmbedding.findMany({
          where: {
            templateId: template.id,
            archived: false,
          },
          orderBy: { slideIndex: "asc" },
          take: 3,
          select: { contentText: true, slideIndex: true },
        });

        if (slides.length === 0) {
          console.log(
            `[auto-classify] No slides found for "${template.name}", skipping`
          );
          continue;
        }

        const slideSummary = slides
          .map((s) => `Slide ${s.slideIndex}: ${s.contentText.substring(0, 500)}`)
          .join("\n\n");

        const prompt = `You are classifying a presentation template from a sales deck library.

TEMPLATE NAME: ${template.name}

FIRST ${slides.length} SLIDES CONTENT:
${slideSummary}

CLASSIFICATION INSTRUCTIONS:
1. Classify as "template" if the content is generic/reusable with placeholder content meant to be customized (e.g., "[Company Name]", generic sections, blank layouts).
2. Classify as "example" if the content contains specific company names, real client deals, filled-out proposals, or specific case study content.
3. Infer touchTypes from the deck structure:
   - touch_1 = two-pager or one-pager (very short, high-level overview)
   - touch_2 = intro deck / Meet Lumenalta style (company overview, capabilities intro)
   - touch_3 = solutions/capability alignment deck (detailed technical capabilities)
   - touch_4 = full proposal (comprehensive proposal with pricing, timelines, team)

Classify this template.`;

        const response = await executeRuntimeProviderNamedAgent({
          agentId: "template-classification-analyst",
          messages: [{ role: "user", content: prompt }],
          options: createJsonResponseOptions(
            zodToLlmJsonSchema(
              TemplateAutoClassificationLlmSchema,
            ) as Record<string, unknown>,
          ),
        });

        const text = response.text ?? "{}";
        const parsed = JSON.parse(text) as {
          contentClassification: string;
          touchTypes: string[];
        };

        if (
          parsed.contentClassification === "template" ||
          parsed.contentClassification === "example"
        ) {
          await prisma.template.update({
            where: { id: template.id },
            data: {
              contentClassification: parsed.contentClassification,
              touchTypes: JSON.stringify(
                Array.isArray(parsed.touchTypes) ? parsed.touchTypes : []
              ),
            },
          });

          console.log(
            `[auto-classify] "${template.name}" -> ${parsed.contentClassification} (touchTypes: ${JSON.stringify(parsed.touchTypes)})`
          );
        } else {
          console.warn(
            `[auto-classify] Unexpected classification for "${template.name}": ${parsed.contentClassification}`
          );
        }

        // Rate limit between LLM calls
        await delay(500);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[auto-classify] Error classifying "${template.name}": ${message}`
        );
      }
    }

    console.log("[auto-classify] Classification cycle complete");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[auto-classify] Fatal error: ${message}`);
  }
}

// ────────────────────────────────────────────────────────────
// Auto-Ingest: Enqueue accessible templates that were never ingested
// ────────────────────────────────────────────────────────────

/**
 * Finds all templates that are accessible, idle, and have never been ingested
 * (lastIngestedAt is null). Enqueues each for ingestion.
 */
export async function autoIngestNewTemplates(): Promise<void> {
  try {
    const templates = await prisma.template.findMany({
      where: {
        accessStatus: "accessible",
        ingestionStatus: "idle",
        lastIngestedAt: null,
      },
      select: { id: true, name: true },
    });

    if (templates.length === 0) return;

    console.log(
      `[auto-ingest] Found ${templates.length} template(s) needing ingestion`
    );

    for (const template of templates) {
      ingestionQueue.enqueue(template.id);
      console.log(`[auto-ingest] Enqueued "${template.name}" for ingestion`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[auto-ingest] Fatal error: ${message}`);
  }
}
