/**
 * Structure-Driven Deck Generation Workflow (3-Stage HITL)
 *
 * Full workflow: Resolve blueprint + select slides (Skeleton) -> Suspend for skeleton approval ->
 * Assemble multi-source deck (Low-fi) -> Suspend for deck approval ->
 * Plan modifications (High-fi) -> Suspend for modification approval ->
 * Execute modifications + record interaction.
 *
 * 3-stage HITL model:
 *   Skeleton = blueprint sections with slide selections (thumbnails + rationale)
 *   Low-fi   = assembled Google Slides deck from multiple source presentations
 *   High-fi  = per-slide modification plan with element change previews
 *
 * This is purely an orchestration layer. All hard logic lives in Phase 51-55 modules:
 *   - blueprint-resolver.ts (Phase 51)
 *   - section-matcher.ts (Phase 54)
 *   - multi-source-assembler.ts (Phase 52)
 *   - modification-planner.ts (Phase 53)
 *   - modification-executor.ts (Phase 55)
 *
 * Uses Mastra suspend/resume for each stage boundary.
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { resolveBlueprint, type ResolvedCandidate } from "./blueprint-resolver";
import { selectSlidesForBlueprint } from "./section-matcher";
import {
  buildMultiSourcePlan,
  assembleMultiSourceDeck,
} from "./multi-source-assembler";
import { planSlideModifications } from "./modification-planner";
import { executeModifications } from "./modification-executor";
import type { ModificationPlan } from "./modification-plan-schema";
import { getOrCreateDealFolder, resolveRootFolderId } from "../lib/drive-folders";
import { getSlidesClient } from "../lib/google-auth";
import { prisma } from "../lib/db";
import type {
  DealContext,
  GenerationBlueprint,
  SlideSelectionEntry,
  ArtifactType,
} from "@lumenalta/schemas";
import type { DeckStructureKey } from "../deck-intelligence/deck-structure-key";

// ────────────────────────────────────────────────────────────
// Shared Types
// ────────────────────────────────────────────────────────────

interface SelectionWithThumbnail extends SlideSelectionEntry {
  thumbnailUrl: string | null;
}

interface ModificationSummaryEntry {
  slideId: string;
  modificationCount: number;
  elements: Array<{ elementId: string; reason: string }>;
}

// ────────────────────────────────────────────────────────────
// Step 1: Resolve Blueprint + Select Slides
// ────────────────────────────────────────────────────────────

export const resolveAndSelectSlidesStep = createStep({
  id: "resolve-and-select-slides",
  inputSchema: z.object({
    dealId: z.string(),
    touchType: z.string(),
    artifactType: z.string().optional(),
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    dealId: z.string(),
    blueprint: z.any(),
    selections: z.array(z.any()),
    candidates: z.any(),
    dealContext: z.any(),
    ownerEmail: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    // Query deal for context assembly
    const deal = await prisma.deal.findUniqueOrThrow({
      where: { id: inputData.dealId },
      include: { company: true },
    });

    const dealContext: DealContext = {
      dealId: deal.id,
      companyName: deal.company.name,
      industry: deal.company.industry ?? "",
      pillars: [],
      persona: "",
      funnelStage: "",
      priorTouchSlideIds: [],
    };

    // Resolve blueprint + candidates
    const key: DeckStructureKey = {
      touchType: inputData.touchType as DeckStructureKey["touchType"],
      artifactType: (inputData.artifactType ?? null) as ArtifactType | null,
    };
    const blueprintResult = await resolveBlueprint(key, dealContext);

    if (!blueprintResult) {
      throw new Error(
        `No DeckStructure found for touchType=${inputData.touchType}, artifactType=${inputData.artifactType ?? "null"}. Structure-driven workflow requires an existing DeckStructure.`,
      );
    }

    // Select slides for each section
    const { plan: selectionPlan, blueprint } =
      await selectSlidesForBlueprint(blueprintResult);

    // Create InteractionRecord
    const interaction = await prisma.interactionRecord.create({
      data: {
        dealId: inputData.dealId,
        touchType: inputData.touchType,
        status: "in_progress",
        decision: null,
        hitlStage: "skeleton",
        stageContent: JSON.stringify({
          sections: blueprint.sections.map((s) => ({
            sectionName: s.sectionName,
            selectedSlideId: s.selectedSlideId,
            isOptional: s.isOptional,
          })),
          selections: selectionPlan.selections.map((s) => ({
            sectionName: s.sectionName,
            slideId: s.slideId,
            matchRationale: s.matchRationale,
          })),
        }),
      },
    });

    // Enrich selections with thumbnail URLs from candidates
    const selections: SelectionWithThumbnail[] = selectionPlan.selections.map(
      (s) => ({
        ...s,
        thumbnailUrl:
          blueprintResult.candidates.get(s.slideId)?.thumbnailUrl ?? null,
      }),
    );

    // Serialize candidates for downstream (Map -> plain object)
    const candidatesObj: Record<string, ResolvedCandidate> = {};
    for (const [key, val] of blueprintResult.candidates) {
      candidatesObj[key] = val;
    }

    return {
      interactionId: interaction.id,
      dealId: inputData.dealId,
      blueprint,
      selections,
      candidates: candidatesObj,
      dealContext,
      ownerEmail: deal.ownerEmail ?? undefined,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 2: Await Skeleton Approval (SUSPEND 1)
// ────────────────────────────────────────────────────────────

export const awaitSkeletonApprovalStep = createStep({
  id: "await-skeleton-approval",
  inputSchema: z.object({
    interactionId: z.string(),
    dealId: z.string(),
    blueprint: z.any(),
    selections: z.array(z.any()),
    candidates: z.any(),
    dealContext: z.any(),
    ownerEmail: z.string().optional(),
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    dealId: z.string(),
    approvedSelections: z.array(z.any()),
    dealContext: z.any(),
    ownerEmail: z.string().optional(),
  }),
  resumeSchema: z.object({
    decision: z.enum(["approved", "refined"]),
    refinedSections: z
      .array(
        z.object({
          sectionName: z.string(),
          isOptional: z.boolean(),
          selectedSlideId: z.string(),
          candidateSlideIds: z.array(z.string()),
        }),
      )
      .optional(),
  }),
  suspendSchema: z.object({
    stage: z.literal("skeleton"),
    interactionId: z.string(),
    dealId: z.string(),
    sections: z.array(z.any()),
    selections: z.array(z.any()),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const blueprint = inputData.blueprint as GenerationBlueprint;
    const selections = inputData.selections as SelectionWithThumbnail[];
    const candidates = inputData.candidates as Record<string, ResolvedCandidate>;

    if (!resumeData) {
      // Build slim suspend payload
      const sections = blueprint.sections.map((s) => {
        const selection = selections.find(
          (sel) => sel.sectionName === s.sectionName,
        );
        return {
          sectionName: s.sectionName,
          purpose: s.purpose,
          isOptional: s.isOptional,
          selectedSlideId: s.selectedSlideId,
          sourcePresentationId: s.sourcePresentationId,
          candidateSlideIds: s.candidateSlideIds,
          thumbnailUrl: selection?.thumbnailUrl ?? null,
          matchRationale: selection?.matchRationale ?? null,
        };
      });

      return await suspend({
        stage: "skeleton" as const,
        interactionId: inputData.interactionId,
        dealId: inputData.dealId,
        sections,
        selections: selections.map((s) => ({
          sectionName: s.sectionName,
          slideId: s.slideId,
          matchRationale: s.matchRationale,
          thumbnailUrl: s.thumbnailUrl,
        })),
      });
    }

    // Resume path
    let approvedSelections: SlideSelectionEntry[];

    if (
      resumeData.decision === "refined" &&
      resumeData.refinedSections
    ) {
      // Re-derive selections from refined sections
      approvedSelections = resumeData.refinedSections.map((refined) => {
        const candidate = candidates[refined.selectedSlideId];
        return {
          sectionName: refined.sectionName,
          slideId: refined.selectedSlideId,
          slideObjectId: candidate?.slideObjectId ?? refined.selectedSlideId,
          sourcePresentationId: candidate?.presentationId ?? "",
          templateId: candidate?.templateId ?? "",
          matchRationale: "Seller-refined selection",
        };
      });

      // Update stageContent with refined data
      await prisma.interactionRecord.update({
        where: { id: inputData.interactionId },
        data: {
          stageContent: JSON.stringify({
            refined: true,
            sections: resumeData.refinedSections,
          }),
        },
      });
    } else {
      // Approved as-is
      approvedSelections = selections.map((s) => ({
        sectionName: s.sectionName,
        slideId: s.slideId,
        slideObjectId: s.slideObjectId,
        sourcePresentationId: s.sourcePresentationId,
        templateId: s.templateId,
        matchRationale: s.matchRationale,
      }));
    }

    return {
      interactionId: inputData.interactionId,
      dealId: inputData.dealId,
      approvedSelections,
      dealContext: inputData.dealContext,
      ownerEmail: inputData.ownerEmail,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 3: Assemble Multi-Source Deck
// ────────────────────────────────────────────────────────────

export const assembleMultiSourceDeckStep = createStep({
  id: "assemble-multi-source-deck",
  inputSchema: z.object({
    interactionId: z.string(),
    dealId: z.string(),
    approvedSelections: z.array(z.any()),
    dealContext: z.any(),
    ownerEmail: z.string().optional(),
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    dealId: z.string(),
    presentationId: z.string(),
    driveUrl: z.string(),
    slideCount: z.number(),
    approvedSelections: z.array(z.any()),
    dealContext: z.any(),
    ownerEmail: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const approvedSelections = inputData.approvedSelections as SlideSelectionEntry[];
    const dealContext = inputData.dealContext as DealContext;

    // Get deal folder
    const deal = await prisma.deal.findUniqueOrThrow({
      where: { id: inputData.dealId },
      include: { company: true },
    });

    const rootFolderId = await resolveRootFolderId(deal.ownerId ?? undefined);
    const folderId = await getOrCreateDealFolder({
      companyName: deal.company.name,
      dealName: deal.name,
      parentFolderId: rootFolderId,
    });

    // Get all slide IDs per presentation for buildMultiSourcePlan
    const slides = getSlidesClient();
    const presentationIds = [
      ...new Set(approvedSelections.map((s) => s.sourcePresentationId)),
    ];
    const allSlidesByPresentation = new Map<string, string[]>();

    for (const presId of presentationIds) {
      try {
        const pres = await slides.presentations.get({
          presentationId: presId,
        });
        const slideIds = (pres.data.slides ?? [])
          .map((s) => s.objectId)
          .filter((id): id is string => Boolean(id));
        allSlidesByPresentation.set(presId, slideIds);
      } catch {
        allSlidesByPresentation.set(presId, []);
      }
    }

    // Build plan and assemble
    const plan = buildMultiSourcePlan(
      { selections: approvedSelections },
      allSlidesByPresentation,
    );

    const deckName = `${dealContext.companyName} - ${new Date().toISOString().split("T")[0]}`;
    const result = await assembleMultiSourceDeck({
      plan,
      targetFolderId: folderId,
      deckName,
      ownerEmail: inputData.ownerEmail,
    });

    // Update hitlStage to lowfi
    await prisma.interactionRecord.update({
      where: { id: inputData.interactionId },
      data: {
        hitlStage: "lowfi",
        stageContent: JSON.stringify({
          presentationId: result.presentationId,
          driveUrl: result.driveUrl,
        }),
      },
    });

    return {
      interactionId: inputData.interactionId,
      dealId: inputData.dealId,
      presentationId: result.presentationId,
      driveUrl: result.driveUrl,
      slideCount: approvedSelections.length,
      approvedSelections,
      dealContext,
      ownerEmail: inputData.ownerEmail,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 4: Await Low-fi Approval (SUSPEND 2)
// ────────────────────────────────────────────────────────────

export const awaitLowfiApprovalStep = createStep({
  id: "await-lowfi-approval",
  inputSchema: z.object({
    interactionId: z.string(),
    dealId: z.string(),
    presentationId: z.string(),
    driveUrl: z.string(),
    slideCount: z.number(),
    approvedSelections: z.array(z.any()),
    dealContext: z.any(),
    ownerEmail: z.string().optional(),
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    dealId: z.string(),
    presentationId: z.string(),
    driveUrl: z.string(),
    approvedSelections: z.array(z.any()),
    dealContext: z.any(),
  }),
  resumeSchema: z.object({
    decision: z.enum(["approved", "request_changes"]),
  }),
  suspendSchema: z.object({
    stage: z.literal("lowfi"),
    interactionId: z.string(),
    dealId: z.string(),
    presentationId: z.string(),
    driveUrl: z.string(),
    slideCount: z.number(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return await suspend({
        stage: "lowfi" as const,
        interactionId: inputData.interactionId,
        dealId: inputData.dealId,
        presentationId: inputData.presentationId,
        driveUrl: inputData.driveUrl,
        slideCount: inputData.slideCount,
      });
    }

    if (resumeData.decision === "request_changes") {
      // Signal restart -- the caller (Phase 57 routing) handles re-invocation
      throw new Error(
        `RESTART_REQUIRED: Seller requested changes for interaction ${inputData.interactionId}. Re-invoke structure-driven-workflow from skeleton stage.`,
      );
    }

    return {
      interactionId: inputData.interactionId,
      dealId: inputData.dealId,
      presentationId: inputData.presentationId,
      driveUrl: inputData.driveUrl,
      approvedSelections: inputData.approvedSelections,
      dealContext: inputData.dealContext,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 5: Plan and Prepare Modifications
// ────────────────────────────────────────────────────────────

export const planAndPrepareModificationsStep = createStep({
  id: "plan-and-prepare-modifications",
  inputSchema: z.object({
    interactionId: z.string(),
    dealId: z.string(),
    presentationId: z.string(),
    driveUrl: z.string(),
    approvedSelections: z.array(z.any()),
    dealContext: z.any(),
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    dealId: z.string(),
    presentationId: z.string(),
    driveUrl: z.string(),
    modificationPlans: z.array(z.any()),
    modificationSummary: z.array(z.any()),
  }),
  execute: async ({ inputData }) => {
    const approvedSelections = inputData.approvedSelections as SlideSelectionEntry[];
    const dealContext = inputData.dealContext as DealContext;

    // Read assembled presentation to get current slide objectIds
    const slides = getSlidesClient();
    const presentation = await slides.presentations.get({
      presentationId: inputData.presentationId,
    });

    const slideObjectIds = (presentation.data.slides ?? [])
      .map((s) => s.objectId)
      .filter((id): id is string => Boolean(id));

    // Plan modifications per slide
    const modificationPlans: ModificationPlan[] = [];
    const modificationSummary: ModificationSummaryEntry[] = [];

    for (let i = 0; i < approvedSelections.length; i++) {
      const selection = approvedSelections[i];
      const slideObjectId = slideObjectIds[i] ?? `unknown-${i}`;

      const { plan } = await planSlideModifications({
        slideId: selection.slideId,
        slideObjectId,
        dealContext,
      });

      modificationPlans.push(plan);
      modificationSummary.push({
        slideId: selection.slideId,
        modificationCount: plan.modifications.length,
        elements: plan.modifications.map((m) => ({
          elementId: m.elementId,
          reason: m.reason,
        })),
      });
    }

    // Update hitlStage to highfi
    await prisma.interactionRecord.update({
      where: { id: inputData.interactionId },
      data: {
        hitlStage: "highfi",
        stageContent: JSON.stringify({ modificationSummary }),
      },
    });

    return {
      interactionId: inputData.interactionId,
      dealId: inputData.dealId,
      presentationId: inputData.presentationId,
      driveUrl: inputData.driveUrl,
      modificationPlans,
      modificationSummary,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 6: Await High-fi Approval (SUSPEND 3)
// ────────────────────────────────────────────────────────────

export const awaitHighfiApprovalStep = createStep({
  id: "await-highfi-approval",
  inputSchema: z.object({
    interactionId: z.string(),
    dealId: z.string(),
    presentationId: z.string(),
    driveUrl: z.string(),
    modificationPlans: z.array(z.any()),
    modificationSummary: z.array(z.any()),
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    dealId: z.string(),
    presentationId: z.string(),
    driveUrl: z.string(),
    decision: z.string(),
    modificationPlans: z.array(z.any()),
  }),
  resumeSchema: z.object({
    decision: z.enum(["approved", "rejected"]),
  }),
  suspendSchema: z.object({
    stage: z.literal("highfi"),
    interactionId: z.string(),
    dealId: z.string(),
    presentationId: z.string(),
    driveUrl: z.string(),
    modificationSummary: z.array(z.any()),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return await suspend({
        stage: "highfi" as const,
        interactionId: inputData.interactionId,
        dealId: inputData.dealId,
        presentationId: inputData.presentationId,
        driveUrl: inputData.driveUrl,
        modificationSummary: inputData.modificationSummary,
      });
    }

    if (resumeData.decision === "rejected") {
      // No modifications applied -- update to ready state with deck as-is
      await prisma.interactionRecord.update({
        where: { id: inputData.interactionId },
        data: { hitlStage: "ready" },
      });

      return {
        interactionId: inputData.interactionId,
        dealId: inputData.dealId,
        presentationId: inputData.presentationId,
        driveUrl: inputData.driveUrl,
        decision: "rejected",
        modificationPlans: [], // empty -- no modifications to execute
      };
    }

    return {
      interactionId: inputData.interactionId,
      dealId: inputData.dealId,
      presentationId: inputData.presentationId,
      driveUrl: inputData.driveUrl,
      decision: "approved",
      modificationPlans: inputData.modificationPlans,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 7: Execute Modifications and Record Final
// ────────────────────────────────────────────────────────────

export const executeAndRecordFinalStep = createStep({
  id: "execute-and-record-final",
  inputSchema: z.object({
    interactionId: z.string(),
    dealId: z.string(),
    presentationId: z.string(),
    driveUrl: z.string(),
    decision: z.string(),
    modificationPlans: z.array(z.any()),
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    presentationId: z.string(),
    driveUrl: z.string(),
    decision: z.string(),
  }),
  execute: async ({ inputData }) => {
    const plans = inputData.modificationPlans as ModificationPlan[];

    // Execute modifications (skip if rejected / no plans)
    if (plans.length > 0) {
      await executeModifications({
        presentationId: inputData.presentationId,
        plans,
      });
    }

    // Update InteractionRecord to final state
    await prisma.interactionRecord.update({
      where: { id: inputData.interactionId },
      data: {
        status: "approved",
        decision: inputData.decision,
        hitlStage: "ready",
        driveFileId: inputData.presentationId,
        outputRefs: JSON.stringify([inputData.driveUrl]),
      },
    });

    // Create FeedbackSignal
    await prisma.feedbackSignal.create({
      data: {
        interactionId: inputData.interactionId,
        signalType: inputData.decision === "approved" ? "positive" : "negative",
        source: "structure_driven_approve",
        content: JSON.stringify({
          decision: inputData.decision,
          presentationId: inputData.presentationId,
        }),
      },
    });

    return {
      interactionId: inputData.interactionId,
      presentationId: inputData.presentationId,
      driveUrl: inputData.driveUrl,
      decision: inputData.decision,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Workflow: Structure-Driven Deck Generation (3-Stage HITL)
// ────────────────────────────────────────────────────────────

export const structureDrivenWorkflow = createWorkflow({
  id: "structure-driven-workflow",
  inputSchema: z.object({
    dealId: z.string(),
    touchType: z.string(),
    artifactType: z.string().optional(),
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    presentationId: z.string(),
    driveUrl: z.string(),
    decision: z.string(),
  }),
})
  .then(resolveAndSelectSlidesStep)
  .then(awaitSkeletonApprovalStep)
  .then(assembleMultiSourceDeckStep)
  .then(awaitLowfiApprovalStep)
  .then(planAndPrepareModificationsStep)
  .then(awaitHighfiApprovalStep)
  .then(executeAndRecordFinalStep)
  .commit();
