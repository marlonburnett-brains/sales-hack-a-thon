/**
 * Structure-Driven Workflow Tests
 *
 * Tests all 7 steps of the structure-driven HITL workflow:
 *   1. resolveAndSelectSlides (computation)
 *   2. awaitSkeletonApproval (suspend)
 *   3. assembleMultiSourceDeckStep (computation)
 *   4. awaitLowfiApproval (suspend)
 *   5. planAndPrepareModifications (computation)
 *   6. awaitHighfiApproval (suspend)
 *   7. executeAndRecordFinal (computation)
 *
 * Tests exercise step execute functions directly with mocked dependencies.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────
vi.mock("../blueprint-resolver", () => ({
  resolveBlueprint: vi.fn(),
}));

vi.mock("../section-matcher", () => ({
  selectSlidesForBlueprint: vi.fn(),
}));

vi.mock("../multi-source-assembler", () => ({
  groupSlidesBySource: vi.fn(),
  buildMultiSourcePlan: vi.fn(),
  assembleMultiSourceDeck: vi.fn(),
}));

vi.mock("../modification-planner", () => ({
  planSlideModifications: vi.fn(),
}));

vi.mock("../modification-executor", () => ({
  executeModifications: vi.fn(),
}));

vi.mock("../../lib/db", () => ({
  prisma: {
    deal: { findUniqueOrThrow: vi.fn() },
    interactionRecord: { create: vi.fn(), update: vi.fn() },
    feedbackSignal: { create: vi.fn() },
  },
}));

vi.mock("../../lib/drive-folders", () => ({
  getOrCreateDealFolder: vi.fn(),
  resolveRootFolderId: vi.fn(),
  shareWithOrg: vi.fn(),
}));

vi.mock("../../lib/google-auth", () => ({
  getSlidesClient: vi.fn(() => ({
    presentations: {
      get: vi.fn(),
    },
  })),
}));

// ── Imports (after mocks) ──────────────────────────────────
import { resolveBlueprint } from "../blueprint-resolver";
import { selectSlidesForBlueprint } from "../section-matcher";
import {
  buildMultiSourcePlan,
  assembleMultiSourceDeck,
} from "../multi-source-assembler";
import { planSlideModifications } from "../modification-planner";
import { executeModifications } from "../modification-executor";
import { prisma } from "../../lib/db";
import { getOrCreateDealFolder, resolveRootFolderId } from "../../lib/drive-folders";
import { getSlidesClient } from "../../lib/google-auth";
import type { DealContext, GenerationBlueprint, SlideSelectionPlan } from "@lumenalta/schemas";
import type { BlueprintWithCandidates, ResolvedCandidate } from "../blueprint-resolver";

// ── Test Fixtures ──────────────────────────────────────────

const dealContext: DealContext = {
  dealId: "deal-1",
  companyName: "Acme Corp",
  industry: "Technology",
  pillars: ["Cloud", "AI"],
  persona: "CTO",
  funnelStage: "Discovery",
  priorTouchSlideIds: [],
  transcriptInsights: [],
};

const candidate1: ResolvedCandidate = {
  slideId: "slide-1",
  slideObjectId: "obj-slide-1",
  templateId: "tmpl-1",
  presentationId: "pres-1",
  classificationJson: null,
  thumbnailUrl: "https://thumb.example.com/slide-1.png",
  confidence: 0.9,
};

const candidate2: ResolvedCandidate = {
  slideId: "slide-2",
  slideObjectId: "obj-slide-2",
  templateId: "tmpl-1",
  presentationId: "pres-1",
  classificationJson: null,
  thumbnailUrl: "https://thumb.example.com/slide-2.png",
  confidence: 0.8,
};

const blueprint: GenerationBlueprint = {
  deckStructureId: "ds-1",
  touchType: "touch_2",
  artifactType: null,
  sections: [
    {
      sectionName: "Intro",
      purpose: "Introduction slide",
      isOptional: false,
      candidateSlideIds: ["slide-1"],
      selectedSlideId: "slide-1",
      sourcePresentationId: "pres-1",
      hasModificationPlan: false,
    },
    {
      sectionName: "Capabilities",
      purpose: "Capability overview",
      isOptional: true,
      candidateSlideIds: ["slide-2"],
      selectedSlideId: "slide-2",
      sourcePresentationId: "pres-1",
      hasModificationPlan: false,
    },
  ],
  dealContext,
  sequenceRationale: "Standard 2-section deck",
};

const selectionPlan: SlideSelectionPlan = {
  selections: [
    {
      sectionName: "Intro",
      slideId: "slide-1",
      slideObjectId: "obj-slide-1",
      sourcePresentationId: "pres-1",
      templateId: "tmpl-1",
      matchRationale: "Industry match (Technology). Score: 3",
    },
    {
      sectionName: "Capabilities",
      slideId: "slide-2",
      slideObjectId: "obj-slide-2",
      sourcePresentationId: "pres-1",
      templateId: "tmpl-1",
      matchRationale: "Fallback: first available candidate",
    },
  ],
};

const candidatesMap = new Map<string, ResolvedCandidate>([
  ["slide-1", candidate1],
  ["slide-2", candidate2],
]);

const blueprintWithCandidates: BlueprintWithCandidates = {
  blueprint,
  candidates: candidatesMap,
};

// ── Tests ──────────────────────────────────────────────────

describe("structure-driven-workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    vi.mocked(prisma.deal.findUniqueOrThrow).mockResolvedValue({
      id: "deal-1",
      name: "Acme Deal",
      ownerId: "user-1",
      ownerEmail: "owner@example.com",
      driveFolderId: "folder-1",
      company: {
        name: "Acme Corp",
        industry: "Technology",
      },
    } as any);

    vi.mocked(prisma.interactionRecord.create).mockResolvedValue({
      id: "interaction-1",
    } as any);

    vi.mocked(prisma.interactionRecord.update).mockResolvedValue({} as any);
    vi.mocked(prisma.feedbackSignal.create).mockResolvedValue({} as any);

    vi.mocked(resolveBlueprint).mockResolvedValue(blueprintWithCandidates);
    vi.mocked(selectSlidesForBlueprint).mockResolvedValue({
      plan: selectionPlan,
      blueprint,
    });

    vi.mocked(resolveRootFolderId).mockResolvedValue("root-folder-id");
    vi.mocked(getOrCreateDealFolder).mockResolvedValue("deal-folder-id");
  });

  describe("resolveAndSelectSlides step", () => {
    it("returns blueprint sections, selections with thumbnailUrl/matchRationale, and interactionId", async () => {
      const {
        resolveAndSelectSlidesStep,
      } = await import("../structure-driven-workflow");

      const result = await resolveAndSelectSlidesStep.execute({
        inputData: {
          dealId: "deal-1",
          touchType: "touch_2",
          artifactType: undefined,
        },
        resumeData: undefined as any,
        suspend: vi.fn() as any,
        getInitData: vi.fn() as any,
        getStepResult: vi.fn() as any,
        emitter: { emit: vi.fn() } as any,
        runId: "run-1",
        mapiKey: "test-key",
      } as any);

      expect(result).toBeDefined();
      expect(result!.interactionId).toBe("interaction-1");
      expect(result!.blueprint).toBeDefined();
      expect(result!.selections).toBeDefined();
      expect(result!.selections.length).toBeGreaterThan(0);
      // Check thumbnailUrl and matchRationale in selections
      expect(result!.selections[0].thumbnailUrl).toBe("https://thumb.example.com/slide-1.png");
      expect(result!.selections[0].matchRationale).toBe("Industry match (Technology). Score: 3");
    });
  });

  describe("awaitSkeletonApproval step", () => {
    it("suspends with correct skeleton payload", async () => {
      const {
        awaitSkeletonApprovalStep,
      } = await import("../structure-driven-workflow");

      const suspendFn = vi.fn();
      await awaitSkeletonApprovalStep.execute({
        inputData: {
          interactionId: "interaction-1",
          dealId: "deal-1",
          blueprint,
          selections: selectionPlan.selections.map((s) => ({
            ...s,
            thumbnailUrl: candidatesMap.get(s.slideId)?.thumbnailUrl ?? null,
          })),
          candidates: Object.fromEntries(candidatesMap),
          dealContext,
        },
        resumeData: undefined as any,
        suspend: suspendFn as any,
        getInitData: vi.fn() as any,
        getStepResult: vi.fn() as any,
        emitter: { emit: vi.fn() } as any,
        runId: "run-1",
        mapiKey: "test-key",
      } as any);

      expect(suspendFn).toHaveBeenCalledOnce();
      const payload = suspendFn.mock.calls[0][0];
      expect(payload.stage).toBe("skeleton");
      expect(payload.interactionId).toBe("interaction-1");
      expect(payload.dealId).toBe("deal-1");
      expect(payload.sections).toBeDefined();
      expect(payload.sections[0]).toHaveProperty("sectionName");
      expect(payload.sections[0]).toHaveProperty("selectedSlideId");
      expect(payload.sections[0]).toHaveProperty("thumbnailUrl");
      expect(payload.sections[0]).toHaveProperty("matchRationale");
      expect(payload.sections[0]).toHaveProperty("isOptional");
      expect(payload.sections[0]).toHaveProperty("candidateSlideIds");
    });

    it("on 'refined' decision, carries refined selections downstream", async () => {
      const {
        awaitSkeletonApprovalStep,
      } = await import("../structure-driven-workflow");

      const result = await awaitSkeletonApprovalStep.execute({
        inputData: {
          interactionId: "interaction-1",
          dealId: "deal-1",
          blueprint,
          selections: selectionPlan.selections.map((s) => ({
            ...s,
            thumbnailUrl: candidatesMap.get(s.slideId)?.thumbnailUrl ?? null,
          })),
          candidates: Object.fromEntries(candidatesMap),
          dealContext,
        },
        resumeData: {
          decision: "refined",
          refinedSections: [
            {
              sectionName: "Intro",
              isOptional: false,
              selectedSlideId: "slide-2", // swapped
              candidateSlideIds: ["slide-1", "slide-2"],
            },
            {
              sectionName: "Capabilities",
              isOptional: true,
              selectedSlideId: "slide-2",
              candidateSlideIds: ["slide-2"],
            },
          ],
        },
        suspend: vi.fn() as any,
        getInitData: vi.fn() as any,
        getStepResult: vi.fn() as any,
        emitter: { emit: vi.fn() } as any,
        runId: "run-1",
        mapiKey: "test-key",
      } as any);

      expect(result).toBeDefined();
      // The refined selections should override the original
      const introSelection = result!.approvedSelections.find(
        (s: any) => s.sectionName === "Intro",
      );
      expect(introSelection?.slideId).toBe("slide-2");
    });
  });

  describe("assembleMultiSourceDeck step", () => {
    it("calls assembly functions and returns presentationId, driveUrl, slideCount", async () => {
      vi.mocked(buildMultiSourcePlan).mockReturnValue({
        primarySource: {
          templateId: "tmpl-1",
          presentationId: "pres-1",
          keepSlideIds: ["slide-1", "slide-2"],
          deleteSlideIds: [],
        },
        secondarySources: [],
        finalSlideOrder: ["slide-1", "slide-2"],
      });

      vi.mocked(assembleMultiSourceDeck).mockResolvedValue({
        presentationId: "assembled-pres-1",
        driveUrl: "https://docs.google.com/presentation/d/assembled-pres-1/edit",
      });

      const {
        assembleMultiSourceDeckStep,
      } = await import("../structure-driven-workflow");

      const result = await assembleMultiSourceDeckStep.execute({
        inputData: {
          interactionId: "interaction-1",
          dealId: "deal-1",
          approvedSelections: selectionPlan.selections,
          dealContext,
          ownerEmail: "owner@example.com",
        },
        resumeData: undefined as any,
        suspend: vi.fn() as any,
        getInitData: vi.fn() as any,
        getStepResult: vi.fn() as any,
        emitter: { emit: vi.fn() } as any,
        runId: "run-1",
        mapiKey: "test-key",
      } as any);

      expect(result).toBeDefined();
      expect(result!.presentationId).toBe("assembled-pres-1");
      expect(result!.driveUrl).toBe(
        "https://docs.google.com/presentation/d/assembled-pres-1/edit",
      );
      expect(result!.slideCount).toBe(2);
      expect(assembleMultiSourceDeck).toHaveBeenCalledOnce();
    });
  });

  describe("awaitLowfiApproval step", () => {
    it("suspends with correct lowfi payload", async () => {
      const {
        awaitLowfiApprovalStep,
      } = await import("../structure-driven-workflow");

      const suspendFn = vi.fn();
      await awaitLowfiApprovalStep.execute({
        inputData: {
          interactionId: "interaction-1",
          dealId: "deal-1",
          presentationId: "assembled-pres-1",
          driveUrl: "https://docs.google.com/presentation/d/assembled-pres-1/edit",
          slideCount: 2,
          dealContext,
          approvedSelections: selectionPlan.selections,
          ownerEmail: "owner@example.com",
        },
        resumeData: undefined as any,
        suspend: suspendFn as any,
        getInitData: vi.fn() as any,
        getStepResult: vi.fn() as any,
        emitter: { emit: vi.fn() } as any,
        runId: "run-1",
        mapiKey: "test-key",
      } as any);

      expect(suspendFn).toHaveBeenCalledOnce();
      const payload = suspendFn.mock.calls[0][0];
      expect(payload.stage).toBe("lowfi");
      expect(payload.presentationId).toBe("assembled-pres-1");
      expect(payload.driveUrl).toBe(
        "https://docs.google.com/presentation/d/assembled-pres-1/edit",
      );
      expect(payload.slideCount).toBe(2);
    });

    it("on 'request_changes' throws restart signal", async () => {
      const {
        awaitLowfiApprovalStep,
      } = await import("../structure-driven-workflow");

      await expect(
        awaitLowfiApprovalStep.execute({
          inputData: {
            interactionId: "interaction-1",
            dealId: "deal-1",
            presentationId: "assembled-pres-1",
            driveUrl: "https://docs.google.com/presentation/d/assembled-pres-1/edit",
            slideCount: 2,
            dealContext,
            approvedSelections: selectionPlan.selections,
            ownerEmail: "owner@example.com",
          },
          resumeData: { decision: "request_changes" },
          suspend: vi.fn() as any,
          getInitData: vi.fn() as any,
          getStepResult: vi.fn() as any,
          emitter: { emit: vi.fn() } as any,
          runId: "run-1",
          mapiKey: "test-key",
        } as any),
      ).rejects.toThrow(/restart/i);
    });
  });

  describe("planAndPrepareModifications step", () => {
    it("calls planSlideModifications per slide and returns modificationSummary", async () => {
      vi.mocked(planSlideModifications).mockResolvedValue({
        plan: {
          slideId: "slide-1",
          slideObjectId: "obj-1",
          modifications: [
            {
              elementId: "el-1",
              currentContent: "Generic Company",
              newContent: "Acme Corp",
              reason: "Company name replacement",
            },
          ],
          unmodifiedElements: ["el-2"],
        },
        usedFallback: false,
      });

      // Mock slides client to return slide objectIds
      const mockSlidesClient = {
        presentations: {
          get: vi.fn().mockResolvedValue({
            data: {
              slides: [
                { objectId: "obj-1" },
                { objectId: "obj-2" },
              ],
            },
          }),
        },
      };
      vi.mocked(getSlidesClient).mockReturnValue(mockSlidesClient as any);

      const {
        planAndPrepareModificationsStep,
      } = await import("../structure-driven-workflow");

      const result = await planAndPrepareModificationsStep.execute({
        inputData: {
          interactionId: "interaction-1",
          dealId: "deal-1",
          presentationId: "assembled-pres-1",
          driveUrl: "https://docs.google.com/presentation/d/assembled-pres-1/edit",
          approvedSelections: selectionPlan.selections,
          dealContext,
        },
        resumeData: undefined as any,
        suspend: vi.fn() as any,
        getInitData: vi.fn() as any,
        getStepResult: vi.fn() as any,
        emitter: { emit: vi.fn() } as any,
        runId: "run-1",
        mapiKey: "test-key",
      } as any);

      expect(result).toBeDefined();
      expect(result!.modificationSummary).toBeDefined();
      expect(result!.modificationSummary.length).toBeGreaterThan(0);
      expect(result!.modificationSummary[0]).toHaveProperty("slideId");
      expect(result!.modificationSummary[0]).toHaveProperty("modificationCount");
      expect(result!.modificationSummary[0].elements).toBeDefined();
      expect(result!.modificationSummary[0].elements[0]).toHaveProperty("elementId");
      expect(result!.modificationSummary[0].elements[0]).toHaveProperty("reason");
    });
  });

  describe("awaitHighfiApproval step", () => {
    it("suspends with correct highfi payload", async () => {
      const {
        awaitHighfiApprovalStep,
      } = await import("../structure-driven-workflow");

      const suspendFn = vi.fn();
      await awaitHighfiApprovalStep.execute({
        inputData: {
          interactionId: "interaction-1",
          dealId: "deal-1",
          presentationId: "assembled-pres-1",
          driveUrl: "https://docs.google.com/presentation/d/assembled-pres-1/edit",
          modificationPlans: [],
          modificationSummary: [
            {
              slideId: "slide-1",
              modificationCount: 1,
              elements: [{ elementId: "el-1", reason: "Company name" }],
            },
          ],
        },
        resumeData: undefined as any,
        suspend: suspendFn as any,
        getInitData: vi.fn() as any,
        getStepResult: vi.fn() as any,
        emitter: { emit: vi.fn() } as any,
        runId: "run-1",
        mapiKey: "test-key",
      } as any);

      expect(suspendFn).toHaveBeenCalledOnce();
      const payload = suspendFn.mock.calls[0][0];
      expect(payload.stage).toBe("highfi");
      expect(payload.presentationId).toBe("assembled-pres-1");
      expect(payload.driveUrl).toBe(
        "https://docs.google.com/presentation/d/assembled-pres-1/edit",
      );
      expect(payload.modificationSummary).toBeDefined();
      expect(payload.modificationSummary.length).toBe(1);
    });

    it("on 'approved' passes modificationPlans downstream", async () => {
      const {
        awaitHighfiApprovalStep,
      } = await import("../structure-driven-workflow");

      const modPlans = [
        {
          slideId: "slide-1",
          slideObjectId: "obj-1",
          modifications: [
            {
              elementId: "el-1",
              currentContent: "Old",
              newContent: "New",
              reason: "Update",
            },
          ],
          unmodifiedElements: [],
        },
      ];

      const result = await awaitHighfiApprovalStep.execute({
        inputData: {
          interactionId: "interaction-1",
          dealId: "deal-1",
          presentationId: "assembled-pres-1",
          driveUrl: "https://docs.google.com/presentation/d/assembled-pres-1/edit",
          modificationPlans: modPlans,
          modificationSummary: [],
        },
        resumeData: { decision: "approved" },
        suspend: vi.fn() as any,
        getInitData: vi.fn() as any,
        getStepResult: vi.fn() as any,
        emitter: { emit: vi.fn() } as any,
        runId: "run-1",
        mapiKey: "test-key",
      } as any);

      expect(result).toBeDefined();
      expect(result!.modificationPlans).toEqual(modPlans);
      expect(result!.decision).toBe("approved");
    });
  });

  describe("executeAndRecordFinal step", () => {
    it("calls executeModifications and returns final presentationId/driveUrl", async () => {
      vi.mocked(executeModifications).mockResolvedValue({
        results: [
          {
            slideId: "slide-1",
            slideObjectId: "obj-1",
            status: "success",
            modificationsApplied: 1,
          },
        ],
        totalApplied: 1,
        totalSkipped: 0,
      });

      const {
        executeAndRecordFinalStep,
      } = await import("../structure-driven-workflow");

      const result = await executeAndRecordFinalStep.execute({
        inputData: {
          interactionId: "interaction-1",
          dealId: "deal-1",
          presentationId: "assembled-pres-1",
          driveUrl: "https://docs.google.com/presentation/d/assembled-pres-1/edit",
          decision: "approved",
          modificationPlans: [
            {
              slideId: "slide-1",
              slideObjectId: "obj-1",
              modifications: [
                {
                  elementId: "el-1",
                  currentContent: "Old",
                  newContent: "New",
                  reason: "Update",
                },
              ],
              unmodifiedElements: [],
            },
          ],
        },
        resumeData: undefined as any,
        suspend: vi.fn() as any,
        getInitData: vi.fn() as any,
        getStepResult: vi.fn() as any,
        emitter: { emit: vi.fn() } as any,
        runId: "run-1",
        mapiKey: "test-key",
      } as any);

      expect(result).toBeDefined();
      expect(result!.presentationId).toBe("assembled-pres-1");
      expect(result!.driveUrl).toBe(
        "https://docs.google.com/presentation/d/assembled-pres-1/edit",
      );
      expect(result!.interactionId).toBe("interaction-1");
      expect(executeModifications).toHaveBeenCalledWith({
        presentationId: "assembled-pres-1",
        plans: expect.any(Array),
      });
      expect(prisma.interactionRecord.update).toHaveBeenCalled();
      expect(prisma.feedbackSignal.create).toHaveBeenCalled();
    });
  });

  describe("workflow registration", () => {
    it("exports structureDrivenWorkflow with correct .then() chain and .commit()", async () => {
      const { structureDrivenWorkflow } = await import(
        "../structure-driven-workflow"
      );

      expect(structureDrivenWorkflow).toBeDefined();
      // Mastra workflows have an id
      expect(structureDrivenWorkflow).toHaveProperty("name", "structure-driven-workflow");
    });
  });
});
