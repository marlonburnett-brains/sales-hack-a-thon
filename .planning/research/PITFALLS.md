# Pitfalls Research

**Domain:** Agentic AI + Google Slides API + RAG — Sales Orchestration Platform
**Researched:** 2026-03-03
**Confidence:** MEDIUM-HIGH (training data for Google Slides API / Gemini API; LOW for Mastra-specific edge cases as it is a relatively new framework; web search unavailable during this session)

---

## Critical Pitfalls

### Pitfall 1: Google Slides API Placeholder ID Blindness

**What goes wrong:**
The Google Slides API identifies text boxes and shapes by opaque, auto-generated placeholder IDs (e.g., `p` for title, `i0` for subtitle), not by human-readable names. When you duplicate a template slide or copy a layout, the new slide's placeholder IDs are NOT the same as the template slide's. Code that hardcodes `TITLE`, `BODY`, or sequential IDs breaks silently — the API accepts the request but inserts text into the wrong placeholder or returns a 400 error for a missing object ID.

**Why it happens:**
Developers inspect a slide in the API response, see a placeholder named `TITLE`, and assume that name is stable across all slides derived from that template. In reality, placeholder `objectId` values are UUID-style strings assigned at creation time. Duplicating a slide creates new UUIDs. The human-readable `type` field (TITLE, BODY, CENTERED_TITLE) is a hint, not an ID.

**How to avoid:**
After every `duplicateObject` or `createSlide` call, immediately call `presentations.get` on the affected slide to fetch the current placeholder `objectId` list. Build a mapping function: `getPlaceholderIdByType(slide, 'TITLE')` that reads the live presentation state before inserting text. Never hardcode objectIds across template duplication operations.

**Warning signs:**
- `insertTextRequest` returns HTTP 400 with "Invalid requests[0].insertText: The object (TITLE) could not be found."
- Text appears in the wrong box (usually the first text box in insertion order, not the intended one)
- Works on the first slide but breaks on slide 3+ after template duplication

**Phase to address:**
Phase with Google Slides API integration (deck assembly). Must be addressed in the first working slide-generation spike before any content pipeline is built on top of it.

---

### Pitfall 2: Google Slides batchUpdate Request Ordering Causes Silent Data Corruption

