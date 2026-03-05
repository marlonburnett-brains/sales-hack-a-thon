# Phase 10: Pre-Call Briefing Flow - Research

**Researched:** 2026-03-04
**Domain:** Mastra workflow orchestration, Gemini structured output, Google Docs API, Next.js form patterns
**Confidence:** HIGH

## Summary

Phase 10 builds a pre-call briefing pipeline that is structurally simpler than the existing Touch 4 workflow (14 steps) but shares all major infrastructure patterns: Mastra `createStep`/`createWorkflow` with `.then()` chaining, Gemini 2.5 Flash structured output via `zodToGeminiSchema()`, Google Docs creation via `doc-builder.ts`, per-deal Drive folders via `drive-folders.ts`, and InteractionRecord tracking via Prisma. The three Zod LLM schemas needed (CompanyResearchLlmSchema, HypothesesLlmSchema, DiscoveryQuestionsLlmSchema) already exist and were validated against Gemini in Phase 3.

The primary new work is: (1) a new "Prep" section on the deal page above the Touch 1-4 grid, (2) a pre-call input form component, (3) a ~6-step Mastra workflow (researchCompany, queryCaseStudies, generateHypotheses, generateDiscoveryQuestions, buildBriefingDoc, saveToDrive), (4) a briefing results display component, and (5) the plumbing (API client functions, server actions, API routes, TOUCH_TYPES enum extension). Every pattern has a direct precedent in Phases 4-8.

**Primary recommendation:** Follow the Touch 2/3 direct-generation pattern (no HITL suspend/resume) with the doc creation pattern from Touch 4 Steps 13-14. The pre-call workflow is a read-generate-save pipeline with no intermediate seller review checkpoint.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Pre-call briefing lives on the deal page in a separate "Prep" section above the touch flow cards (Touch 1-4)
- Visual hierarchy: Prep section (pre-call) above Engagement section (Touch 1-4) to signal different stages
- Full interaction tracking: each briefing creates an InteractionRecord with touchType='pre_call'
- Briefing output saved to per-deal Drive folder via getOrCreateDealFolder()
- Multiple briefings per deal supported -- each run creates its own InteractionRecord and Google Doc
- Gemini generates company snapshot from its training data -- no external web search API
- AtlusAI queried for relevant case studies matching the company's industry -- 1-2 case study references included
- AtlusAI also provides Lumenalta solution mapping context for hypothesis and question generation
- Confident professional analyst tone -- no data freshness disclaimers or hedging
- Free-text textarea for meeting context (agenda, goals, previous conversations, concerns)
- Form fields: company name (from deal), industry (from deal), buyer role (dropdown), meeting context (textarea)
- Section order: Company Snapshot -> Value Hypotheses -> Discovery Questions -> Relevant Case Studies
- Same structure in web app and Google Doc -- identical content, different styling
- Web app: shadcn/ui cards and badges (consistent with existing deal page components)
- Google Doc: headings and body text via doc-builder.ts (consistent with Phase 8 talk track and FAQ patterns)
- Doc naming: "[CompanyName] - Pre-Call Briefing - [BuyerRole] - [Date]"
- 3-5 role-specific hypotheses per briefing with hypothesis statement, supporting evidence, mapped Lumenalta solution
- 5-10 prioritized questions per briefing with mapped Lumenalta solution area as visible badge/tag
- Priority levels shown (high/medium/low) to help seller focus
- Single buyer role per briefing from BUYER_PERSONAS (9 options including "General" fallback)
- Full tailoring: buyer role influences all sections

