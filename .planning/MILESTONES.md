# Milestones

## v1.0 Agentic Sales MVP (Shipped: 2026-03-05)

**Phases:** 13 | **Plans:** 27 | **Commits:** 169 | **Files:** 439 | **LOC:** ~20,000 TypeScript/TSX
**Timeline:** 2 days (2026-03-03 → 2026-03-04)
**Git range:** `1c5b7d3..8d55936`

**Key accomplishments:**
- Full-stack monorepo (Next.js 15 + Mastra AI + Prisma + Google Workspace API) with pnpm/Turborepo
- Touch 1-3 asset generation: AI-driven slide selection and assembly for pagers, intro decks, and capability decks with approve/override feedback and knowledge base growth
- Touch 4 end-to-end pipeline: transcript → extraction → field review → sales brief → HITL-1 → RAG retrieval → Google Slides deck + talk track + buyer FAQ → HITL-2 asset review
- Pre-call briefing flow: company research, role-specific hypotheses, prioritized discovery questions, Google Doc output
- Step-by-step pipeline progress indicators, friendly error handling, demo seed scenario (Meridian Capital Group)
- Content library ingestion: 38 slides + brand guidelines in AtlusAI with coverage across all 11 industries

**Known Gaps (accepted):**
- CONT-01 (partial): Content library populated with accessible sources only — 14/17 shortcut targets need Viewer access on target Shared Drives
- CONT-02 (unsatisfied): Case studies not ingested — source presentations among inaccessible Drive shortcuts
- CONT-03 (partial): Slide chunks indexed from 5 accessible presentations (38 slides); 12+ presentations pending access
- CONT-04 (unsatisfied): Building Block Library incomplete — no case study modules until CONT-02 resolved
- Touch 4 standalone brief review page has workflowRunId null before approval (chicken-and-egg; inline flow works correctly)

**Archives:** [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) | [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md) | [v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

---