**What goes wrong:**
The Slides API `batchUpdate` endpoint accepts an array of requests and executes them sequentially. Operations that depend on each other (e.g., duplicate a slide, then insert text into that slide's new placeholder) fail when batched in a single call because the objectId from the first operation is not known until the response is received. Developers batch everything for efficiency, and the second operation references an objectId that doesn't exist yet — resulting in a 400 error that rolls back the entire batch.

**Why it happens:**
The batchUpdate API appears to accept multiple request types, which encourages developers to bundle everything into one round trip. The problem is that the response to step 1 (which contains the new objectId) is needed as input to step 2, but you cannot reference response data within the same batch call.

**How to avoid:**
Separate dependent operations into sequential batchUpdate calls. Batch only truly independent operations (e.g., replacing text in multiple already-existing slides). The pattern is: Call 1 → duplicate template slide, receive new objectId. Call 2 → insert content using that objectId. Accepting 2–3 round trips per slide is correct behavior.

**Warning signs:**
- Intermittent 400 errors on batchUpdate when building complex decks
- Works when slides are added one at a time but fails when batched
- Stack traces pointing to `OBJECT_NOT_FOUND` on objectIds you are certain you created

**Phase to address:**
Deck assembly phase. Add an integration test that creates a slide, reads back its IDs, and inserts content in a second call — before writing any higher-level abstraction.

---

### Pitfall 3: Gemini Structured Output Schema Rejections for Complex Zod v4 Schemas

**What goes wrong:**
Gemini's structured output (JSON mode with `responseSchema`) supports a subset of JSON Schema — not the full spec. Specifically: `anyOf`/`oneOf` unions with more than trivial cases, recursive schemas, schemas with `default` values, `additionalProperties: false` at deeply nested levels, and schemas using `$ref` are all problematic. Zod v4 schemas that look correct will generate a JSON Schema representation that Gemini rejects at runtime, often with a non-descriptive `400 Invalid argument` response.

**Why it happens:**
Gemini's structured output implementation uses a constrained schema validator internally. Zod v4's `z.discriminatedUnion`, `z.lazy` (recursive), `z.brand`, and some `z.transform` patterns produce JSON Schema that violates Gemini's subset constraints. The error message rarely tells you which field caused the rejection.

**How to avoid:**
Test every Zod schema independently against Gemini before integrating it into the agent pipeline. Use flat, non-recursive schemas where possible. Replace `z.discriminatedUnion` with a flat `z.object` with an explicit `type: z.enum(...)` field. Avoid `z.default()` on required fields in structured output contexts — Gemini may not honor defaults. Maintain a `toGeminiSchema()` adapter that strips incompatible annotations before sending to the API.

**Warning signs:**
- `400 Invalid argument: JSON schema is not supported` on requests that worked with simpler schemas
- Schema validation passes locally (Zod parse succeeds) but Gemini rejects the schema itself
- Errors appear only when a specific optional field is populated

**Phase to address:**
Transcript extraction / structured output phase. Validate all core schemas (TranscriptExtraction, SalesBrief, SlideOrder) against live Gemini API in isolation before building agent logic around them.

---

### Pitfall 4: Mastra Agent Suspend/Resume State Not Persisted by Default

**What goes wrong:**
Mastra's HITL pattern uses `agent.suspend()` to pause execution at a checkpoint and `agent.resume()` with approval data to continue. If the application server restarts, deploys, or crashes between suspend and resume, the in-memory suspension state is lost. The agent cannot be resumed — the workflow is orphaned. For a hackathon demo, this means a server restart between the HITL approval step and deck generation silently drops the job.

**Why it happens:**
Mastra's default execution model is in-process. Suspension state is held in memory (or in a lightweight local store) rather than a durable external store. Developers assume the framework handles persistence because it handles orchestration — but persistence requires explicit configuration of a storage backend.

**How to avoid:**
Configure Mastra with a durable storage backend for workflow state — even for the hackathon, use a local SQLite or PostgreSQL instance as the Mastra storage adapter. Do not rely on in-memory suspension. Add a workflow status table that tracks: `workflowId`, `status` (pending / suspended / approved / complete / failed), `suspendedAt`, `approvedBy`, `resumePayload`. This makes HITL state survives restarts and is auditable.

**Warning signs:**
- HITL approval endpoint returns 200 but the deck is never generated
- Server restart between demo steps causes "workflow not found" errors
- No way to list currently suspended workflows from the UI

**Phase to address:**
HITL workflow phase (Phase 1 infrastructure, before any content pipeline is built). The state persistence model must be established before HITL is wired up, not retrofitted after.

---

### Pitfall 5: RAG Chunking at the Deck Level Instead of the Slide Block Level

**What goes wrong:**
Content library is indexed as whole decks (one document = one deck) rather than as individual slide blocks. Semantic search returns a deck that "probably has a relevant case study slide somewhere" but cannot surface the specific slide. The assembly agent gets back a 40-slide deck when it needed one capability description slide. Relevance scores are diluted by irrelevant slides in the same deck, causing the wrong blocks to be selected.

**Why it happens:**
Indexing whole files is the path of least resistance (upload file, done). Slide-level chunking requires pre-processing: extract each slide's content, tag it with metadata (slide index, deck ID, slide type, industry tags, solution pillar), and index each chunk separately. Teams skip this because it feels like over-engineering until the retrieval is demonstrably broken.

**How to avoid:**
Before loading any content into AtlusAI, define the chunking schema: `{ deckId, slideIndex, slideType, title, bodyText, speakerNotes, tags: { industry[], solutionPillar[], funnelStage, slideCategory } }`. Each slide becomes one retrievable unit. Cross-reference slides back to their source deck for context. For case study slides, chunk at the narrative section level (problem, solution, outcome) if a single slide is too coarse. This must be done before the RAG pipeline is tested.

**Warning signs:**
- Retrieval returns "a deck" rather than "a slide"
- The agent prompt has to say "find the relevant slide within this deck" — that logic belongs in the retrieval layer, not the agent
- Retrieval relevance scores are uniformly low (below 0.6) even for clearly matching content

**Phase to address:**
Content library population phase (earliest phase). Wrong chunking strategy means re-indexing all 62 subsectors of content — expensive to fix late. Define and validate the chunk schema with 2–3 decks before bulk indexing.

---

### Pitfall 6: Google Slides Image Insertion via URL Requires Public Access

**What goes wrong:**
The Google Slides API `createImage` request accepts an image URL, not a binary upload. The URL must be publicly accessible from Google's servers at the time the API call is made. Images stored in Google Drive (even in the service account's Drive) cannot be inserted by Drive URL — Google's image embedding infrastructure does not authenticate against Drive. Inserting a private Drive image URL silently inserts a broken image placeholder in the slide.

