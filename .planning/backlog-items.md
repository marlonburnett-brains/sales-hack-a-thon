# Backlog Items

## 1. Deals Page — Enhanced Filtering, Views & Assignment System

**Current state:** Simple card grid showing deals with minimal info (name, industry, campaign name, deck count).

### Requirements

- **View toggle:** User should be able to switch between a card grid view and a list/table view.
- **Deal status lifecycle:** Deals need a status field tracking their lifecycle stage using standard sales nomenclature:
  - **Open** — active/in-progress opportunities
  - **Won** — closed-won
  - **Lost** — closed-lost
  - **Abandoned** — opportunities that went cold or were dropped
- **Default filter:** List defaults to showing Open opportunities, with the ability to filter/switch to other statuses.
- **Salesperson assignment:**
  - Each deal gets a **primary assignee** (owner).
  - Support for **collaborators/secondary assignees** (team members assisting on the deal).
- **Filter by assignment:** Ability to filter deals by "Assigned to me," a specific team member, or all.
- **UI/UX reimagination:** Redesign the Deals page to better surface business-relevant information — pipeline-style views, richer card metadata, better discoverability of filters, etc.

---

## 2. Deal Detail — Navigation & Layout Overhaul

**Current state:** Single-page layout with no breadcrumbs and poor UX. All sections (Prep, Engagement touches) are stacked vertically.

### Requirements

- Add **breadcrumbs** for navigating back to Deals list (and any parent context).
- Replace current single-page layout with a **left sidebar navigation panel** containing:
  - Overview
  - Briefing
  - Touch 1
  - Touch 2
  - Touch 3
  - Touch 4
- Each section is its own sub-page/view within the deal detail.

---

## 3. Deal Detail — Overview Page

### Requirements

- New dashboard-style overview showing:
  - Deal state and status
  - Accumulated data and key metrics
  - Activity summary and timeline
  - Assignment info (owner + collaborators)
  - Deal health at a glance

---

## 4. Deal Detail — Briefing Page

### Requirements

- Consolidate Pre-Call Briefing, research data, and meeting notes into a single **Briefing** section.
- All prep/context material lives here.

---

## 5. Deal Detail — AI Chat Bar (Global within Deal)

### Requirements

- Persistent **AI Chat Bar** available across all deal sub-pages (Overview, Briefing, Touch 1–4).
- Capabilities:
  - Add context or notes to the deal.
  - Upload/paste **call transcripts** and bind them to a specific touch step.
  - Ask questions about the deal's data and history.
  - Query **similar cases / use cases** from the knowledge base and AtlusAI.
  - General productivity assistance for salespeople (suggestions, next steps, etc.).

---

## 6. Deal Detail — Touch Pages with HITL Artifact Generation

### Requirements

- Each Touch (1–4) gets its own page with the ability to plan and generate output artifacts:
  - **Touch 1:** Two-pager / First Contact Pager
  - **Touch 2:** Meet Lumenalta deck
  - **Touch 3:** Use cases / Capability Alignment deck
  - **Touch 4:** Sales proposal, talk track, FAQ
- **Human-in-the-Loop (HITL) generation workflow** with 3 stages, each requiring human approval before advancing:
  1. **Skeleton/Structure** — suggested outline, no visuals
  2. **Low-fidelity sketch** — rough layout of the presentation
  3. **High-fidelity presentation** — final polished artifact
- Users can interact with each stage via the AI Chat Bar to refine before approving.

---

## 7. Artifact Saving — Google Drive Integration & Sharing

### Requirements

- When saving generated artifacts, users can **choose a destination folder** in their Google Drive.
- Users can configure the **sharing scope** of the newly generated document.
- **Default sharing:** entire org + the service account.
- Should integrate with existing Drive/Docs permissions model.

---

## 8. Agentic Architecture — Formalize All LLM Interactions as Named Agents

### Requirements

- Audit all existing agentic/LLM flows in the app and refactor each into a **formal, named agent** with:
  - Dedicated **system prompt** (with cached system prompt support)
  - Clear responsibility boundary
- Examples (non-exhaustive — planner to identify the full set):
  - Classification Agent
  - Briefing Generator Agent
  - Deck Structure Assemble Agent
  - Touch 1 Slide Deck Assemble Agent
  - Touch 2 Deck Assemble Agent
  - Touch 3 Deck Assemble Agent
  - Touch 4 Decks Assemble Agent (proposal, talk track, FAQ)
  - Any other LLM interaction that qualifies as agentic
- Planner should identify all agents and author initial system prompts for each.

---

## 9. Settings — Agent Management UI with Versioning

### Requirements

- New **"Agents"** section under Settings.
- Lists all formal agents with their current system prompts.
- **Editing modes:**
  - Direct text editing of the system prompt.
  - Conversational editing via AI chat (ask the AI to refine/rewrite the prompt).
- **Draft system:** Any modification creates a **draft** version; changes are not live until explicitly saved/published.
- **Versioning:** Each save creates a new version of the agent; full version history is retained so users can review or roll back to previous versions.
