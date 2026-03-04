# Phase 12: Content Library Re-ingestion - Research

**Researched:** 2026-03-04
**Domain:** Google Drive access remediation, bulk ingestion pipeline re-run, AtlusAI content coverage
**Confidence:** HIGH

## Summary

Phase 12 is an operational phase, not a code-building phase. The entire ingestion pipeline infrastructure was built in Phase 2 and is production-ready. The gap is that the Google Drive service account lacks access to the shortcut target files containing the bulk of Lumenalta's content library. The milestone audit confirms only 5 presentations (Spike Test x2, 200A Master Deck, Branded Basics) were discovered out of 15+ known presentations behind Drive shortcuts. All 11 industries show 0 case studies, the image registry is empty (0 assets), and brand guidelines were ingested as slide-level 'template' entries rather than whole-reference 'brand_guide' entries.

The fix is straightforward: (1) grant the service account viewer access to shortcut target files/folders in Google Drive, (2) enable Google Docs API on GCP project 749490525472, (3) reset and re-run the existing pipeline scripts, (4) verify coverage across all 11 industries. No new pipeline code is needed -- the scripts handle errors gracefully, are idempotent, and support incremental re-runs.

**Primary recommendation:** Execute a sequential 5-step operational checklist: GCP API enablement, Drive access grants, discovery validation, full pipeline re-run, coverage verification. All steps use existing scripts with existing CLI flags.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Drive access approach:** Manual sharing -- grant the service account email viewer access to each Shared Drive or folder containing shortcut targets (Meet Lumenalta, L2 capability decks, 1-2 pager templates, case study decks). If some shortcut targets remain inaccessible after grants, log as warnings and proceed. Re-run `discover-content.ts` after access grants to validate the expanded discovery set before proceeding to extraction.
- **Brand guidelines handling:** Enable Google Docs API on GCP project 749490525472. Re-run `ingest-brand-guidelines.ts` which already handles Google Slides format. If Branded Basics is a Google Doc (not Slides), add Docs API text extraction to the script. Ingest as single AtlusAI document with `content_type: brand_guide` (not slide-level).
- **Image registry population:** Re-run `build-image-registry.ts` after service account has expanded access. If curated image folders still aren't accessible, accept empty registry. Don't attempt to catalog the ~9,000 files in `01 Resources/`.
- **Coverage gap handling:** Accept industry coverage gaps if content doesn't exist in Drive -- don't create synthetic content. Coverage report documents gaps for the content team. RAG fallback tiers handle missing content gracefully.

### Claude's Discretion
- Whether to update `discover-content.ts` to better handle access errors (currently warns and continues)
- Manifest cleanup strategy (reset existing manifest vs append new entries)
- Batch sizes and rate limiting for re-ingestion run
- Whether to run full pipeline or manifest-only first for validation

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONT-01 | All existing Lumenalta deck templates ingested into AtlusAI at slide level with metadata tags | `run-ingestion.ts` full pipeline handles discovery, extraction, Gemini classification, and ingestion. Currently blocked by Drive access -- only 5 presentations accessible. After access grants and re-run, pipeline will discover Meet Lumenalta, L2 capability decks, 1-2 pager templates, and all other shortcut targets. |
| CONT-02 | All case studies indexed in AtlusAI tagged by industry, subsector, solution pillar, and buyer persona | `classify-metadata.ts` already handles case study classification. `run-ingestion.ts` has `applyContentTypeOverrides()` with case study folder/name detection. Coverage report shows 0 case studies -- all behind inaccessible shortcuts. After access grants, case study decks will be discovered and classified. |
| CONT-03 | Brand guidelines and approved image/icon library indexed in AtlusAI | `ingest-brand-guidelines.ts` handles discovery + extraction + ingestion. `build-image-registry.ts` handles image curation. Brand guide needs re-ingestion as `brand_guide` content_type (currently ingested as slide-level `template`). Image registry currently empty -- needs Drive access expansion. Google Docs API enablement needed if Branded Basics is a Google Doc. |
| CONT-04 | All 11 industries represented with at least one complete deck template and one case study each | Coverage report confirms 0 case studies for all 11 industries. Template coverage exists (via generic multi-industry classification) but is from only 2 real presentations. After full re-ingestion with expanded access, industry-specific content from L2 capability decks and case study presentations will populate gaps. Coverage report auto-detects remaining gaps. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| googleapis | (existing) | Google Drive API v3, Slides API v1, Docs API v1 | Already configured in `google-auth.ts` with all 3 scopes |
| @google/genai | (existing) | Gemini 2.5 Flash for slide metadata classification | Already configured in `classify-metadata.ts` |
| @prisma/client | (existing) | ImageAsset table for image registry | Already configured with schema and migrations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:crypto | built-in | SHA-256 deterministic document IDs | Used by `slide-extractor.ts` for idempotent IDs |
| node:fs/promises | built-in | Manifest file read/write | Used by `run-ingestion.ts` for manifest persistence |

