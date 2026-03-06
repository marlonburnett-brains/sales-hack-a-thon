/**
 * Pre-Call Briefing Workflow
 *
 * End-to-end pipeline that prepares sellers for discovery calls:
 * 1. Researches the target company via Gemini
 * 2. Queries AtlusAI for relevant case studies
 * 3. Generates role-specific value hypotheses
 * 4. Generates prioritized discovery questions
 * 5. Creates a formatted Google Doc briefing in the per-deal Drive folder
 * 6. Records the InteractionRecord with full inputs and outputRefs
 *
 * Uses the direct-generation pattern (no suspend/resume) -- like Touch 2.
 * Steps: researchCompany -> queryCaseStudies -> generateHypotheses
 *        -> generateDiscoveryQuestions -> buildBriefingDoc -> recordInteraction
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import {
  CompanyResearchLlmSchema,
  HypothesesLlmSchema,
  DiscoveryQuestionsLlmSchema,
  zodToGeminiSchema,
  SOLUTION_PILLARS,
} from "@lumenalta/schemas";
import { searchSlides } from "../../lib/atlusai-search";
import { createGoogleDoc } from "../../lib/doc-builder";
import type { DocSection } from "../../lib/doc-builder";
import { getOrCreateDealFolder } from "../../lib/drive-folders";
import { prisma } from "../../lib/db";
import { env } from "../../env";

// ────────────────────────────────────────────────────────────
// Shared schemas
// ────────────────────────────────────────────────────────────

const inputSchema = z.object({
  dealId: z.string(),
  companyName: z.string(),
  industry: z.string(),
  buyerRole: z.string(),
  meetingContext: z.string(),
});

const researchOutputSchema = z.object({
  dealId: z.string(),
  companyName: z.string(),
  industry: z.string(),
  buyerRole: z.string(),
  meetingContext: z.string(),
  companyResearch: z.string(), // JSON-serialized CompanyResearch
});

const caseStudiesOutputSchema = researchOutputSchema.extend({
  caseStudies: z.string(), // JSON-serialized array of { title, content }
});

const hypothesesOutputSchema = caseStudiesOutputSchema.extend({
  hypotheses: z.string(), // JSON-serialized Hypotheses
});

const questionsOutputSchema = hypothesesOutputSchema.extend({
  discoveryQuestions: z.string(), // JSON-serialized DiscoveryQuestions
});

const docOutputSchema = questionsOutputSchema.extend({
  docUrl: z.string(),
  documentId: z.string(),
  dealFolderId: z.string(),
});

// ────────────────────────────────────────────────────────────
// Step 1: Research Company via Gemini 2.5 Flash
// ────────────────────────────────────────────────────────────

const researchCompany = createStep({
  id: "research-company",
  inputSchema,
  outputSchema: researchOutputSchema,
  execute: async ({ inputData }) => {
    const ai = new GoogleGenAI({ vertexai: true, project: env.GOOGLE_CLOUD_PROJECT, location: env.GOOGLE_CLOUD_LOCATION });

    const prompt = `You are a senior business analyst preparing a pre-call briefing for a sales meeting. Research ${inputData.companyName} in the ${inputData.industry} industry. The meeting is with a ${inputData.buyerRole}. Meeting context: ${inputData.meetingContext}. Provide a confident, professional analysis with no hedging or freshness disclaimers. Focus on aspects most relevant to a ${inputData.buyerRole}'s priorities. Reference these Lumenalta solution areas where relevant: ${SOLUTION_PILLARS.join(", ")}.`;

    const response = await ai.models.generateContent({
      model: "openai/gpt-oss-120b-maas",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: zodToGeminiSchema(
          CompanyResearchLlmSchema
        ) as Record<string, unknown>,
      },
    });

    const parsed = CompanyResearchLlmSchema.parse(
      JSON.parse(response.text ?? "")
    );

    return {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
      buyerRole: inputData.buyerRole,
      meetingContext: inputData.meetingContext,
      companyResearch: JSON.stringify(parsed),
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 2: Query AtlusAI for Case Studies
// ────────────────────────────────────────────────────────────

const queryCaseStudies = createStep({
  id: "query-case-studies",
  inputSchema: researchOutputSchema,
  outputSchema: caseStudiesOutputSchema,
  execute: async ({ inputData }) => {
    let caseStudies: Array<{ title: string; content: string }> = [];

    try {
      const results = await searchSlides({
        query: `case study ${inputData.industry}`,
        limit: 10,
      });

      // Filter results where metadata.slideCategory includes "case_study"
      const caseStudyResults = results.filter((r) => {
        const category = String(r.metadata?.slideCategory ?? "");
        return category.includes("case_study");
      });

      // Take top 2 results (or all if fewer)
      const topResults = caseStudyResults.slice(0, 2);

      caseStudies = topResults.map((r) => ({
        title: r.documentTitle,
        content: r.textContent.slice(0, 500), // Summary
      }));
    } catch (err) {
      console.warn(
        "[pre-call-workflow] Case study search failed, continuing with empty array:",
        err
      );
    }

    return {
      ...inputData,
      caseStudies: JSON.stringify(caseStudies),
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 3: Generate Value Hypotheses via Gemini
// ────────────────────────────────────────────────────────────

const generateHypotheses = createStep({
  id: "generate-hypotheses",
  inputSchema: caseStudiesOutputSchema,
  outputSchema: hypothesesOutputSchema,
  execute: async ({ inputData }) => {
    const ai = new GoogleGenAI({ vertexai: true, project: env.GOOGLE_CLOUD_PROJECT, location: env.GOOGLE_CLOUD_LOCATION });
    const companyResearch = JSON.parse(inputData.companyResearch);

    const researchSummary = [
      `Key initiatives: ${companyResearch.keyInitiatives?.join(", ") ?? "N/A"}`,
      `Industry position: ${companyResearch.industryPosition ?? "N/A"}`,
      `Recent news: ${companyResearch.recentNews?.join(", ") ?? "N/A"}`,
    ].join(". ");

    const prompt = `Generate 3-5 value hypotheses for a sales call with a ${inputData.buyerRole} at ${inputData.companyName}. Each hypothesis should connect a specific business need to a Lumenalta solution. Company context: ${researchSummary}. Meeting context: ${inputData.meetingContext}. Lumenalta solutions: ${SOLUTION_PILLARS.join(", ")}.`;

    const response = await ai.models.generateContent({
      model: "openai/gpt-oss-120b-maas",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: zodToGeminiSchema(HypothesesLlmSchema) as Record<
          string,
          unknown
        >,
      },
    });

    const parsed = HypothesesLlmSchema.parse(
      JSON.parse(response.text ?? "")
    );

    return {
      ...inputData,
      hypotheses: JSON.stringify(parsed),
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 4: Generate Discovery Questions via Gemini
// ────────────────────────────────────────────────────────────

const generateDiscoveryQuestions = createStep({
  id: "generate-discovery-questions",
  inputSchema: hypothesesOutputSchema,
  outputSchema: questionsOutputSchema,
  execute: async ({ inputData }) => {
    const ai = new GoogleGenAI({ vertexai: true, project: env.GOOGLE_CLOUD_PROJECT, location: env.GOOGLE_CLOUD_LOCATION });
    const companyResearch = JSON.parse(inputData.companyResearch);
    const hypotheses = JSON.parse(inputData.hypotheses);

    const researchSummary = [
      `Key initiatives: ${companyResearch.keyInitiatives?.join(", ") ?? "N/A"}`,
      `Industry position: ${companyResearch.industryPosition ?? "N/A"}`,
    ].join(". ");

    const hypothesesSummary = hypotheses.hypotheses
      ?.map(
        (h: { hypothesis: string; lumenaltaSolution: string }) =>
          `${h.hypothesis} (${h.lumenaltaSolution})`
      )
      .join("; ");

    const prompt = `Generate 5-10 prioritized discovery questions for a sales call with a ${inputData.buyerRole} at ${inputData.companyName}. Map each question to a Lumenalta solution area. Prioritize questions that validate the hypotheses: ${hypothesesSummary}. Company context: ${researchSummary}. Meeting context: ${inputData.meetingContext}.`;

    const response = await ai.models.generateContent({
      model: "openai/gpt-oss-120b-maas",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: zodToGeminiSchema(
          DiscoveryQuestionsLlmSchema
        ) as Record<string, unknown>,
      },
    });

    const parsed = DiscoveryQuestionsLlmSchema.parse(
      JSON.parse(response.text ?? "")
    );

    return {
      ...inputData,
      discoveryQuestions: JSON.stringify(parsed),
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 5: Build Briefing Google Doc
// ────────────────────────────────────────────────────────────

const buildBriefingDoc = createStep({
  id: "build-briefing-doc",
  inputSchema: questionsOutputSchema,
  outputSchema: docOutputSchema,
  execute: async ({ inputData }) => {
    // Get or create deal folder (same pattern as touch-2-workflow)
    const deal = await prisma.deal.findUniqueOrThrow({
      where: { id: inputData.dealId },
      include: { company: true },
    });

    const folderId = await getOrCreateDealFolder({
      companyName: deal.company.name,
      dealName: deal.name,
      parentFolderId: env.GOOGLE_DRIVE_FOLDER_ID,
    });

    // Update deal with folder ID if not set
    if (!deal.driveFolderId) {
      await prisma.deal.update({
        where: { id: deal.id },
        data: { driveFolderId: folderId },
      });
    }

    // Parse serialized data
    const companyResearch = JSON.parse(inputData.companyResearch);
    const hypotheses = JSON.parse(inputData.hypotheses);
    const discoveryQuestions = JSON.parse(inputData.discoveryQuestions);
    const caseStudies = JSON.parse(inputData.caseStudies) as Array<{
      title: string;
      content: string;
    }>;

    // Build DocSection[] array per the locked doc structure
    const sections: DocSection[] = [];

    // Section 1: Title / Header
    const meetingContextSummary =
      inputData.meetingContext.length > 200
        ? inputData.meetingContext.slice(0, 200) + "..."
        : inputData.meetingContext;

    sections.push({
      heading: `${inputData.companyName} - Pre-Call Briefing`,
      headingLevel: "HEADING_1",
      body: `Prepared for ${inputData.buyerRole} meeting. ${meetingContextSummary}`,
    });

    // Section 2: Company Snapshot
    const snapshotParts: string[] = [];
    if (companyResearch.keyInitiatives?.length) {
      snapshotParts.push(
        `Key Initiatives:\n${companyResearch.keyInitiatives.map((i: string) => `  - ${i}`).join("\n")}`
      );
    }
    if (companyResearch.recentNews?.length) {
      snapshotParts.push(
        `Recent News:\n${companyResearch.recentNews.map((n: string) => `  - ${n}`).join("\n")}`
      );
    }
    if (companyResearch.financialHighlights?.length) {
      snapshotParts.push(
        `Financial Highlights:\n${companyResearch.financialHighlights.map((f: string) => `  - ${f}`).join("\n")}`
      );
    }
    if (companyResearch.industryPosition) {
      snapshotParts.push(
        `Industry Position:\n  ${companyResearch.industryPosition}`
      );
    }
    if (companyResearch.relevantLumenaltaSolutions?.length) {
      snapshotParts.push(
        `Relevant Lumenalta Solutions:\n${companyResearch.relevantLumenaltaSolutions.map((s: string) => `  - ${s}`).join("\n")}`
      );
    }

    sections.push({
      heading: "Company Snapshot",
      headingLevel: "HEADING_2",
      body: snapshotParts.join("\n\n"),
    });

    // Section 3: Value Hypotheses
    const hypothesesBody = hypotheses.hypotheses
      ?.map(
        (h: { hypothesis: string; evidence: string; lumenaltaSolution: string }, i: number) =>
          `${i + 1}. ${h.hypothesis}\n   Evidence: ${h.evidence}\n   Solution: ${h.lumenaltaSolution}`
      )
      .join("\n\n");

    sections.push({
      heading: "Value Hypotheses",
      headingLevel: "HEADING_2",
      body: hypothesesBody || "No hypotheses generated.",
    });

    // Section 4: Discovery Questions
    const questionsBody = discoveryQuestions.questions
      ?.map(
        (q: { question: string; priority: string; rationale: string; mappedSolution: string }, i: number) =>
          `${i + 1}. [${q.priority.toUpperCase()}] ${q.question}\n   Rationale: ${q.rationale}\n   Solution Area: ${q.mappedSolution}`
      )
      .join("\n\n");

    sections.push({
      heading: "Discovery Questions",
      headingLevel: "HEADING_2",
      body: questionsBody || "No discovery questions generated.",
    });

    // Section 5: Relevant Case Studies
    let caseStudiesBody: string;
    if (caseStudies.length > 0) {
      caseStudiesBody = caseStudies
        .map((cs) => `${cs.title}\n${cs.content}`)
        .join("\n\n");
    } else {
      caseStudiesBody =
        "No matching case studies available for this industry.";
    }

    sections.push({
      heading: "Relevant Case Studies",
      headingLevel: "HEADING_2",
      body: caseStudiesBody,
    });

    // Create the doc with locked naming convention
    const dateStr = new Date().toISOString().split("T")[0];
    const docTitle = `${inputData.companyName} - Pre-Call Briefing - ${inputData.buyerRole} - ${dateStr}`;

    const { documentId, docUrl } = await createGoogleDoc({
      title: docTitle,
      dealFolderId: folderId,
      sections,
    });

    return {
      ...inputData,
      docUrl,
      documentId,
      dealFolderId: folderId,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 6: Record InteractionRecord
// ────────────────────────────────────────────────────────────

const recordInteraction = createStep({
  id: "record-interaction",
  inputSchema: docOutputSchema,
  outputSchema: z.object({
    interactionId: z.string(),
    docUrl: z.string(),
    documentId: z.string(),
  }),
  execute: async ({ inputData }) => {
    const interaction = await prisma.interactionRecord.create({
      data: {
        dealId: inputData.dealId,
        touchType: "pre_call",
        status: "approved",
        decision: "approved",
        inputs: JSON.stringify({
          companyName: inputData.companyName,
          industry: inputData.industry,
          buyerRole: inputData.buyerRole,
          meetingContext: inputData.meetingContext,
        }),
        generatedContent: JSON.stringify({
          companyResearch: JSON.parse(inputData.companyResearch),
          hypotheses: JSON.parse(inputData.hypotheses),
          discoveryQuestions: JSON.parse(inputData.discoveryQuestions),
          caseStudies: JSON.parse(inputData.caseStudies),
        }),
        outputRefs: JSON.stringify({ briefingDocUrl: inputData.docUrl }),
        driveFileId: inputData.documentId,
      },
    });

    // Update deal.driveFolderId if not set
    const deal = await prisma.deal.findUnique({
      where: { id: inputData.dealId },
    });
    if (deal && !deal.driveFolderId) {
      await prisma.deal.update({
        where: { id: deal.id },
        data: { driveFolderId: inputData.dealFolderId },
      });
    }

    return {
      interactionId: interaction.id,
      docUrl: inputData.docUrl,
      documentId: inputData.documentId,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Workflow: Pre-Call Briefing
// ────────────────────────────────────────────────────────────

export const preCallWorkflow = createWorkflow({
  id: "pre-call-workflow",
  inputSchema,
  outputSchema: z.object({
    interactionId: z.string(),
    docUrl: z.string(),
    documentId: z.string(),
  }),
})
  .then(researchCompany)
  .then(queryCaseStudies)
  .then(generateHypotheses)
  .then(generateDiscoveryQuestions)
  .then(buildBriefingDoc)
  .then(recordInteraction)
  .commit();
