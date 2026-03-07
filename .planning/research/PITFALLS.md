# Pitfalls Research

**Domain:** Adding artifact type sub-classification (Proposal / Talk Track / FAQ) to Touch 4 Examples and per-artifact-type deck structures to existing classification/deck intelligence system
**Researched:** 2026-03-07
**Confidence:** HIGH (based on direct codebase analysis of all affected code paths)

## Critical Pitfalls

### Pitfall 1: DeckStructure unique constraint on touchType breaks artifact-type expansion

**What goes wrong:**
The existing `DeckStructure` model uses `touchType String @unique` as its identity. Touch 4 currently gets exactly one DeckStructure row. The new requirement is 3 separate structures for Touch 4 (Proposal, Talk Track, FAQ). If you try to store all three with `touchType: "touch_4"`, the unique constraint rejects the second insert. If you change the unique key to a composite `@@unique([touchType, artifactType])`, every existing query that does `findUnique({ where: { touchType } })` breaks -- and there are at least 6 such call sites: `auto-infer-cron.ts`, `infer-deck-structure.ts` (2 calls), `chat-refinement.ts` (2 calls), plus 3 API routes in `mastra/index.ts`.

**Why it happens:**
The DeckStructure model was designed for a 1:1 touchType-to-structure relationship. Adding a second dimension (artifact type) fundamentally changes the data model. Developers underestimate how many call sites depend on the `@unique` touchType constraint.

**How to avoid:**
Use a composite key approach. Change the unique constraint from `touchType @unique` to `@@unique([touchType, artifactType])` where `artifactType` is a new nullable String column (null = no sub-classification, i.e., Touch 1-3 behavior). Forward-only migration: add the column as nullable with default null, drop the old unique index, add the composite unique index -- all in a single migration. Update all `findUnique({ where: { touchType } })` calls to `findUnique({ where: { touchType_artifactType: { touchType, artifactType: null } } })` for Touch 1-3, and use specific artifact types for Touch 4. Use `prisma migrate dev --create-only` to inspect the SQL before applying.

**Warning signs:**
- Prisma `findUnique` calls using `{ where: { touchType } }` that fail at compile time after schema change
- Cron job iterating `DECK_TOUCH_TYPES` without considering artifact type sub-keys
- Runtime errors: "Unique constraint failed on the fields: (`touchType`)"

**Phase to address:**
Schema migration phase (first phase) -- this is the foundational data model change everything else depends on.

---

### Pitfall 2: Cron auto-inference treats Touch 4 as one unit instead of three

**What goes wrong:**
`auto-infer-cron.ts` iterates `DECK_TOUCH_TYPES` (touch_1 through touch_4, filtering out pre_call) and calls `inferDeckStructure(touchType)` once per entry. After adding artifact types, it still calls inference once for "touch_4" instead of three times (once per artifact type). Result: only one artifact type gets inferred, or the cron silently skips Touch 4 artifact sub-types entirely because it does not know they exist.

**Why it happens:**
The cron loop is driven by the `TOUCH_TYPES` constant from `@lumenalta/schemas`, not by what actually exists in the database. When you add artifact types, the constant does not change -- "touch_4" is still just one entry. Developers add the artifact type to the schema and inference function but forget to update the cron driver loop.

**How to avoid:**
Define `TOUCH_4_ARTIFACT_TYPES = ["proposal", "talk_track", "faq"] as const` in `@lumenalta/schemas/constants.ts`. Expand the cron loop: iterate `DECK_TOUCH_TYPES` for Touch 1-3 (passing `artifactType: null`), then iterate `TOUCH_4_ARTIFACT_TYPES` for Touch 4 (passing each artifact type). Both `computeDataHash` and `inferDeckStructure` must accept an optional `artifactType` parameter. The cron must call `computeDataHash(touchType, artifactType)` with the correct pair.

**Warning signs:**
- Touch 4 deck structures never auto-update after examples are classified with artifact types
- All three Touch 4 structures show identical content
- Agent logs show only one inference call for touch_4 per cycle instead of three

**Phase to address:**
Inference engine update phase -- after schema migration, before UI work.

---

### Pitfall 3: Data hash collision across artifact types causes stale or redundant inference