### No New Dependencies
This phase uses exclusively existing infrastructure. No new packages need to be installed.

## Architecture Patterns

### Existing Pipeline Structure (No Changes Needed)
```
apps/agent/src/
  ingestion/
    run-ingestion.ts          # 5-phase pipeline (A-E) with CLI modes
    discover-content.ts       # Recursive Drive traversal + shortcut resolution
    extract-slides.ts         # Batch slide text extraction orchestrator
    classify-metadata.ts      # Gemini-based metadata classification
    ingest-brand-guidelines.ts # Brand guide discovery + whole-doc ingestion
    build-image-registry.ts    # Image folder discovery + Prisma upsert
    manifest/
      content-manifest.json    # 38 entries, all ingested (reset before re-run)
      coverage-report.json     # Current: 0 case studies, 5 presentations
      image-registry-report.json # Current: 0 assets
      solution-pillars.json    # Current: empty array
  lib/
    atlusai-client.ts          # Drive-based ingestion (create Google Docs)
    slide-extractor.ts         # Per-slide text + notes extraction
    google-auth.ts             # Auth factories (Drive, Slides, Docs clients)
```

### Pattern 1: Manifest Reset Before Full Re-Run
**What:** Delete existing `content-manifest.json` before re-running the full pipeline so all newly-discovered content starts as "pending" rather than being appended to the existing manifest with stale spike test entries.
**When to use:** When the discovery set has changed significantly (new Drive access grants).
**Recommendation:** Reset the manifest. The existing 38 entries are dominated by spike tests (2 test presentations) and a partial 200A Master Deck extraction. Starting fresh ensures clean coverage reporting. The pipeline's idempotency check in `ingestDocument()` prevents duplicate Google Docs in Drive even without the manifest -- it checks by document title.

### Pattern 2: Manifest-Only First, Then Ingest
**What:** Use `--manifest-only` flag to run Phases A-C (discover, extract, classify) without ingestion. Review manifest and coverage report. Then use `--ingest-only` for Phase D.
**When to use:** When access changes make discovery results unpredictable.
**Recommendation:** Use this two-pass approach. After access grants, run `--manifest-only` first to validate that the expanded discovery set includes the expected presentations. Check coverage-report.json for case study counts before committing to the full ingestion.

### Pattern 3: Brand Guide Separate From Main Pipeline
**What:** Brand guidelines are ingested via `ingest-brand-guidelines.ts` as a separate script, not through the main `run-ingestion.ts` pipeline.
**When to use:** Always -- brand guide has different content_type (`brand_guide` vs `template`) and is a whole-reference document (not slide-level).
**Why:** The main pipeline classifies every slide independently. Brand guidelines should be a single concatenated document for RAG retrieval context.

### Anti-Patterns to Avoid
- **Don't append to stale manifest:** Reset `content-manifest.json` before re-running discovery. The existing 38 entries are from a limited-access run.
- **Don't skip the discovery validation step:** Run `--manifest-only` first after access grants. If discovery still shows only 5 presentations, the access grants didn't work.
- **Don't force 100% industry coverage:** Accept natural gaps -- some industries may have no dedicated content in Drive. RAG fallback tiers handle this.
- **Don't catalog all of 01 Resources/:** The folder has ~9,000 files. Only curated subsets (headshots, logos, brand icons) should enter the image registry.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drive discovery with shortcuts | New discovery script | `discover-content.ts` | Already handles recursive traversal, shortcut resolution, folder shortcuts, pagination, rate limiting, deduplication |
| Slide text extraction | Custom parser | `slide-extractor.ts` + `extract-slides.ts` | Already handles shapes, tables, groups, speaker notes, low-content detection |
| Metadata classification | Manual tagging | `classify-metadata.ts` | Gemini 2.5 Flash with structured output + Zod validation + content type overrides |
| AtlusAI ingestion | Direct API calls | `atlusai-client.ts` | Drive-based ingestion with idempotency checks, subfolder organization, metadata encoding |
| Coverage reporting | Manual counting | `run-ingestion.ts` Phase C | Auto-generates coverage-report.json with per-industry breakdowns and gap detection |
| Image registry | JSON file | `build-image-registry.ts` | Prisma upsert with category detection, skip patterns, tag derivation |