**Why it happens:**
Developers assume that because they're using a Google service account with Drive access, Google's own services can read from that Drive. Image embedding in Slides uses a different infrastructure path that does not inherit Drive OAuth.

**How to avoid:**
For brand assets and approved image library: host images in a public Google Cloud Storage bucket (with fine-grained ACL) or make them publicly accessible via a signed URL. Alternatively, use the Drive API to get a `webContentLink` that can be temporarily made public. For the hackathon, the simplest pattern is: upload brand images to GCS with public-read ACL during content library setup, store the GCS URLs in AtlusAI, use those URLs in Slides API calls.

**Warning signs:**
- Slide shows a broken image icon or gray placeholder box
- No error is thrown — the API returns 200 but the slide has an empty image frame
- Works when using a direct external URL (e.g., Unsplash) but not with internal URLs

**Phase to address:**
Content library setup and slide assembly phase. Must be validated with a single image insertion test before building the slide assembly pipeline.

---

### Pitfall 7: HITL Browser-Close Leaves Approval State Ambiguous

**What goes wrong:**
The seller or SME opens the HITL approval interface, makes edits, and then closes the browser tab before clicking "Approve." The workflow remains in `suspended` state indefinitely. If there is no timeout or re-notification mechanism, the deck is never generated. If there IS an auto-timeout that resumes without approval, the system generates slides without SME sign-off — violating the hard constraint.

**Why it happens:**
Server-side workflows and browser sessions are decoupled. The browser close event is not reliably communicated to the server (beforeunload is unreliable, especially on mobile). Teams build HITL as "the button sends a POST" without designing what happens when the button is never clicked.

**How to avoid:**
Design HITL state as a first-class entity with explicit lifecycle: `created → notified → viewed → approved/rejected/expired`. Add: (1) a `viewedAt` timestamp set when the approval link is opened, (2) a configurable expiry (e.g., 48h) that transitions to `expired` and re-notifies, (3) the approval link is a stateless URL that works in any browser session — not a session-bound interaction. Never auto-approve on timeout. Re-notify on expiry, do not auto-proceed.

**Warning signs:**
- Workflows stuck in `suspended` state in the database with no `approvedAt`
- No alerting when a HITL checkpoint is not acted on within X hours
- Approval link fails if the user is in a different browser than when they received the notification

**Phase to address:**
HITL workflow phase. The expiry/re-notification logic must be designed upfront, not added when QA discovers orphaned workflows.

---

### Pitfall 8: Zod v4 `.transform()` on LLM Output Causes Type Inference Collapse

**What goes wrong:**
Zod v4 schemas that use `.transform()` to post-process LLM output (e.g., normalizing industry names, trimming whitespace, mapping enum values) break Mastra's structured output enforcement. The schema passed to the LLM must be the input type (pre-transform), but the type seen by downstream code is the output type (post-transform). When Mastra serializes the schema for the Gemini API, it uses the Zod schema's JSON Schema representation — if `.transform()` changes the shape, the inferred TypeScript types no longer match what the LLM is asked to produce.

**Why it happens:**
`.transform()` is idiomatic Zod and works perfectly for user input validation. LLM structured output is a different contract: the schema serves double duty as (a) the JSON Schema sent to the model and (b) the TypeScript type of the parsed result. Transforms that alter shape violate the assumption that input schema = output schema.