### Claude's Discretion
- Mastra workflow step composition (how many steps, sequential vs parallel)
- Gemini prompt engineering for company research generation quality
- Exact shadcn/ui component choices for the briefing display cards
- Error handling for Gemini or AtlusAI failures during generation
- Loading states and progress indicators during pipeline execution
- How to surface prior pre-call briefings for the same deal in the Prep section
- Google Doc styling details (font sizes, spacing, heading levels)
- Whether industry dropdown pre-fills from deal record or allows override

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BRIEF-01 | Seller can input company name, buyer role, and meeting context into a web form to initiate a briefing | Pre-call form component pattern from Touch 1 form; BUYER_PERSONAS constant exists; deal page provides companyName/industry pre-fill |
| BRIEF-02 | System generates company snapshot (key initiatives, recent news, financial highlights) from public sources and AtlusAI | CompanyResearchLlmSchema exists and validated; Gemini 2.5 Flash structured output pattern from Touch 4; AtlusAI search via atlusai-search.ts |
| BRIEF-03 | System generates role-specific hypotheses tailored to buyer persona | HypothesesLlmSchema exists and validated; BUYER_PERSONAS constant with 9 roles; buyer role passed through Gemini prompt |
| BRIEF-04 | System generates 5-10 prioritized discovery questions mapped to Lumenalta solution areas | DiscoveryQuestionsLlmSchema exists and validated; SOLUTION_PILLARS constant for mapping; priority as string (Gemini-safe) |
| BRIEF-05 | Completed briefing displayed in web app and saved as Google Doc to shared Drive | doc-builder.ts createGoogleDoc() pattern from Phase 8; getOrCreateDealFolder() for per-deal storage; InteractionRecord for tracking |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @mastra/core | 1.8.0 | Workflow orchestration (createStep, createWorkflow) | Already used for Touch 1-4 workflows; provides suspend/resume, step chaining |
| @google/genai | latest | Gemini 2.5 Flash structured output | Already used in all LLM steps across Touch 4 workflow |
| googleapis | latest | Google Docs API, Google Drive API | Already used via google-auth.ts, doc-builder.ts, drive-folders.ts |
| zod | ^4.3.6 | Schema validation and Gemini JSON schema generation | Used across all schemas; z.toJSONSchema() for Gemini compatibility |
| @prisma/client | latest | Database access for InteractionRecord, Deal, Company | Used across all workflows for persistence |
| next | 15.x | Web app framework with Server Actions | Already the web app runtime |
| shadcn/ui | - | UI components (Card, Badge, Button, Select, Textarea) | 12 primitives initialized in Phase 4; consistent across all touch flows |
| lucide-react | latest | Icons (FileText, Sparkles, Loader2, ExternalLink, etc.) | Already used across all touch flow components |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @lumenalta/schemas | workspace | Shared LLM schemas, constants, zodToGeminiSchema | Import CompanyResearchLlmSchema, HypothesesLlmSchema, DiscoveryQuestionsLlmSchema, BUYER_PERSONAS, SOLUTION_PILLARS |

### Alternatives Considered
None -- all libraries are already in use across the project. No new dependencies needed.

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/src/mastra/workflows/
  pre-call-workflow.ts          # 6-step Mastra workflow

apps/agent/src/mastra/
  index.ts                      # Add pre-call-workflow registration + API routes

apps/agent/prisma/
  schema.prisma                 # Add 'pre_call' to touchType comment

packages/schemas/
  constants.ts                  # Add 'pre_call' to TOUCH_TYPES

apps/web/src/components/pre-call/
  pre-call-form.tsx             # Input form component
  pre-call-results.tsx          # Briefing results display
  pre-call-section.tsx          # Prep section wrapper for deal page

apps/web/src/lib/
  api-client.ts                 # Add startPreCallWorkflow, getPreCallStatus
  actions/pre-call-actions.ts   # Server actions for pre-call flow

apps/web/src/app/deals/[dealId]/
  page.tsx                      # Add Prep section above Touch cards
```

### Pattern 1: Mastra Sequential Workflow (Touch 2/3 Direct-Generation Pattern)
**What:** Linear step chain with no suspend/resume checkpoints
**When to use:** The pre-call briefing is a fire-and-forget generation pipeline -- the seller submits and waits for results. No intermediate HITL review is needed (unlike Touch 4).
**Example:**
```typescript
// Source: touch-2-workflow.ts pattern
export const preCallWorkflow = createWorkflow({
  id: "pre-call-workflow",
  inputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    buyerRole: z.string(),
    meetingContext: z.string(),
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    docUrl: z.string(),
  }),
})
  .then(researchCompany)
  .then(queryCaseStudies)
  .then(generateHypotheses)
  .then(generateDiscoveryQuestions)
  .then(buildBriefingDoc)
  .then(recordInteraction)
  .commit();
