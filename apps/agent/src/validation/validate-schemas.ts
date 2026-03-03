/**
 * validate-schemas.ts — Gemini Round-Trip Schema Validation
 *
 * Validates all 10 LLM schemas against the live Gemini 2.5 Flash API:
 * 1. Convert Zod schema to JSON Schema via zodToGeminiSchema()
 * 2. Send realistic domain prompt with responseJsonSchema to Gemini
 * 3. Parse Gemini's JSON response through Zod .parse()
 * 4. Report PASS/FAIL per schema, exit 0 if all pass, exit 1 if any fail
 *
 * Run: pnpm validate-schemas (from apps/agent)
 */

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { env } from "../env";
import {
  zodToGeminiSchema,
  TranscriptFieldsLlmSchema,
  SalesBriefLlmSchema,
  SlideAssemblyLlmSchema,
  ROIFramingLlmSchema,
  PagerContentLlmSchema,
  IntroDeckSelectionLlmSchema,
  CapabilityDeckSelectionLlmSchema,
  CompanyResearchLlmSchema,
  HypothesesLlmSchema,
  DiscoveryQuestionsLlmSchema,
} from "@lumenalta/schemas";

// --- Preflight: check for API key ---

if (!env.GEMINI_API_KEY) {
  console.error(
    "ERROR: GEMINI_API_KEY is not set. Set it in your .env file or environment.\n" +
      "Get a key from: https://aistudio.google.com/apikey"
  );
  process.exitCode = 1;
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

// --- Schema test definitions ---

interface SchemaTest {
  name: string;
  schema: z.ZodType;
  prompt: string;
}

const tests: SchemaTest[] = [
  {
    name: "TranscriptFieldsLlmSchema",
    schema: TranscriptFieldsLlmSchema,
    prompt: `Extract structured fields from this meeting transcript:

"Thanks for meeting with us today. We're Meridian Health Systems, a mid-size healthcare company struggling with patient data interoperability across our 12 clinic locations. Our CTO, Dr. Sarah Chen, is leading this initiative. We also have VP of Operations Mark Williams involved. We want a unified patient data platform by Q3 next year. Budget is around $500K but flexible if ROI is clear. The main constraint is HIPAA compliance — we can't have any patient data in the cloud without proper BAA agreements. Our goal is to reduce duplicate testing across clinics by 30% and cut patient intake time in half."

Return all fields. Use empty string for any field not found in the transcript.`,
  },
  {
    name: "SalesBriefLlmSchema",
    schema: SalesBriefLlmSchema,
    prompt: `Given the following extracted transcript fields, generate a structured sales brief for Lumenalta.

Company: Meridian Health Systems
Industry: Health Care
Subsector: Telehealth

Context: The customer is a mid-size healthcare company with 12 clinic locations struggling with patient data interoperability. They want a unified patient data platform.
Business Outcomes: Reduce duplicate testing by 30%, cut patient intake time in half.
Constraints: HIPAA compliance required, BAA agreements for cloud data.
Stakeholders: CTO Dr. Sarah Chen (lead), VP Operations Mark Williams.
Timeline: Q3 next year.
Budget: ~$500K, flexible with clear ROI.

Primary capability area: digital transformation. Generate 2-3 use cases with ROI outcomes and value hypotheses.`,
  },
  {
    name: "SlideAssemblyLlmSchema",
    schema: SlideAssemblyLlmSchema,
    prompt: `You are assembling a proposal slide deck for a healthcare digital transformation engagement with Meridian Health Systems.

Create a 4-slide deck structure:
1. Title slide introducing the proposal
2. Problem statement slide about patient data interoperability challenges
3. Proposed solution slide about the unified patient data platform
4. Next steps slide with timeline and action items

Each slide should have a title, 3-4 bullet points, speaker notes, and reference a source block ID (use placeholder IDs like 'atlusai-block-001', 'atlusai-block-002', etc.).`,
  },
  {
    name: "ROIFramingLlmSchema",
    schema: ROIFramingLlmSchema,
    prompt: `Generate ROI framing for the following 2 use cases for Meridian Health Systems (healthcare company, 12 clinic locations):

1. Patient data interoperability across 12 clinics — connecting disparate EHR systems into a unified data layer
2. Telehealth platform modernization — upgrading legacy telehealth infrastructure to support 10x patient volume

For each use case, provide 2-3 specific ROI outcome statements with quantifiable metrics and 1 value hypothesis explaining how Lumenalta delivers value.`,
  },
  {
    name: "PagerContentLlmSchema",
    schema: PagerContentLlmSchema,
    prompt: `Generate content for a first-contact 1-2 pager for Meridian Health Systems in the Health Care industry, subsector Telehealth.

Focus on digital transformation capabilities relevant to healthcare data interoperability and telehealth modernization.

Include:
- A compelling headline tailored to their situation
- A concise value proposition (1-2 sentences)
- 3-5 key Lumenalta capabilities most relevant to their needs
- A clear call to action for the next step`,
  },
  {
    name: "IntroDeckSelectionLlmSchema",
    schema: IntroDeckSelectionLlmSchema,
    prompt: `You are selecting slides for a Meet Lumenalta intro deck for a Financial Services client interested in digital banking transformation.

Available slide IDs from the content library:
- slide-001: Company overview and mission
- slide-002: Financial Services industry expertise
- slide-003: Technology stack and capabilities
- slide-004: Digital banking case study (Acme Bank)
- slide-005: Team introduction and key personnel
- slide-006: Engagement model and timeline approach

Select the most relevant 4 slides from these 6, order them for maximum impact, and provide personalization notes for the Financial Services context.`,
  },
  {
    name: "CapabilityDeckSelectionLlmSchema",
    schema: CapabilityDeckSelectionLlmSchema,
    prompt: `Select slides for a capability alignment deck for a Technology, Media & Telecommunications client focused on cloud migration and data analytics.

Available slide IDs from the content library:
- cap-001: Cloud migration methodology overview
- cap-002: AWS/GCP/Azure multi-cloud capabilities
- cap-003: Data analytics and BI platform solutions
- cap-004: Real-time data pipeline architecture
- cap-005: TMT industry case study (StreamCo)
- cap-006: DevOps and infrastructure automation
- cap-007: AI/ML integration capabilities

Identify the relevant capability areas, select and order the most relevant slides, and provide personalization notes for this TMT client.`,
  },
  {
    name: "CompanyResearchLlmSchema",
    schema: CompanyResearchLlmSchema,
    prompt: `Research the company "Meridian Health Systems" for a pre-call briefing. They are a mid-size healthcare company with approximately 12 clinic locations focused on patient care and telehealth services.

Generate:
- 3-4 key strategic initiatives they are likely pursuing
- 2-3 recent news items or industry developments relevant to their situation
- 2-3 financial highlights that inform deal sizing
- A summary of their industry position
- 3-4 Lumenalta solutions most relevant to their needs

Note: Generate plausible research based on the company profile provided.`,
  },
  {
    name: "HypothesesLlmSchema",
    schema: HypothesesLlmSchema,
    prompt: `Generate role-specific hypotheses for a pre-call briefing. The buyer is a CTO at a mid-size healthcare company focused on digital transformation and patient data interoperability across 12 clinic locations.

Create 3 value hypotheses, each with:
- A specific hypothesis statement connecting a business need to a Lumenalta solution
- Evidence supporting the hypothesis (from industry trends, common healthcare IT challenges)
- The specific Lumenalta solution or capability that addresses it

Tailor all hypotheses to the CTO perspective (technology strategy, architecture, scalability).`,
  },
  {
    name: "DiscoveryQuestionsLlmSchema",
    schema: DiscoveryQuestionsLlmSchema,
    prompt: `Generate 5 prioritized discovery questions for a meeting with a CTO at Meridian Health Systems, a mid-size healthcare company focused on patient data interoperability and telehealth modernization.

For each question provide:
- The discovery question text
- Priority level: "high", "medium", or "low"
- Rationale for why this question matters
- The Lumenalta solution area it maps to

Focus on uncovering technical requirements, architecture preferences, and decision-making criteria.`,
  },
];

// --- Execution loop ---

async function main(): Promise<void> {
  console.log("=== Gemini Round-Trip Schema Validation ===\n");
  console.log(`Model: gemini-2.5-flash`);
  console.log(`Schemas to validate: ${tests.length}\n`);

  let failures = 0;
  let passes = 0;

  for (const test of tests) {
    try {
      // Convert Zod schema to Gemini-compatible JSON Schema
      const jsonSchema = zodToGeminiSchema(test.schema);

      // Call Gemini with responseJsonSchema
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: test.prompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
        },
      });

      const text = response.text ?? "{}";

      // Round-trip: parse Gemini's JSON response through Zod
      const parsed = JSON.parse(text);
      test.schema.parse(parsed);

      console.log(`PASS: ${test.name}`);
      passes++;
    } catch (error: unknown) {
      failures++;
      const err = error as Error;

      if (err.name === "ZodError" || err.constructor?.name === "ZodError") {
        // Zod parse failure — log raw response for debugging
        console.error(`FAIL: ${test.name} - Zod validation error: ${err.message}`);
      } else {
        // Gemini API error or JSON parse error
        console.error(`FAIL: ${test.name} - ${err.message}`);
      }
    }

    // Rate limit protection: 500ms delay between Gemini calls
    if (tests.indexOf(test) < tests.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // --- Summary ---
  console.log(`\n=== Results ===`);
  console.log(`${passes}/${tests.length} schemas validated successfully`);

  if (failures > 0) {
    console.error(`${failures} schema(s) failed validation`);
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exitCode = 1;
});