**How to avoid:**
Do NOT use `.transform()` on schemas that will be sent to Gemini for structured output. Use `.transform()` only in a post-parsing step after the raw LLM response is already validated. Pattern: `const rawSchema = z.object({...})` (no transforms) → send this to Gemini → parse the response → apply transforms separately: `const result = applyNormalization(rawSchema.parse(response))`. Keep the "LLM schema" and "application schema" as separate objects.

**Warning signs:**
- TypeScript type errors between the schema definition and the downstream usage
- Gemini returns valid JSON that fails `schema.parse()` with a transform-related error
- `.safeParse()` returns `success: false` on output that looks structurally correct

**Phase to address:**
Schema definition phase. Establish the raw vs. normalized schema pattern as a team convention before any schemas are written, not as a refactor after.

---

### Pitfall 9: Content Library Population Bottleneck Blocks All RAG Testing

**What goes wrong:**
The RAG pipeline, HITL flow, and slide assembly pipeline all depend on AtlusAI being populated with real, indexed content. If content ingestion is treated as a prerequisite to be done "before the demo," the team has no ability to test the full pipeline until the last hours. 62 subsectors with case studies, slide blocks, and capability descriptions is a significant indexing job. If the ingestion script fails midway, re-indexing is time-consuming and the indexing job is not idempotent by default.

**Why it happens:**
Content library work is perceived as "data entry" rather than engineering. It gets deprioritized or assigned to non-technical team members without building the tooling to make it reliable. The first full pipeline test then happens with incomplete or incorrectly indexed content.

**How to avoid:**
Treat content ingestion as an engineering deliverable with its own phase: (1) build the ingestion script with idempotency (re-running does not create duplicates), (2) ingest 2–3 subsectors from each of the 11 industries first and validate retrieval quality, (3) only then bulk-ingest remaining content. Build a content inventory manifest (which decks are loaded, which slides extracted, indexed status per chunk) so the team knows exactly what is in AtlusAI at any moment.

**Warning signs:**
- "We'll load the content this weekend" said in day 3 of a 5-day hackathon
- No way to query AtlusAI to see what has been indexed
- The first full pipeline test depends on content being loaded correctly

**Phase to address:**
Phase 1 (parallel with infrastructure setup). Content ingestion must start on day 1 so retrieval can be validated on day 2. It is the longest-lead-time item in the pipeline.

---

### Pitfall 10: Google Slides Layout ID Mismatch Between Template and New Presentation

**What goes wrong:**
When a Google Slides deck is created from a template, the `layouts` in the new presentation have different layout IDs than those in the source template. Code that stores "use layout ID `p3`" from the template will fail when applied to the generated presentation. `addSlide` requests that specify a `layoutId` will get a 400 if that layout does not exist in the target presentation's master.

**Why it happens:**
Google Slides templates use their own master + layout hierarchy. When you copy slides or create a presentation programmatically, the master is carried over but the layout IDs are reassigned in the new presentation's scope. Developers inspect the template, note the layout IDs, and hardcode them — which only works if the generated presentation starts from a copy of that exact template.

**How to avoid:**
The correct pattern for brand-compliant slides is: (1) Copy the entire template presentation using Drive API `files.copy` — this preserves the master and layout IDs in their original mapping. (2) Then add/modify slides within that copy. Do NOT create a blank presentation and try to apply layouts from a separate template. Alternatively, store layout IDs by querying the copied presentation immediately after creation.

**Warning signs:**
- `addSlide` returns 400 with "Invalid layout" or "Layout not found in master"
- Works in manual testing against one specific presentation but fails in production
- Layout IDs in your config look like UUIDs that differ per run