```

### Pattern 2: Gemini 2.5 Flash Structured Output
**What:** Use zodToGeminiSchema() to convert Zod schemas to Gemini responseSchema, then parse the JSON response back through Zod
**When to use:** Every LLM step in the pre-call workflow (company research, hypotheses, discovery questions)
**Example:**
```typescript
// Source: touch-4-workflow.ts Step 1 (parseTranscript)
const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY! });
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt,
  config: {
    responseMimeType: "application/json",
    responseSchema: zodToGeminiSchema(CompanyResearchLlmSchema) as Record<string, unknown>,
  },
});
const text = response.text ?? "";
const parsed = CompanyResearchLlmSchema.parse(JSON.parse(text));
```

### Pattern 3: Google Doc Creation via doc-builder.ts
**What:** Build DocSection[] array with headings (HEADING_1, HEADING_2) and body text, then call createGoogleDoc()
**When to use:** The buildBriefingDoc step that creates the Google Doc output
**Example:**
```typescript
// Source: touch-4-workflow.ts Step 13 (createTalkTrack)
const sections: DocSection[] = [
  {
    heading: `${companyName} - Pre-Call Briefing`,
    headingLevel: "HEADING_1",
    body: `Prepared for ${buyerRole} meeting on ${dateStr}.`,
  },
  {
    heading: "Company Snapshot",
    headingLevel: "HEADING_2",
    body: companyResearch.keyInitiatives.join("\n") + "\n\n" + ...,
  },
  // ... more sections
];

const result = await createGoogleDoc({
  title: `${companyName} - Pre-Call Briefing - ${buyerRole} - ${dateStr}`,
  dealFolderId,
  sections,
});
```

### Pattern 4: InteractionRecord Tracking
**What:** Create InteractionRecord with touchType='pre_call', store inputs as JSON, store outputRefs with doc URL
**When to use:** Final step of the workflow records the interaction for timeline display and deal history
**Example:**
```typescript
// Source: touch-2-workflow.ts Step 3 (recordInteraction)
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
      companyResearch: inputData.companyResearch,
      hypotheses: inputData.hypotheses,
      discoveryQuestions: inputData.discoveryQuestions,
      caseStudies: inputData.caseStudies,
    }),
    outputRefs: JSON.stringify({ briefingDocUrl: inputData.docUrl }),
    driveFileId: inputData.documentId,
  },
});
```

### Pattern 5: Server Actions -> API Client -> Agent Service Proxy
**What:** Three-layer communication: React component calls Server Action, which calls api-client function, which calls agent service HTTP endpoint
**When to use:** All web-to-agent communication for the pre-call flow
**Example:**
```typescript
// api-client.ts
export async function startPreCallWorkflow(
  dealId: string,
  formData: {
    companyName: string;
    industry: string;
    buyerRole: string;
    meetingContext: string;
  }
): Promise<WorkflowStartResult> {
  return fetchJSON<WorkflowStartResult>(
    "/api/workflows/pre-call-workflow/start",
    {
      method: "POST",
      body: JSON.stringify({ inputData: { dealId, ...formData } }),
    }
  );
}
```

### Pattern 6: AtlusAI Case Study Search via Drive Fallback
**What:** Use atlusai-search.ts searchForProposal() or a simpler Drive fullText search to find case study content matching the company's industry
**When to use:** The queryCaseStudies step that retrieves 1-2 relevant case studies from the knowledge base
**Example:**
```typescript
// Source: atlusai-search.ts pattern
import { searchSlides } from "../../lib/atlusai-search";

const caseStudies = await searchSlides(
  `case study ${industry}`,
  { maxResults: 5 }
);
// Filter to case_study metadata type, take top 1-2
const relevantCases = caseStudies
  .filter(r => r.metadata?.slideCategory === "case_study_outcome" ||
               r.metadata?.slideCategory === "case_study_solution")
  .slice(0, 2);