**What goes wrong:**
`computeDataHash` in `infer-deck-structure.ts` computes a SHA-256 over all examples matching a touch type. It filters by `contentClassification: "example"` and then checks if the template's `touchTypes` JSON array includes the touchType. It does not factor in artifact type. All three Touch 4 artifact types produce the identical hash because they query the same set of Touch 4 examples. The cron sees "hash unchanged" and skips re-inference for artifact types that actually need it, or re-infers all three every cycle even when only one artifact type's examples changed.

**Why it happens:**
The current hash input is `${t.id}:${t.contentClassification}:${t.touchTypes}`. Since all Touch 4 examples share the same `contentClassification` and `touchTypes` values, the hash is identical regardless of artifact type. The Template model has no `artifactType` field to differentiate.

**How to avoid:**
Add an `artifactType` column (nullable String) to the `Template` model. Update `computeDataHash` to accept an optional `artifactType` parameter and filter examples by it. Include artifact type in the hash input: `${t.id}:${t.contentClassification}:${t.touchTypes}:${t.artifactType ?? "none"}`. This ensures each artifact type gets its own change-detection hash.

**Warning signs:**
- Agent logs showing "hash unchanged" for Touch 4 artifact types that should have been re-inferred
- All three Touch 4 structures always infer simultaneously even when only Proposal examples changed
- Unnecessary LLM costs from redundant inference cycles

**Phase to address:**
Schema migration phase (Template model change) combined with inference update phase (hash function change).

---

### Pitfall 4: Inference prompt conflates all Touch 4 examples regardless of artifact type

**What goes wrong:**
The inference engine in `infer-deck-structure.ts` gathers ALL examples with `touchType: "touch_4"` and feeds them to Gemini. When inferring the Proposal deck structure, it also sees Talk Track and FAQ examples. The LLM produces a muddled structure that blends proposal sections with talk track elements and FAQ elements. Result: "Introduction, Problem Statement, Talk Track Overview, FAQ Section, Pricing" as one incoherent structure.

**Why it happens:**
`inferDeckStructure` queries `prisma.template.findMany({ where: { contentClassification: "example" } })` and then filters by touch type in the JSON array. It does not filter by artifact type because the field does not exist yet on the Template model. The `buildInferencePrompt` function similarly has no artifact type awareness.

**How to avoid:**
After adding `artifactType` to the Template model, update `inferDeckStructure` to accept an optional `artifactType` parameter. When provided, add it to the filter: only include examples where `t.artifactType === artifactType`. Update `buildInferencePrompt` to explicitly state which artifact type is being inferred: "You are analyzing **Proposal** decks for Touch 4+ presentations" (not generic "touch_4 presentations"). This scoping prevents cross-contamination.

**Warning signs:**
- Inferred Proposal structure containing sections like "Objection Handling" or "FAQ Overview"
- All three artifact type structures looking suspiciously similar
- Low confidence scores despite having many Touch 4 examples total (because examples are diluted across 3 types)

**Phase to address:**
Inference engine update phase -- must happen before the UI can meaningfully display per-artifact structures.

---

### Pitfall 5: Chat refinement scoped to wrong artifact type

**What goes wrong:**
Chat refinement in `chat-refinement.ts` uses `prisma.deckStructure.findUnique({ where: { touchType } })` to load the structure being refined. With the composite key, this call fails. Even after fixing the query, the chat API route (`/deck-structures/:touchType/chat`) only receives `touchType` from the URL -- there is no way to specify which artifact type the user is chatting about. The chat bar component also has no concept of artifact type; it sends requests scoped only to touch type. Result: user chats about refining the Proposal structure but the system loads/updates the Talk Track structure (whichever the query happens to return first).

**Why it happens:**
The full chain -- ChatBar component, chat API route, `streamChatRefinement` function -- was built for the 1:1 touchType model. Every link in the chain passes only `touchType`. Adding artifact type requires changes at every level.

**How to avoid:**
Thread `artifactType` through the entire chain:
1. `ChatBar` component accepts `artifactType` prop (nullable)
2. Chat API route accepts `artifactType` as query parameter or in the request body
3. `streamChatRefinement` accepts `artifactType` parameter, uses it in `findUnique` with composite key
4. Chat context and constraints stored per composite key (already handled if DeckStructure key is composite)
5. `lastChatAt` for active session protection must be checked per composite key, not just per touchType

