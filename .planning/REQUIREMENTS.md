# Requirements: Lumenalta Agentic Sales Orchestration

**Defined:** 2026-03-08
**Core Value:** Sellers walk into every meeting prepared and walk out of every meeting with a polished, brand-compliant proposal deck in under 2 hours -- not 24 to 120 hours.

## v1.7 Requirements

Requirements for milestone v1.7 Deals & HITL Pipeline. Each maps to roadmap phases.

### Deals Pipeline

- [x] **DEAL-01**: User can see deal status (Open, Won, Lost, Abandoned) on the deals page
- [x] **DEAL-02**: User can change a deal's status through its lifecycle
- [x] **DEAL-03**: User can toggle between card grid view and list/table view on the deals page
- [x] **DEAL-04**: Deals page defaults to showing Open deals with ability to filter by other statuses
- [x] **DEAL-05**: User can assign a primary owner to a deal
- [x] **DEAL-06**: User can add collaborators/secondary assignees to a deal
- [x] **DEAL-07**: User can filter deals by "Assigned to me," a specific team member, or all

### Deal Navigation

- [x] **NAV-01**: User sees breadcrumbs for navigating back to deals list from any deal sub-page
- [x] **NAV-02**: Deal detail has a left sidebar with links to Overview, Briefing, Touch 1-4
- [x] **NAV-03**: Each sidebar link navigates to its own sub-page within the deal detail

### Deal Overview

- [x] **OVER-01**: User can view deal state and status on the overview page
- [x] **OVER-02**: User can see accumulated data and key metrics for the deal
- [x] **OVER-03**: User can see activity summary and timeline for the deal
- [x] **OVER-04**: User can see assignment info (owner + collaborators) on the overview

### Deal Briefing

- [x] **BRIEF-01**: User can view consolidated pre-call briefing, research data, and meeting notes on a single briefing page
- [x] **BRIEF-02**: All prep/context material for the deal is accessible from the briefing page

### AI Chat

- [ ] **CHAT-01**: User can access a persistent AI chat bar on any deal sub-page
- [ ] **CHAT-02**: User can add context or notes to the deal via chat
- [ ] **CHAT-03**: User can upload/paste call transcripts and bind them to a specific touch step via chat
- [x] **CHAT-04**: User can ask questions about the deal's data and history via chat
- [x] **CHAT-05**: User can query similar cases/use cases from the knowledge base via chat

### Touch Pages & HITL

- [x] **TOUCH-01**: User can access a dedicated page for each touch (1-4) within the deal detail
- [x] **TOUCH-02**: Touch 1 page generates a two-pager/first contact pager through HITL workflow
- [x] **TOUCH-03**: Touch 2 page generates a Meet Lumenalta deck through HITL workflow
- [x] **TOUCH-04**: Touch 3 page generates a use cases/capability alignment deck through HITL workflow
- [x] **TOUCH-05**: Touch 4 page generates a sales proposal, talk track, and FAQ through HITL workflow
- [x] **TOUCH-06**: Each touch follows a 3-stage HITL workflow: Skeleton > Low-fi sketch > High-fi presentation
- [x] **TOUCH-07**: User can interact with each HITL stage via AI chat to refine before approving

### Drive Integration

- [ ] **DRIVE-01**: User can choose a destination folder in Google Drive when saving generated artifacts
- [ ] **DRIVE-02**: User can configure the sharing scope of newly generated documents
- [ ] **DRIVE-03**: Default sharing is entire org + the service account

### Agent Architecture

- [x] **AGENT-01**: All LLM interactions are formalized as named agents with dedicated system prompts
- [x] **AGENT-02**: Each agent has a clear responsibility boundary and cached system prompt support

### Agent Management

- [x] **MGMT-01**: User can view all formal agents and their current system prompts in Settings
- [x] **MGMT-02**: User can edit agent system prompts via direct text editing
- [x] **MGMT-03**: User can edit agent system prompts via conversational AI chat
- [x] **MGMT-04**: Any prompt modification creates a draft version; changes are not live until published
- [x] **MGMT-05**: Each save creates a new version with full version history retained for review or rollback

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Pipeline Analytics

- **ANALYTICS-01**: User can see stage distribution across all deals
- **ANALYTICS-02**: User can see average time per pipeline stage

### Cross-Touch Intelligence

- **CROSS-01**: Chat agent references prior touch interactions when generating responses
- **CROSS-02**: Generation agents carry forward context from prior touches automatically

### Notifications

- **NOTIF-01**: User receives email notification when a HITL checkpoint needs approval
- **NOTIF-02**: User receives in-app notification for deal assignment changes

## Out of Scope

| Feature | Reason |
|---------|--------|
| Custom pipeline stages | Over-engineering for ~20 sellers; fixed stages match GTM strategy |
| Real-time collaborative editing | Google Slides handles collaboration natively |
| Inline slide content editing | Already out of scope; link to Google Slides for editing |
| Autonomous generation without HITL | Violates core HITL philosophy; AI-assisted, human-approved |
| Per-agent model selection | Single model with agent-specific prompts is sufficient |
| Chat history search across deals | Low value vs. implementation cost; defer to v2+ |
| Drag-and-drop slide reordering | Out of scope; use Google Slides native reordering |
| Real-time notification system | Polling and email sufficient for ~20 users |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEAL-01 | Phase 41 | Complete |
| DEAL-02 | Phase 41 | Complete |
| DEAL-03 | Phase 41 | Complete |
| DEAL-04 | Phase 41 | Complete |
| DEAL-05 | Phase 41 | Complete |
| DEAL-06 | Phase 41 | Complete |
| DEAL-07 | Phase 41 | Complete |
| NAV-01 | Phase 42 | Complete |
| NAV-02 | Phase 42 | Complete |
| NAV-03 | Phase 42 | Complete |
| OVER-01 | Phase 42 | Complete |
| OVER-02 | Phase 42 | Complete |
| OVER-03 | Phase 42 | Complete |
| OVER-04 | Phase 42 | Complete |
| BRIEF-01 | Phase 42 | Complete |
| BRIEF-02 | Phase 42 | Complete |
| CHAT-01 | Phase 45 | Pending |
| CHAT-02 | Phase 45 | Pending |
| CHAT-03 | Phase 45 | Pending |
| CHAT-04 | Phase 45 | Complete |
| CHAT-05 | Phase 45 | Complete |
| TOUCH-01 | Phase 46 | Complete |
| TOUCH-02 | Phase 46 | Complete |
| TOUCH-03 | Phase 46 | Complete |
| TOUCH-04 | Phase 46 | Complete |
| TOUCH-05 | Phase 46 | Complete |
| TOUCH-06 | Phase 46 | Complete |
| TOUCH-07 | Phase 46 | Complete |
| DRIVE-01 | Phase 47 | Pending |
| DRIVE-02 | Phase 47 | Pending |
| DRIVE-03 | Phase 47 | Pending |
| AGENT-01 | Phase 43 | Complete |
| AGENT-02 | Phase 43 | Complete |
| MGMT-01 | Phase 44 | Complete |
| MGMT-02 | Phase 44 | Complete |
| MGMT-03 | Phase 44 | Complete |
| MGMT-04 | Phase 44 | Complete |
| MGMT-05 | Phase 44 | Complete |

**Coverage:**
- v1.7 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0

---
*Requirements defined: 2026-03-08*
*Last updated: 2026-03-08 after roadmap creation*