**Phase to address:**
Deck assembly phase. The "copy template first, then modify" pattern must be established in the first API integration spike.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding slide placeholder objectIds from one template inspection | Saves 1 API call per slide | Breaks on any template change or duplication; causes silent wrong-slot inserts | Never — the ID fetch is a 50-line utility function |
| Indexing full decks rather than individual slides in AtlusAI | Ingestion is trivial (upload file) | Retrieval quality is fundamentally broken; requires full re-index to fix | Never — slide-level chunking is the minimum viable granularity |
| Using in-memory Mastra workflow state (no durable storage) | Zero setup time | Any server restart orphans all active HITL workflows; catastrophic for demo | Acceptable ONLY for a local demo with no server restart risk |
| Batching all Slides API operations into one batchUpdate | Saves round trips | 400 errors when any op depends on a previous op's output objectId | Acceptable for updating text in already-existing slides; never for create-then-modify |
| Sending Zod `.transform()` schemas directly to Gemini | DRY — one schema object | Type drift, Gemini schema rejection, runtime parse failures | Never — maintain separate raw/normalized schema objects |
| Using Drive file URLs for images in Slides API | No GCS setup needed | Images silently fail to embed; broken placeholders in output slides | Never — Drive URLs are not publicly accessible to Google Slides infrastructure |
| Single monolithic Gemini prompt for transcript extraction + brief generation | Fewer API calls | Context window contamination; hard to debug which extraction failed; harder to unit test | Split transcript extraction and brief generation into separate, smaller calls |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google Slides API | Using `insertText` to set title without first fetching current slide placeholder objectIds | Call `presentations.get` after every slide duplication; map placeholders by `type` field, not by assumed ID |
| Google Slides API | Creating slides then immediately batching text inserts in the same `batchUpdate` | Separate into: Call 1 = create slide (get objectId from response), Call 2 = insert content using that objectId |
| Google Slides API | Inserting images from Google Drive URLs | Host images in public GCS bucket; store GCS URLs in AtlusAI; reference those in `createImage` requests |
| Google Drive API | Forgetting that `files.copy` triggers a "made a copy of X" notification to watchers | Use `supportsAllDrives: true` and confirm the service account has access to the Shared Drive |
| Gemini API | Sending complex Zod schemas with `anyOf`, `$ref`, or `default` values | Validate every schema against Gemini in isolation; use flat, non-recursive schemas; strip `default` annotations |
| Gemini API | Using `gemini-flash` for structured output and expecting deterministic JSON | Add `temperature: 0` for structured output calls; even then, build `.safeParse()` + retry logic around every structured call |
| Mastra | Treating `agent.suspend()` as a durable pause | Configure explicit storage backend (SQLite/Postgres); test suspend/resume across a server restart before demo day |
| AtlusAI | Assuming semantic search alone is sufficient for slide retrieval | Use hybrid search: semantic + metadata filters (`industry`, `solutionPillar`, `funnelStage`); pure semantic search returns thematically similar but not contextually appropriate slides |
| AtlusAI | No deduplication strategy during ingestion | Build idempotent ingestion: hash slide content + metadata as a document fingerprint; skip if already indexed |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Sequential Slides API calls (one HTTP request per slide) | Deck generation takes 3–5 minutes for a 15-slide deck; timeout errors | Batch independent operations (text replacements across multiple existing slides) into single batchUpdate calls | Breaks at ~8 slides on a 30-second demo timeout |
| Full presentation fetch (`presentations.get`) on every slide operation | API response is 500KB+ for a large deck; adds 800ms per round trip | Cache the presentation object after the initial fetch; only re-fetch after mutations that change objectIds | Breaks at ~5 slides when the presentation has many existing slides |
| Unthrottled AtlusAI queries during slide assembly (one query per slide) | Rate limit errors from AtlusAI; assembly pipeline stalls | Batch retrieval queries; pre-fetch all needed blocks in one query set before starting slide creation | Breaks at ~10 slides if AtlusAI has per-minute rate limits |
| Gemini API calls without exponential backoff retry | 429 rate limit errors cause entire workflow to fail; no recovery | Implement retry with jitter for all Gemini calls; Gemini Flash has generous limits but structured output calls are heavier | Breaks during concurrent workflow runs (2+ sellers simultaneously) |
| Transcript extraction in a single prompt with 50,000-token transcript | Context window is technically sufficient but output quality degrades | Chunk transcripts by speaker turn or time segment; extract fields in passes rather than one mega-prompt | Quality degrades beyond ~10,000 tokens of transcript |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing Google service account JSON key in the repository | Full Drive/Slides access compromise; can delete all Lumenalta sales assets | Store service account key in environment variables only; add `service-account*.json` to `.gitignore` immediately at project start |
| Seller-submitted transcripts stored unencrypted in application database | Transcripts contain deal-sensitive, legally discoverable competitive information | Encrypt transcript content at rest; apply field-level encryption on the `rawTranscript` column; define retention policy |
| AtlusAI API key in frontend JavaScript bundle | Anyone with browser devtools can query your entire content library | AtlusAI queries must only be made from the server-side agent layer; the frontend never calls AtlusAI directly |
| HITL approval endpoint without authentication | Anyone with the approval URL can approve or reject any workflow | Approval links must be authenticated (short-lived signed token tied to the specific workflow and approver email); never use plain UUID-in-URL |
| Service account with Editor role on entire Shared Drive | Compromised service account can modify/delete all existing Lumenalta sales materials | Scope service account to a dedicated `AI-Generated` subfolder only; it should never have write access to the canonical template library |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No progress indicator during the 2–3 minute deck generation pipeline | Seller thinks the UI is broken; refreshes the page; breaks the in-flight workflow | Show a step-by-step pipeline status: "Extracting transcript..." → "Retrieving content blocks..." → "Generating slides..." → "Done." Poll a status endpoint every 3 seconds |
| HITL approval UI shows raw JSON rather than a formatted brief | SME cannot read the brief; approves without reviewing; defeats the purpose of HITL | Render the SalesBrief as a formatted card UI with labeled fields; never expose raw JSON to end users |
| Missing fields surfaced as validation errors AFTER the user submits | Seller pastes a 3,000-word transcript, submits, gets "budget not mentioned" error — wastes time | Surface likely missing fields as inline warnings while the transcript is being typed (debounced analysis); confirm before full submission |
| HITL approval link delivered only via email | SME is in a Slack-first workplace; email sits unread for 4 hours | Deliver approval notifications via both email AND a Slack webhook; include a direct link in both |
| Deck generation produces a file with the generic name "Untitled Presentation" | Seller cannot find the deck in Drive; cannot tell which deck belongs to which prospect | Auto-name decks: `[CompanyName] - [PrimaryPillar] - [Date]`; set this in the Drive `files.copy` call at creation time |