**Key insight:** Every component needed for this phase already exists and was tested during Phase 2. The only work is operational: granting access, enabling APIs, and re-running scripts.

## Common Pitfalls

### Pitfall 1: Service Account Access Grants Don't Propagate to Shortcuts
**What goes wrong:** You share a folder with the service account, but shortcuts inside that folder point to files in OTHER shared drives/folders where the service account still has no access.
**Why it happens:** Google Drive shortcuts are not copies -- they're references. The service account needs access to the TARGET file/folder, not just the folder containing the shortcut.
**How to avoid:** Share each Shared Drive or root folder containing the actual target files. The known targets from Phase 2 CONTEXT are: Meet Lumenalta, NBCUniversal, Bleecker Street Group, Master Solutions, 2026 GTM Solutions, Alaska Airlines, MasterControl, Encompass, WSA, Satellite Industries, Gravie.
**Warning signs:** `discover-content.ts` will log `WARNING: Could not scan folder` or the discovery count remains at 5 presentations after access grants.

### Pitfall 2: Google Docs API Not Enabled
**What goes wrong:** `ingest-brand-guidelines.ts` fails with a 403 error when trying to extract text from a Google Doc.
**Why it happens:** The Google Docs API must be enabled separately in the GCP Console for project 749490525472. The Drive API and Slides API are enabled, but Docs API is not.
**How to avoid:** Enable the Docs API before running brand guidelines ingestion. The auth scope (`https://www.googleapis.com/auth/documents`) is already in `google-auth.ts`.
**Warning signs:** HTTP 403 with "Google Docs API has not been used in project 749490525472" message.

### Pitfall 3: Branded Basics Ingested as Slide-Level Template
**What goes wrong:** If the main pipeline runs before `ingest-brand-guidelines.ts`, Branded Basics gets discovered as a presentation and each slide is ingested separately with `contentType: template`.
**Why it happens:** The main pipeline treats all presentations equally. There's no special-case for Branded Basics.
**How to avoid:** Either (a) run `ingest-brand-guidelines.ts` first and ensure the manifest marks Branded Basics slides as already handled, or (b) add Branded Basics to a skip list in the main pipeline, or (c) accept the dual ingestion (slide-level AND whole-reference both exist -- more content for RAG is not harmful).
**Warning signs:** Coverage report shows Branded Basics slides classified as `template` rather than `brand_guide`.

### Pitfall 4: Gemini Rate Limits on Large Discovery Sets
**What goes wrong:** Classification (Phase B) fails mid-run with HTTP 429 errors from the Gemini API.
**Why it happens:** The previous run classified only 38 slides. A full discovery might yield 200+ slides, hitting Gemini 2.5 Flash rate limits.
**How to avoid:** The existing 300ms delay between Gemini calls in `classify-metadata.ts` should be sufficient for moderate volumes. If discovery yields 500+ slides, consider increasing `RATE_LIMIT_DELAY` to 500ms. The pipeline's error handling continues on failure with default metadata, so partial rate limiting won't crash the run.
**Warning signs:** Multiple `ERROR classifying slide` messages in console output with "RESOURCE_EXHAUSTED" or "429" errors.

### Pitfall 5: Drive API Quota Exhaustion
**What goes wrong:** Discovery phase (A) fails with quota errors when traversing many folders.
**Why it happens:** Each folder requires multiple Drive API calls (list presentations, list shortcuts, list subfolders). A deeply nested Drive structure multiplies API calls.
**How to avoid:** The existing 200ms `RATE_LIMIT_DELAY` in `discover-content.ts` provides adequate spacing. Google Drive API default quota is 12,000 requests per minute -- unlikely to be hit with 200ms delays.
**Warning signs:** HTTP 403 "Rate Limit Exceeded" or "User Rate Limit Exceeded" from Drive API.

## Code Examples

Verified patterns from existing codebase:

### Running the Full Pipeline
```bash
# From apps/agent directory
# Full pipeline (A through E):
npx tsx --env-file=.env src/ingestion/run-ingestion.ts

# Manifest-only (A through C -- discovery, extraction, classification):
npx tsx --env-file=.env src/ingestion/run-ingestion.ts --manifest-only

# Ingest-only (D only -- reads existing manifest):
npx tsx --env-file=.env src/ingestion/run-ingestion.ts --ingest-only
```

### Running Brand Guidelines Ingestion
```bash
# From apps/agent directory
npx tsx --env-file=.env src/ingestion/ingest-brand-guidelines.ts
```

### Running Image Registry Builder
```bash
# From apps/agent directory
npx tsx --env-file=.env src/ingestion/build-image-registry.ts
```

### Resetting the Manifest Before Re-Run
```bash
# Remove stale manifest to force fresh discovery
rm apps/agent/src/ingestion/manifest/content-manifest.json
# Optionally also reset coverage and image reports
rm apps/agent/src/ingestion/manifest/coverage-report.json
rm apps/agent/src/ingestion/manifest/image-registry-report.json
```

### Verifying Discovery Results (After Access Grants)
```typescript
// In discover-content.ts -- the existing code logs discovered presentations:
// "Found N presentations total"
// "[folderPath] presentationName [shortcut]"
// WARNING: Could not scan folder "xxx": error message

// Expected after access grants:
// - Meet Lumenalta
// - NBCUniversal
// - Bleecker Street Group
// - Master Solutions
// - 2026 GTM Solutions
// - Alaska Airlines, MasterControl, Encompass, WSA, Satellite Industries, Gravie
// - 200A Master Deck (already accessible)
// - Branded Basics (already accessible)
// Total: 13+ presentations (up from 5)
```

### Content Type Override Logic (Already Implemented)
```typescript
// Source: apps/agent/src/ingestion/run-ingestion.ts lines 101-120
// Case study detection by folder or name:
if (folderLower.includes("case stud") || nameLower.includes("case stud")) {
  return { ...slide, metadata: { ...slide.metadata, contentType: "case_study" as const } };
}
// Known presentation overrides for touch types:
// "meet lumenalta" -> template, touch_2
// "master solutions" -> template, touch_3
// "alaska airlines" -> example, touch_4
// etc.
```

### AtlusAI Ingestion Idempotency (Already Implemented)
```typescript
// Source: apps/agent/src/lib/atlusai-client.ts
// Deterministic title for idempotency:
const docTitle = `[SLIDE] ${doc.presentationName} - Slide ${doc.slideIndex + 1} [${doc.documentId}]`;
// Check if document already exists before creating:
const existing = await drive.files.list({
  q: `'${ingestionFolderId}' in parents and name = '${docTitle.replace(/'/g, "\\'")}' and trashed = false`,
  // ...
});
if (existing.data.files && existing.data.files.length > 0) {
  return { created: false, docId: existing.data.files[0].id!, skipped: true };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Limited 5-presentation discovery | Full discovery after access grants | Phase 12 | 13+ presentations, case studies, full coverage |
| Empty solution pillars | Gemini-derived pillars from Master Solutions | Phase 12 | Better classification accuracy |
| Slide-level brand guide | Whole-reference brand_guide document | Phase 12 | Better RAG retrieval for brand context |
| Empty image registry | Curated headshots/logos/icons | Phase 12 | Image assets available for deck assembly |

**Deprecated/outdated:**
- Spike test presentations: 2 of the 5 discovered presentations are spike tests from Phase 1. They provide no real content value and inflate template counts. The manifest reset will exclude them from the new coverage report (they will still be re-discovered but classified more accurately).

## Open Questions

1. **Which Shared Drives contain the shortcut targets?**
   - What we know: The Hack-a-thon folder contains shortcuts pointing to files in other Shared Drives. The known target names are listed in Phase 2 CONTEXT.
   - What's unclear: The exact Shared Drive IDs or folder IDs where these targets reside. This requires manual investigation in Google Drive Admin Console or by a user with access.
   - Recommendation: This is a human operational step. The planner should create a task for the user to identify and share the correct folders/drives with the service account.

2. **Will the Branded Basics document be a Google Doc or Google Slides?**
   - What we know: `ingest-brand-guidelines.ts` already handles both formats (Slides via `extractSlidesContent`, Docs via `extractDocContent` using Drive export API).
   - What's unclear: The script found Branded Basics as a Google Slides presentation in Phase 2 (it's in the current manifest as presentation slides). But the Phase 12 CONTEXT mentions "If Branded Basics is a Google Doc, add Docs API text extraction."
   - Recommendation: The existing script already handles both. The Google Docs API enablement is still needed as a prerequisite regardless, since the auth scope includes `documents` and future content might be Docs format.