```

### Anti-Patterns to Avoid
- **Creating a new Prisma model for briefings:** Use InteractionRecord with touchType='pre_call' and generatedContent JSON -- same pattern as Touch 1-3. No new model needed.
- **Using suspend/resume for this workflow:** The pre-call flow has no intermediate review step. Use the direct generation pattern from Touch 2/3, not the suspend/resume pattern from Touch 1/4.
- **Calling external web search APIs:** Locked decision -- Gemini generates company snapshot from training data only. No Serper, SerpAPI, or browser automation.
- **Hand-rolling Google Docs formatting:** Use the existing doc-builder.ts buildDocRequests/createGoogleDoc pattern. Do not make direct Docs API calls.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Google Doc creation | Custom batchUpdate calls | `createGoogleDoc()` from doc-builder.ts | Handles index computation, heading styles, bold ranges, folder placement, permissions |
| Per-deal Drive folder | Custom folder creation logic | `getOrCreateDealFolder()` from drive-folders.ts | Idempotent, handles naming convention, supportsAllDrives |
| Gemini JSON schema | Manual JSON Schema construction | `zodToGeminiSchema()` from gemini-schema.ts | Strips $schema key, handles Zod v4 toJSONSchema |
| Workflow orchestration | Custom async step chaining | Mastra `createWorkflow().then().commit()` | Provides execution tracking, error handling, step output persistence |
| Form validation | Manual validation logic | Zod schemas for input validation | Consistent with all other forms; shared with agent-side validation |
| API proxying | Direct fetch from components | Server Actions -> api-client.ts -> agent | Established three-layer proxy pattern; handles error wrapping, path revalidation |

**Key insight:** Every infrastructure piece needed for Phase 10 already exists. The work is composing existing patterns into a new workflow and UI, not building new infrastructure.

## Common Pitfalls

### Pitfall 1: TOUCH_TYPES Constant Not Updated
**What goes wrong:** The pre_call touchType is used in InteractionRecord but the TOUCH_TYPES constant in packages/schemas/constants.ts still only has touch_1 through touch_4. The interaction timeline and deal page filtering may not display pre-call interactions correctly.
**Why it happens:** Constants.ts is easy to forget when adding a new touch type.
**How to avoid:** Update TOUCH_TYPES in constants.ts AND add a comment to the Prisma schema touchType field documenting the new value.
**Warning signs:** Pre-call interactions not appearing in the InteractionTimeline component.

### Pitfall 2: Workflow Not Registered in Mastra Index
**What goes wrong:** The workflow file exists but is not imported and registered in apps/agent/src/mastra/index.ts. The `/api/workflows/pre-call-workflow/start` endpoint returns 404.
**Why it happens:** Mastra requires explicit workflow registration in the `workflows` object.
**How to avoid:** Add the import and registration in mastra/index.ts alongside the touch workflows.
**Warning signs:** 404 from the workflow start endpoint.

### Pitfall 3: Gemini Prompt Quality for Company Research
**What goes wrong:** Gemini generates generic, vague company snapshots that don't provide actionable sales intelligence.
**Why it happens:** The prompt doesn't provide enough context about what makes a good pre-call briefing, or doesn't leverage the industry/buyer role to focus the research.
**How to avoid:** Include the buyer role and meeting context in the company research prompt to focus Gemini on role-relevant information. Reference SOLUTION_PILLARS so Gemini connects company context to Lumenalta capabilities.
**Warning signs:** All briefings for the same company produce identical output regardless of buyer role.

### Pitfall 4: AtlusAI Search Returns No Case Studies
**What goes wrong:** The case study search returns empty results for certain industries, leaving the briefing without proof points.
**Why it happens:** AtlusAI ingestion may not have complete case study coverage for all 11 industries.
**How to avoid:** Implement a fallback strategy similar to searchForProposal's three-tier fallback: industry-specific, then broad industry, then cross-industry. If no case studies found, include a "No matching case studies available" note rather than failing.
**Warning signs:** Empty case study section in generated briefings.

### Pitfall 5: Deal Page Layout Regression
**What goes wrong:** Adding the Prep section above the touch flow cards breaks the existing responsive grid layout (lg:grid-cols-2 xl:grid-cols-4).
**Why it happens:** The Prep section is a new UI element that needs to integrate with the existing page structure without disrupting the touch card grid.
**How to avoid:** Keep the Prep section as its own full-width container above the existing touch flow card grid. Do not nest it inside the grid.
**Warning signs:** Touch flow cards misaligned or wrapping unexpectedly on different screen sizes.

### Pitfall 6: Missing Pre-Call Workflow Polling
**What goes wrong:** The UI submits the form but never polls for workflow completion, leaving the user staring at a loading spinner indefinitely.
**Why it happens:** Unlike Touch 1 (which has suspend/resume), the pre-call workflow runs start-to-finish. But it still takes 10-30 seconds for Gemini calls + Doc creation. The UI needs to poll the workflow status endpoint.
**How to avoid:** Follow the same polling pattern as Touch 2/3 forms: start workflow, get runId, poll getPreCallWorkflowStatus(runId) on an interval until status is "completed" or "failed".
**Warning signs:** Infinite loading state after form submission.

## Code Examples

Verified patterns from the existing codebase:

### Gemini Structured Output Call (from touch-4-workflow.ts)
```typescript
const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY! });
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt,
  config: {
    responseMimeType: "application/json",
    responseSchema: zodToGeminiSchema(TargetLlmSchema) as Record<string, unknown>,
  },
});
const text = response.text ?? "";
const parsed = TargetLlmSchema.parse(JSON.parse(text));
```

### Google Doc with Multiple Sections (from touch-4-workflow.ts Step 13)
```typescript
import { createGoogleDoc } from "../../lib/doc-builder";
import type { DocSection } from "../../lib/doc-builder";