**Warning signs:**
- Chat refinement for "Proposal" causing structure changes in "Talk Track" or "FAQ"
- Active session protection on one artifact type blocking cron for a different artifact type of the same touch
- Chat history from one artifact type appearing in another's conversation

**Phase to address:**
Inference engine update phase (backend) + UI phase (frontend ChatBar).

---

### Pitfall 6: Classify UI does not expose artifact type for Touch 4 examples

**What goes wrong:**
The classify popover in `template-card.tsx` lets users pick "Template" or "Example" and (for examples) select touch types via checkboxes. There is no UI for selecting artifact type. Users classify a presentation as a Touch 4 example but it has `artifactType: null`, so the inference engine cannot differentiate Proposals from Talk Tracks from FAQs. The feature appears to work (classification saves) but the downstream deck structures remain undifferentiated.

**Why it happens:**
The classify UI was built for binary classification (template/example) plus touch type binding. Developers add `artifactType` to the schema and inference engine but forget to surface it in the UI. The `classifyTemplateAction` still works (no errors) so nobody notices the gap until they check Settings and see identical or missing structures.

**How to avoid:**
When the user selects "Example" AND checks "Touch 4+", conditionally render a required artifact type radio group (Proposal / Talk Track / FAQ). The `classifyTemplateAction` and the agent `/templates/:id/classify` route must accept and persist `artifactType`. Make artifact type REQUIRED when touch_4 is selected as an example -- validation should reject Touch 4 examples without an artifact type. Use the `TOUCH_4_ARTIFACT_TYPES` constant from `@lumenalta/schemas` for the options.

**Warning signs:**
- Touch 4 examples in the database with `artifactType: null`
- Users classifying Touch 4 examples without being prompted for artifact type
- The classify popover looking identical before and after the feature launch
- All Touch 4 examples lumped into one undifferentiated pool for inference

**Phase to address:**
UI phase -- after schema and inference are updated. This is the user-facing entry point for the entire feature.

---

### Pitfall 7: Settings page routing and display assumes 1 structure per touch type

**What goes wrong:**
The Settings deck structures page uses URL pattern `/settings/deck-structures/[touchType]` with `VALID_SLUGS` mapping `"touch-4" -> "touch_4"`. This maps to exactly one `TouchTypeDetailView` component that fetches one `DeckStructure`. With three artifact types, the page needs to show three structures for Touch 4 but the routing and data fetching only support one. The `getDeckStructureAction` calls `getDeckStructure(touchType)` which hits `GET /deck-structures/:touchType` -- returning a single record.

**Why it happens:**
The routing, data fetching, and display were all designed for the 1:1 model. The API endpoint returns one DeckStructure. The component renders one section flow. None of these layers know about artifact types.

**How to avoid:**
Use tabs within the Touch 4 page rather than new routes. The `TouchTypePage` for touch-4 should render a tab bar (Proposal / Talk Track / FAQ), each tab mounting its own `TouchTypeDetailView` with an `artifactType` prop. The `TouchTypeDetailView` passes `artifactType` to `getDeckStructureAction`. The API endpoint `GET /deck-structures/:touchType` accepts an optional `?artifactType=proposal` query parameter. For Touch 1-3, no query param is needed (artifactType defaults to null). This avoids changing the URL structure or sidebar navigation.

**Warning signs:**
- Touch 4 page showing only one structure with no way to see the other two
- API returning 404 or wrong structure for Touch 4 artifact types
- Chat bar on Touch 4 page affecting the wrong artifact type's structure
- Sidebar showing 6 items instead of 4 (if someone tries per-artifact routes)

**Phase to address:**
UI phase -- the final phase that brings everything together for the user.

---

### Pitfall 8: Existing Touch 4 DeckStructure row and chat history become stale/conflicting

