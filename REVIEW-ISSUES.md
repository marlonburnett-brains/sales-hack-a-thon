# AtlusAI Review - Issues & Improvements

## 1. Discovery Page - Document Cards Lack Visual Previews

**Page:** AtlusAI Discovery
**Severity:** UX improvement
**Description:** Document cards in the grid view only show the title, document ID, URL, and a "Drive" badge. This makes the grid layout ineffective since all cards look identical and users can't visually distinguish between documents.

**Expected behavior:**
- Use the Google Drive API to fetch richer metadata (thumbnails, MIME type, etc.)
- Render thumbnail previews when available (Slides, Docs, PDFs, etc.)
- When no thumbnail is available, show a file-type-specific icon/image (e.g., Slides icon for presentations, Docs icon for documents, Sheets icon for spreadsheets)
- Make the grid view actually useful for visual browsing

---

## 2. Discovery Page - Ingestion Status is Misleading

**Page:** AtlusAI Discovery → after clicking ingest
**Severity:** Bug / UX issue
**Description:** When a document is ingested from the Discovery page, the card immediately shows "Ingested" (with a checkmark), but the document is actually still ingesting. The Templates page shows the real state (e.g., "Ingesting..." with a progress bar like "Slide 4 of 21"). The two pages show contradictory states for the same document.

**Expected behavior:**
- Show the real ingestion progress on the Discovery page (progress bar + slide count, matching Templates), **OR**
- Keep the status as "Ingesting..." on Discovery until ingestion actually completes, then flip to "Ingested"
- The two pages must not show contradictory states for the same document

---

## 3. Templates Page - No Immediate Feedback on Ingest Click

**Page:** Templates → kebab menu → "Ingest"
**Severity:** UX bug
**Description:** After clicking "Ingest" from the template card's menu, there is a noticeable delay before the UI updates (menu dismissal, status change). During this delay there is no visual feedback, making it appear the click didn't register. This leads users to click multiple times, which then triggers an error message about ingestion having already started.

**Expected behavior:**
- Provide immediate feedback on click (e.g., optimistic UI update: instantly close the menu, show a loading/spinner state, or flip status to "Queued"/"Ingesting...")
- Disable the "Ingest" button after the first click to prevent duplicate submissions
- Show the final confirmed state only once the backend responds

---

## 4. Slide Ingestion - Metadata is Too Shallow / Lacks Meaningful Description

**Page:** Template detail → slide viewer (right-side metadata panel)
**Severity:** Feature gap / Quality issue
**Description:** The current slide metadata (Industry, Buyer Persona, Funnel Stage, Content Type, Slide Category) is high-level taxonomy only. It lacks any meaningful human-like description of what the slide actually is and contains.

**Expected behavior:**
- Generate rich, descriptive summaries for each slide during ingestion, e.g.:
  - "This is a deck overview / instruction slide explaining how to use the template. It contains fields for Date/Time, Version, Speaker, Audience, and Objectives. Includes a warning that this slide must remain hidden during presenting."
  - "This is a presentation cover slide featuring the theme 'Data readiness in the AI era'. Shows the Lumenalta logo, a photo of two professionals, and the author Art Crosby (Managing Director). Suitable as a cover slide for enterprise AI-themed presentations."
  - "This is an agenda slide listing 12 topics across two columns..."
- Descriptions should capture the slide's purpose, visual composition, key text content, and general use cases

---

## 5. Slide Ingestion - Missing Structured Element Map from Slides API

**Page:** Template detail → slide viewer
**Severity:** Feature gap (critical for future presentation generation)
**Description:** There is no structured map of the actual elements on each slide. The current metadata is derived from AI reading of thumbnails, not from the Google Slides API. Without a real element map, the system cannot programmatically copy slides and replace/remove/add elements when generating new presentations.

**Expected behavior:**
- Use the Google Slides API to extract a structured element map for each slide during ingestion
- For each element, capture: element ID, type (text box, image, shape, table, chart, etc.), position/size, content (text runs, image URLs, etc.), styling, and placeholder type if applicable
- Store this as rich per-element metadata alongside the slide record
- Enables downstream use case: identify a reference slide → copy it → programmatically replace text, swap images, remove/add elements to build new presentations

---

## 6. Templates - Classify Presentations as "Template" or "Example" + Touch Binding

**Page:** Templates
**Severity:** Feature gap / Data model change
**Description:** All ingested presentations are currently treated the same. There is no distinction between **templates** (skeleton/reference decks with reusable slide structures, not tailored to a specific deal) and **examples** (real presentations created for actual client touches/deals). This distinction is critical for the downstream presentation generation workflow.

**Key concepts:**
- **Template**: Skeleton deck or collection of reference slides. Applicable to multiple touches. Provides abundance of structural options and slide patterns to draw from when building new presentations.
- **Example**: A real, tailored presentation created for a specific touch/deal. Bound to exactly one touch. Shows the actual structure and content flow of a completed presentation, serving as a reference for how to compose new ones.

**Expected behavior:**
- Users must classify each presentation as either "Template" or "Example"
- For "Example" presentations, users must also bind it to a specific touch
- For already-ingested presentations: show an "Action Required" indicator prompting users to classify them
- Provide a clear UI for this classification (modal, inline selector, or banner on the card)
- Classification feeds into generation logic: examples define structure/flow per touch, templates provide the slide building blocks

---

## 7. Settings Page - Deck Structures with AI-Inferred Touch Analysis

**Page:** New Settings page (with nested side navigation)
**Severity:** New feature
**Description:** A new Settings section accessible from the main side menu, with its own internal side navigation. One key section is **Deck Structures**, which provides AI-analyzed structure breakdowns for each sales touch.

**Expected behavior:**

### Settings Side Menu
- New top-level "Settings" item in the app's main sidebar
- Opens a settings page with its own nested side navigation for sub-sections

### Deck Structures Sub-page
Displays **Touch 1, Touch 2, Touch 3, Touch 4**, each with:
- **Description** of the touch
- **AI-inferred structure breakdown**: the typical flow/sequence of sections in a presentation for that touch
  - E.g., "Starts with a cover slide with X, followed by a 2-3 slide section covering Y, then a section on Z..."
- **Nuances, variations, and alternative paths** the AI has identified across example presentations
- **Reference slides** mapped to each step/section (linked from ingested templates & examples)
- **Confidence score** per touch (how confident the AI is in the inferred structure)

### AI Integration
- Analysis powered by the **gpt-oss model configured on Vertex AI**
- **AI Chat bar** where users can:
  - Flag things that don't seem right
  - Offer additional context, angles, or insights
  - Refine the AI's analysis interactively
  - AI updates the structure based on user feedback