---

## "Looks Done But Isn't" Checklist

- [ ] **Slide placeholder insertion:** Verify text actually lands in the correct placeholder (title vs. body) by visually inspecting the generated slide — not just checking for 200 response
- [ ] **Image embedding:** Confirm images render in the slide (not broken placeholders) by opening the generated deck in Google Slides UI before demo
- [ ] **HITL state persistence:** Restart the application server with a workflow in `suspended` state and confirm it can still be resumed — do not rely on in-memory assumptions
- [ ] **Structured output Zod validation:** Run every schema against Gemini API independently with a live call before integrating into the agent pipeline
- [ ] **Content library coverage:** Confirm at least one retrievable slide chunk exists for each of the 11 industries before running end-to-end pipeline tests
- [ ] **RAG retrieval quality:** Manually verify that a query for "Healthcare digital transformation case study" returns a Healthcare slide, not a loosely related Technology slide
- [ ] **Service account permissions:** Confirm the service account can create a file in the target Shared Drive folder — not just in its own My Drive
- [ ] **Talk track and FAQ generation:** These are often treated as "just another prompt" but must also produce structured, brand-approved content — verify they do not hallucinate Lumenalta capabilities not in the content library
- [ ] **Transcript edge cases:** Test with a transcript that mentions no budget, no timeline, and multiple stakeholders with conflicting priorities — verify the missing-field flagging triggers correctly
- [ ] **Demo environment parity:** Confirm the demo environment uses the same AtlusAI index as development — not a test index with a handful of slides

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong chunking strategy (deck-level instead of slide-level) | HIGH | Re-process all source decks through the slide extraction script; delete and re-index all documents in AtlusAI; re-validate retrieval quality on all 11 industries |
| Hardcoded placeholder IDs break on template change | MEDIUM | Build the `getPlaceholderIdByType()` utility function; refactor all slide-insert code to use it; test against a fresh copy of the template |
| In-memory HITL state lost after restart | MEDIUM | Configure Mastra storage backend (SQLite); run migration to persist any currently-active workflow state; re-notify stakeholders for orphaned HITL checkpoints |
| Gemini schema rejection mid-pipeline | MEDIUM | Isolate the failing schema; simplify to a flat object; test independently; update all callers; add a schema validation unit test that runs against the live API |
| Images not embedding (Drive URL issue) | LOW | Upload brand assets to GCS public bucket (30 min); update AtlusAI image URLs; rerun deck generation |
| HITL approval links expire before SME reviews | LOW | Extend expiry window; re-trigger notification to SME; resume workflow manually if needed |
| Content library only partially indexed before demo | HIGH | Prioritize the specific industries/subsectors needed for the demo scenario; run targeted re-ingestion; document what is covered and what is not for the Q&A |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Placeholder ID blindness | Phase: Slides API integration spike | Test: Insert text into title and body of a duplicated slide; visually confirm correct placement |
| batchUpdate ordering errors | Phase: Slides API integration spike | Test: Run a create-then-insert sequence and confirm no OBJECT_NOT_FOUND errors |
| Gemini schema rejections | Phase: Schema definition / structured output | Test: Send each schema to Gemini API in isolation with a minimal prompt; confirm parse succeeds |
| Mastra HITL state not persisted | Phase: Infrastructure / HITL workflow design | Test: Restart server with suspended workflow; confirm it resumes correctly |
| RAG chunking at deck level | Phase: Content library ingestion (Phase 1) | Test: Query AtlusAI for a specific slide type; confirm response is a single slide chunk, not a full deck |
| Image insertion via Drive URLs | Phase: Content library setup + Slides API spike | Test: Insert one brand image into a test slide; open in UI and confirm it renders |
| HITL browser-close ambiguity | Phase: HITL workflow design | Test: Open approval UI, close browser, wait 1 minute; confirm workflow remains in `suspended`, not `approved` |
| Zod `.transform()` in LLM schemas | Phase: Schema definition | Test: Run `.safeParse()` on Gemini structured output response; confirm no transform-related errors |
| Content library bottleneck | Phase: Content ingestion (Day 1 start) | Test: Confirm retrieval returns relevant results for 3 different industries before Day 3 |
| Layout ID mismatch | Phase: Slides API integration spike | Test: Create presentation from template copy; add slide with layout; confirm no 400 error |
| Unthrottled AtlusAI queries | Phase: Slide assembly pipeline | Test: Simulate 15-slide deck assembly; confirm no rate limit errors and total time < 60s |
| Service account scope too broad | Phase: Infrastructure / credentials setup | Test: Confirm service account cannot write to canonical template library folder; only to AI-Generated folder |