**What goes wrong:**
A DeckStructure row for `touchType: "touch_4"` may already exist from v1.5 (with chat history and context summaries). When the schema changes to composite key `[touchType, artifactType]`, this existing row needs `artifactType` assigned. If assigned null, it persists as a "generic Touch 4" structure that conflicts with the three new artifact-specific ones. Its chat context may contain constraints about all three artifact types mixed together, which would pollute any artifact-specific re-inference.

**Why it happens:**
The existing Touch 4 DeckStructure was inferred without artifact type awareness. Its `chatContextJson` and `DeckChatMessage` records reflect a combined view. There is no clean way to split one structure and its chat history into three artifact-specific pieces.

**How to avoid:**
Accept that existing Touch 4 data will not carry forward. Migration strategy:
1. In the migration, add `artifactType` as nullable to `DeckStructure`
2. Drop the `touchType @unique` index, add `@@unique([touchType, artifactType])`
3. Delete the existing `touchType: "touch_4"` DeckStructure row (cascade deletes its DeckChatMessages)
4. The next cron cycle (or manual trigger) creates fresh rows for each artifact type
5. Document this as a one-time trade-off: old Touch 4 chat refinements are lost

**Warning signs:**
- Chat context from the old combined Touch 4 structure leaking into artifact-specific inferences
- "Previous Constraints" in the prompt containing irrelevant instructions from a different artifact type
- A fourth phantom Touch 4 structure with `artifactType: null` alongside the three real ones

**Phase to address:**
Schema migration phase -- handle as part of the forward-only migration with explicit cleanup.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded `TOUCH_4_ARTIFACT_TYPES` constant instead of DB-driven | Simple, no extra query, compile-time safety | Adding new artifact types requires code change + deploy | Acceptable -- only 3 artifact types, very unlikely to change |
| Storing `artifactType` as nullable String instead of enum | No migration for new values, backward compatible | Typos cause silent bugs, no DB-level validation | Acceptable -- matches existing pattern (`contentClassification` is also String, not enum) |
| Nullable `artifactType` on Template model | Backward compatible, no data migration for Touch 1-3 | Null checks in queries and filters | Acceptable -- Touch 1-3 genuinely do not have artifact types |
| Deleting old Touch 4 DeckStructure + chat history | Clean slate, no stale context | Loses prior user refinements for Touch 4 | Acceptable -- old structure is undifferentiated and not useful per-artifact |
| Tabs on Touch 4 page instead of separate routes | No URL/sidebar changes, simpler routing | Tabs do not have distinct URLs for bookmarking/sharing | Acceptable -- internal tool for ~20 sellers, deep-linking not required |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Prisma forward-only migration with unique constraint change | Using `prisma db push` to prototype the schema change, then struggling to create a proper migration | Use `prisma migrate dev --create-only --name add_artifact_type` to inspect SQL. Per CLAUDE.md: NEVER use `db push`. NEVER reset the database. |
| DeckStructure unique constraint change | Dropping old unique index and creating new composite one in separate migrations (leaves a window with no constraint) | Do both in a single migration: `ALTER TABLE DROP CONSTRAINT ... ; CREATE UNIQUE INDEX ...` with cleanup of old touch_4 row |
| API routes with query params | Forgetting to pass `artifactType` through the full chain: web action -> api-client -> agent route -> inference | Audit the full request chain: `deck-structure-actions.ts` -> `api-client.ts` (getDeckStructure, triggerDeckInference) -> agent `/deck-structures/:touchType` -> `inferDeckStructure()` |
| Chat refinement composite key | Using `findUnique({ where: { touchType } })` which no longer works after schema change | Use `findUnique({ where: { touchType_artifactType: { touchType, artifactType } } })` with the composite key name from Prisma |
| Classify action extension | Adding `artifactType` to the classify action but not validating it against touch type | Only accept `artifactType` when `touch_4` is in selected touch types. Return 400 if `artifactType` is set for non-Touch-4 examples. |
| `computeDataHash` with artifact type | Passing `artifactType` to hash function but not filtering the example query by it | Filter examples by BOTH `touchTypes` containing `touch_4` AND `artifactType` matching the target. Hash must include artifact type in its input string. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Cron running 3x more inferences for Touch 4 | 3 additional Gemini calls per cycle; LLM cost triples for Touch 4 | Data hash per artifact type prevents unnecessary re-inference; only infer when that artifact type's examples change | Cost concern at ~$0.01/inference -- acceptable at current scale |
| Loading all 3 Touch 4 structures on page mount | Touch 4 Settings page takes 3x longer to load; 3 API calls on mount | Use tabs with lazy loading -- only fetch the active tab's structure on tab select | Not a scale issue with current data; lazy load is a UX improvement |
| Chat context accumulating across many refinement sessions | Prompt grows with each chat session as `chatContextJson` expands | Existing summarization logic (>10 messages -> summarize oldest) already handles this per structure | Unlikely with per-artifact structures since chat volume is split 3 ways |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| No validation on `artifactType` values from client | Arbitrary strings stored in DB; potential injection of unexpected values | Validate against `TOUCH_4_ARTIFACT_TYPES` constant in both agent API route and web server action |
| Classify action accepts `artifactType` for any touch type | Users could set artifactType on Touch 1-3 examples (nonsensical, breaks queries) | Only accept artifactType when `touch_4` is in the selected touch types; reject with 400 otherwise |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing artifact type selector for all touch types | Confuses users: "Why do I need to pick Proposal for a Touch 1 example?" | Only show artifact type selector when Touch 4+ is checked as a touch type in the classify dialog |
| Three empty states on Touch 4 page | Users see 3 tabs all saying "No examples classified" -- feels broken | Show a single helpful message when no Touch 4 examples exist at all, with guidance to classify by artifact type; only show tabs when at least one artifact type has examples |
| No artifact type shown on template cards | Users classify examples but cannot verify what artifact type they assigned | Extend badge: "Example (T4+ Proposal)" instead of just "Example (T4+)"; update `getClassificationLabel` in `template-utils.ts` |
| Chat bar not indicating which artifact type it refines | User thinks they are refining "Touch 4" globally but only affecting one artifact type | Label the chat bar: "Refine Touch 4+ Proposal structure" with artifact type name visible |
| Reclassifying artifact type loses chat history | User changes a presentation from Proposal to Talk Track; the old Proposal structure's example count drops but its chat refinements remain stale | Show warning when reclassifying: "This will remove this example from the Proposal deck structure" |