const sections: DocSection[] = [
  {
    heading: "Document Title",
    headingLevel: "HEADING_1",
    body: "Introduction paragraph.",
  },
  {
    heading: "Section Name",
    headingLevel: "HEADING_2",
    body: "Section body text with details.",
    boldRanges: [{ start: 0, end: 12 }], // optional bold formatting
  },
];

const result = await createGoogleDoc({
  title: "My Document Title",
  dealFolderId: folderId,
  sections,
});
// result.documentId, result.docUrl
```

### Workflow Status Polling (from touch-1-form.tsx)
```typescript
const pollStatus = useCallback(
  async (currentRunId: string, targetStatuses: string[], pollMessage: string) => {
    const maxAttempts = 60;
    let attempts = 0;
    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 2000));
      const status = await checkStatusAction(currentRunId);
      if (targetStatuses.includes(status.status)) {
        return status;
      }
      if (status.status === "failed") {
        throw new Error("Workflow failed");
      }
      attempts++;
    }
    throw new Error("Polling timeout");
  },
  []
);
```

### Deal Folder Retrieval (from touch-2-workflow.ts Step 2)
```typescript
const deal = await prisma.deal.findUniqueOrThrow({
  where: { id: inputData.dealId },
  include: { company: true },
});

const folderId = await getOrCreateDealFolder({
  companyName: deal.company.name,
  dealName: deal.name,
  parentFolderId: env.GOOGLE_DRIVE_FOLDER_ID,
});

if (!deal.driveFolderId) {
  await prisma.deal.update({
    where: { id: deal.id },
    data: { driveFolderId: folderId },
  });
}
```

### AtlusAI Search for Case Studies (from atlusai-search.ts pattern)
```typescript
import { searchSlides } from "../../lib/atlusai-search";

// searchSlides uses Drive fullText search against ingested slide documents
const results = await searchSlides(`case study ${industry}`, { maxResults: 10 });
const caseStudies = results
  .filter(r => {
    const cat = r.metadata?.slideCategory as string;
    return cat === "case_study_outcome" || cat === "case_study_solution" || cat === "case_study_problem";
  })
  .slice(0, 2);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom fetch wrappers for Google APIs | googleapis library with service account auth | Phase 1 | Consistent auth via getDocsClient/getDriveClient |
| Manual JSON Schema for Gemini | zodToGeminiSchema() with Zod v4 native | Phase 3 | Single source of truth for validation + Gemini schema |
| Separate step execution tracking | Mastra createWorkflow with .then() chaining | Phase 4 | Built-in execution snapshots, status tracking |
| JSON blobs for interaction data | Prisma models with typed fields + JSON for flexible content | Phase 5 | Structured queries on typed fields, flexible generatedContent |

**Deprecated/outdated:**
- zod-to-json-schema package: Removed in Phase 3; use z.toJSONSchema() directly
- responseSchema (Gemini SDK): Use responseJsonSchema with zodToGeminiSchema() output instead

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual validation (no automated test framework configured) |
| Config file | none |
| Quick run command | Manual: start agent + web, create deal, run pre-call flow |
| Full suite command | Manual end-to-end walkthrough |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BRIEF-01 | Seller submits pre-call form | manual/e2e | Navigate to deal page, fill form, submit | N/A |
| BRIEF-02 | Company snapshot generated | manual/e2e | Check workflow output for CompanyResearch fields | N/A |
| BRIEF-03 | Role-specific hypotheses | manual/e2e | Compare CIO vs CFO briefing outputs for same company | N/A |
| BRIEF-04 | Discovery questions with solution mapping | manual/e2e | Verify 5-10 questions with mappedSolution badges | N/A |
| BRIEF-05 | Briefing in web app + Google Doc | manual/e2e | Check results UI + verify Doc exists in Drive folder | N/A |