---

## Sources

- Google Slides API official documentation (batchUpdate, placeholder types, image insertion constraints) — HIGH confidence for API behavior
- Gemini API structured output documentation (supported JSON Schema subset) — MEDIUM confidence; schema constraint specifics verified from training data as of August 2025
- Mastra AI framework documentation and GitHub — LOW confidence for specific edge cases; Mastra is actively developed and behavior may have changed post-August 2025
- General RAG chunking best practices (LlamaIndex, Langchain documentation on structured content chunking) — HIGH confidence for principles; applied to slide domain
- Google Drive API service account + Shared Drive permission model — HIGH confidence; well-documented and stable
- HITL state management patterns for agentic workflows — MEDIUM confidence; derived from patterns in durable workflow systems (Temporal, AWS Step Functions) applied to Mastra's model
- Zod v4 documentation and known LLM integration patterns — MEDIUM confidence; Zod v4 is relatively recent as of knowledge cutoff

---

**Note on web search unavailability:** WebSearch and WebFetch were unavailable during this research session. All findings are drawn from training data (knowledge cutoff August 2025) and applied domain reasoning. Mastra-specific pitfalls (Pitfalls 4, 7) should be validated against current Mastra documentation and GitHub issues before treating as authoritative. All Google Slides API and Gemini API pitfalls have HIGH-MEDIUM confidence from stable official documentation patterns.

---
*Pitfalls research for: Agentic AI + Google Slides API + RAG — Sales Orchestration (Lumenalta Hackathon)*
*Researched: 2026-03-03*