## "Looks Done But Isn't" Checklist

- [ ] **Schema migration:** `artifactType` column added to both `Template` and `DeckStructure` -- verify both models, not just one
- [ ] **Schema migration:** Old `touchType @unique` index dropped AND new composite `@@unique([touchType, artifactType])` added in same migration -- verify no window without constraint
- [ ] **Schema migration:** Existing touch_4 DeckStructure row deleted in migration -- verify no orphan with `artifactType: null` persists
- [ ] **Classify UI:** Artifact type selector appears ONLY when Touch 4+ is checked -- verify it is hidden for Touch 1-3
- [ ] **Classify action:** `artifactType` persisted on Template model -- verify DB has non-null value after classifying Touch 4 example
- [ ] **Inference engine:** `inferDeckStructure` filters by artifact type -- verify Proposal inference only includes Proposal examples (check agent logs for prompt content)
- [ ] **Data hash:** `computeDataHash` produces different hashes for different artifact types -- verify with manual test
- [ ] **Cron job:** Touch 4 produces 3 separate inference runs per cycle -- verify agent logs show 3 entries
- [ ] **Active session protection:** Works per composite key -- chat on Proposal does NOT block cron for Talk Track
- [ ] **API route:** `GET /deck-structures/touch_4?artifactType=proposal` returns correct structure -- verify all 3 artifact types return distinct data
- [ ] **Chat refinement:** Chat on Touch 4 Proposal only updates Proposal structure -- verify Talk Track and FAQ unchanged after Proposal chat
- [ ] **Template card badge:** Shows "Example (T4+ Proposal)" not just "Example (T4+)" -- verify text includes artifact type
- [ ] **Settings page:** Touch 4 shows tabs for Proposal / Talk Track / FAQ -- verify each tab loads its own structure and chat history
- [ ] **Touch 1-3 regression:** Touch 1-3 deck structures still work with `artifactType: null` -- verify no compile errors or runtime failures

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Unique constraint migration failure | LOW | Fix migration SQL, run `prisma migrate resolve --applied` on the failed migration, create corrective migration |
| Inference producing blended/cross-artifact structures | LOW | Fix artifact type filter in inference query, re-run inference for each artifact type; no data loss |
| Chat affecting wrong artifact type | LOW | Fix composite key in `streamChatRefinement`, delete incorrect chat messages, re-infer affected structures |
| Examples classified without artifact type | MEDIUM | Query `Template` where `contentClassification = "example"` AND `touchTypes` contains "touch_4" AND `artifactType IS NULL`; prompt users to re-classify or batch-update |
| Old Touch 4 DeckStructure not cleaned up | LOW | Delete the row manually: `DELETE FROM "DeckStructure" WHERE "touchType" = 'touch_4' AND "artifactType" IS NULL`; cascade cleans chat messages |
| Cron overwriting chat-refined artifact structure | MEDIUM | Restore from `chatContextJson`; re-infer with constraints; strengthen active session protection to use composite key |
| Touch 1-3 regression from composite key change | LOW | Verify all Touch 1-3 queries use `artifactType: null` in composite key lookup; fix any that omit it |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| DeckStructure unique constraint breaks | Phase 1: Schema Migration | `prisma migrate dev` succeeds; all `findUnique` calls compile; existing Touch 1-3 data unchanged |
| Cron treats Touch 4 as one unit | Phase 2: Inference Engine Update | Cron logs show 3 separate Touch 4 inferences per cycle; each produces distinct section flows |
| Data hash collision across artifact types | Phase 1 + Phase 2 | Different artifact types produce different hashes; cron correctly skips unchanged types |
| Inference conflates examples across artifacts | Phase 2: Inference Engine Update | Proposal inference prompt only contains Proposal examples; verify via agent log inspection |
| Chat refinement scoped to wrong artifact type | Phase 2 (backend) + Phase 3 (frontend) | Chat on Proposal updates only Proposal structure; Talk Track and FAQ remain unchanged |
| Classify UI missing artifact type | Phase 3: UI Updates | Selecting Touch 4+ shows artifact type radio; saving persists artifact type; badge displays it |
| Settings routing assumes 1:1 | Phase 3: UI Updates | Touch 4 page shows 3 tabs; each loads its own structure and has independent chat |
| Existing Touch 4 data conflicts | Phase 1: Schema Migration | Old touch_4 DeckStructure deleted; fresh rows created per artifact type by first inference run |