### Sampling Rate
- **Per task commit:** Manual smoke test -- verify agent compiles, workflow registers
- **Per wave merge:** End-to-end flow: submit pre-call form -> verify briefing display -> verify Google Doc in Drive
- **Phase gate:** Full walkthrough with 2+ buyer roles for the same deal, verify distinct outputs

### Wave 0 Gaps
None -- no automated test infrastructure to set up. Validation is manual e2e for this hackathon project.

## Open Questions

1. **AtlusAI Case Study Search Granularity**
   - What we know: searchSlides() uses Drive fullText search on ingested slide documents; case studies are tagged with slideCategory metadata
   - What's unclear: How many case studies per industry are actually ingested and findable; whether the Drive search returns enough useful content for 1-2 case study references
   - Recommendation: Implement the search with a graceful fallback (empty case studies section if none found) and test with 2-3 industries to calibrate

2. **Gemini Company Research Quality Without Web Search**
   - What we know: Gemini 2.5 Flash will generate company research from training data; no external web search API
   - What's unclear: How current/specific Gemini's training data is for any given company; whether output quality meets seller expectations
   - Recommendation: Design the prompt to request confident, analyst-tone output as decided; include SOLUTION_PILLARS and industry context for relevance; the "no freshness disclaimers" decision means we accept training data quality

3. **Workflow Step Count Optimization**
   - What we know: Each Gemini call takes 3-8 seconds; there are 3 LLM calls (company research, hypotheses, questions) plus 1 AtlusAI search + 1 Doc creation
   - What's unclear: Whether combining multiple Gemini calls into fewer steps improves latency
   - Recommendation: Keep steps separate for clarity and debuggability. The 3 Gemini calls are sequential because hypotheses depend on company research and questions depend on both. Total pipeline time estimate: 15-25 seconds.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: touch-4-workflow.ts (14-step pipeline pattern, Gemini call pattern, doc creation pattern)
- Codebase inspection: touch-2-workflow.ts (direct generation pattern without HITL)
- Codebase inspection: doc-builder.ts (createGoogleDoc, DocSection interface)
- Codebase inspection: drive-folders.ts (getOrCreateDealFolder, makePubliclyViewable)
- Codebase inspection: packages/schemas/llm/company-research.ts, hypotheses.ts, discovery-questions.ts
- Codebase inspection: packages/schemas/constants.ts (BUYER_PERSONAS, SOLUTION_PILLARS, TOUCH_TYPES)
- Codebase inspection: apps/agent/src/mastra/index.ts (workflow registration, API route pattern)
- Codebase inspection: apps/web/src/lib/api-client.ts (fetchJSON wrapper, workflow start/status pattern)
- Codebase inspection: apps/web/src/lib/actions/touch-actions.ts (server action proxy pattern)
- Codebase inspection: apps/web/src/app/deals/[dealId]/page.tsx (deal page layout, touch card grid)
- Codebase inspection: apps/web/src/components/touch/touch-1-form.tsx (form state machine, polling pattern)
- Codebase inspection: apps/agent/prisma/schema.prisma (InteractionRecord model, touchType field)
- Codebase inspection: packages/schemas/gemini-schema.ts (zodToGeminiSchema helper)

### Secondary (MEDIUM confidence)
- None needed -- all patterns verified directly in codebase

### Tertiary (LOW confidence)
- Gemini training data quality for company-specific research: untested, quality may vary by company size/prominence

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - every pattern has a direct precedent in existing codebase (Touch 2/3 for workflow, Touch 4 Steps 13-14 for doc creation)
- Pitfalls: HIGH - identified from direct codebase analysis of integration points
- Gemini research quality: MEDIUM - prompt engineering discretion; no external search API per locked decision

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable -- all patterns are established in the existing codebase)