3. **How many total slides will the expanded discovery yield?**
   - What we know: Current manifest has 38 slides from 5 presentations (~8 slides average). Known shortcut targets list 11+ additional presentations.
   - What's unclear: Total slide count depends on deck sizes. Could range from 100 to 500+ slides.
   - Recommendation: Use `--manifest-only` first to get an accurate count before running the full ingestion. Adjust batch sizes if the total exceeds 300 slides.

4. **Solution pillars extraction from Master Solutions deck**
   - What we know: `solution-pillars.json` is currently empty because the Master Solutions deck was inaccessible. The pipeline reads this file during classification.
   - What's unclear: Whether the planner should add a step to extract pillars from the newly-accessible Master Solutions deck before running classification.
   - Recommendation: Yes -- run discovery first, then extract pillar names from the Master Solutions deck content, populate `solution-pillars.json`, and THEN run classification. This improves classification quality.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual verification via CLI scripts + coverage report JSON |
| Config file | none -- ingestion scripts are standalone CLI tools |
| Quick run command | `npx tsx --env-file=.env src/ingestion/run-ingestion.ts --manifest-only` |
| Full suite command | `npx tsx --env-file=.env src/ingestion/run-ingestion.ts` (full pipeline) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONT-01 | All deck templates ingested at slide level with metadata | smoke | `npx tsx --env-file=.env src/ingestion/run-ingestion.ts --manifest-only` then check coverage-report.json byContentType.template > 0 and totalPresentations > 5 | N/A (operational) |
| CONT-02 | All case studies indexed with industry/subsector/pillar/persona tags | smoke | Check coverage-report.json: at least 1 industry has caseStudies > 0 | N/A (operational) |
| CONT-03 | Brand guidelines + image library indexed | smoke | `npx tsx --env-file=.env src/ingestion/ingest-brand-guidelines.ts` exits 0 AND `npx tsx --env-file=.env src/ingestion/build-image-registry.ts` exits 0 | N/A (operational) |
| CONT-04 | All 11 industries have template + case study | smoke | Check coverage-report.json: gaps array length (ideally 0, accept if gaps are "no case studies" for industries without Drive content) | N/A (operational) |

### Sampling Rate
- **Per task commit:** Review script output logs for errors/warnings
- **Per wave merge:** Check coverage-report.json gap list
- **Phase gate:** All 4 CONT requirements verified via coverage report + manifest inspection

### Wave 0 Gaps
None -- existing ingestion scripts serve as the validation infrastructure. No new test files needed. All verification is done by examining script output and generated JSON reports.

## Sources

### Primary (HIGH confidence)
- `apps/agent/src/ingestion/run-ingestion.ts` -- Full pipeline implementation, verified line-by-line
- `apps/agent/src/ingestion/discover-content.ts` -- Drive traversal with shortcut handling, verified
- `apps/agent/src/ingestion/ingest-brand-guidelines.ts` -- Brand guide ingestion with multi-format support, verified
- `apps/agent/src/ingestion/build-image-registry.ts` -- Image registry builder with Prisma upsert, verified
- `apps/agent/src/lib/atlusai-client.ts` -- Ingestion via Drive Docs creation, verified
- `apps/agent/src/ingestion/manifest/coverage-report.json` -- Current state: 5 presentations, 38 slides, 0 case studies
- `apps/agent/src/ingestion/manifest/image-registry-report.json` -- Current state: 0 assets
- `.planning/v1.0-MILESTONE-AUDIT.md` -- Authoritative gap analysis confirming CONT-01 through CONT-04 unsatisfied
- `.planning/phases/12-content-library-reingestion/12-CONTEXT.md` -- User decisions for this phase

### Secondary (MEDIUM confidence)
- `.planning/phases/02-content-library-ingestion/02-CONTEXT.md` -- Phase 2 original context with known presentation list
- `.planning/STATE.md` -- Project decisions log with Phase 2 decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All tools already exist and were used in Phase 2. No new dependencies.
- Architecture: HIGH -- Pipeline architecture is established, tested, and idempotent. Only operational steps remain.
- Pitfalls: HIGH -- Pitfalls are derived from actual Phase 2 execution experience (documented access failures, empty registries, wrong content types).

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable -- no library changes expected, only operational steps)