## Sources

- Direct codebase analysis of all affected files:
  - `apps/agent/prisma/schema.prisma` -- DeckStructure model with `touchType @unique`, Template model with `contentClassification`
  - `apps/agent/src/deck-intelligence/infer-deck-structure.ts` -- `inferDeckStructure()` and `computeDataHash()` filtering by touchType only
  - `apps/agent/src/deck-intelligence/auto-infer-cron.ts` -- cron iterating `DECK_TOUCH_TYPES`, active session protection logic
  - `apps/agent/src/deck-intelligence/chat-refinement.ts` -- `streamChatRefinement()` using `findUnique({ where: { touchType } })`
  - `apps/agent/src/deck-intelligence/deck-structure-schema.ts` -- `DeckSection` and `DeckStructureOutput` interfaces, `calculateConfidence()`
  - `apps/web/src/components/template-card.tsx` -- classify dialog with no artifact type UI
  - `apps/web/src/components/settings/touch-type-detail-view.tsx` -- single-structure display per touch type
  - `apps/web/src/app/(authenticated)/settings/deck-structures/[touchType]/page.tsx` -- 1:1 slug-to-touchType routing
  - `apps/web/src/lib/template-utils.ts` -- `getClassificationLabel()` without artifact type
  - `apps/web/src/lib/actions/deck-structure-actions.ts` -- actions passing only touchType
  - `apps/web/src/components/settings/chat-bar.tsx` -- chat bar with touchType-only scoping
  - `packages/schemas/constants.ts` -- `TOUCH_TYPES` constant
  - `CLAUDE.md` -- Prisma migration discipline (no db push, no reset, forward-only)

---
*Pitfalls research for: Touch 4 artifact type sub-classification and per-artifact deck structures*
*Researched: 2026-03-07*
