# AtlusDeck: Concise Documentation

AtlusDeck is an enterprise-grade AI sales enablement platform designed to eliminate the bottleneck between discovery calls and the delivery of polished, brand-compliant sales collateral. By orchestrating LLMs, internal knowledge bases, and Google Workspace APIs, it automates a 4-touchpoint Go-To-Market (GTM) strategy with integrated human-in-the-loop (HITL) checkpoints.

## Core Functionality

The platform automates the creation of tailored sales materials across four key touchpoints:

1.  **First Contact (Touch 1):** Generates personalized 1-2 pagers based on basic firmographic inputs (company, industry).
2.  **Intro Conversation (Touch 2):** Assembles a custom "Meet Lumenalta" Google Slides deck tailored to the prospect's industry.
3.  **Capability Alignment (Touch 3):** Retrieves specific use cases and capability slides from the knowledge base to build customized presentations.
4.  **Solution Proposal (Touch 4):** Parses raw meeting transcripts to extract structured business data (budget, timeline, outcomes) to automatically generate a complete Google Slides deck, a Talk Track document, and a Buyer FAQ document.

*Additionally, the system generates **Pre-call Briefings** (company snapshots, hypotheses, and discovery questions).*

## Architectural Highlights

The solution is built with a highly professional, validated architecture that goes beyond simple statutory chatbots:

*   **Agentic Workflows via Mastra:** Uses the Mastra orchestration framework for multi-step, asynchronous pipelines (e.g., pulling transcripts, extracting JSON data, fetching context, and synthesizing multiple Google Drive assets in one flow).
*   **Human-In-The-Loop (HITL):** Workflows are designed with "suspend and resume" checkpoints. Sales reps must review and approve AI-generated content in a Next.js dashboard before final delivery. *Crucially, user overrides are captured as learning signals.*
*   **Multi-Modal Asset Generation:** Connects directly to **Google Workspace APIs** (Slides, Docs, Drive) to physically assemble and inject personalized data into master presentation templates, eliminating manual document creation.
*   **MCP-Connected Knowledge Retrieval:** Standardizes Retrieval-Augmented Generation (RAG) by connecting the LLM to the "AtlusAI" knowledge base via the **Model Context Protocol (MCP)** for semantic search and structured data retrieval.
*   **Validated Monorepo:** Utilizes a **Turborepo** structure to cleanly decouple the Next.js frontend from the Mastra agent backend. Strict type safety and **Zod validation schemas** ensure that the structured JSON outputs from **Vertex AI** adhere to exact contracts before presentation injection.

## Tech Stack Overview

*   **Language:** TypeScript 5.7
*   **Frontend:** Next.js 15 (App Router), React 19, TailwindCSS, shadcn/ui
*   **AI Orchestration:** Mastra 1.3
*   **LLM Provider:** Google Vertex AI
*   **Knowledge Base:** AtlusAI (via MCP)
*   **Database:** Supabase PostgreSQL with Prisma ORM
*   **Output Generation:** Google Slides, Docs, and Drive APIs
*   **Tooling:** Turborepo, pnpm workspaces, Zod (Validation), React Hook Form

## Project Structure

A clean decoupling of concerns via a monorepo setup:

*   `apps/web/`: The Next.js 15 frontend providing the deal dashboard, touchpoint forms, and HITL review interfaces.
*   `apps/agent/`: The Mastra AI orchestration service containing the core business logic, workflow definitions, Google API integrations, AtlusAI client, and Prisma database schema.
*   `packages/schemas/`: Shared Zod validation schemas for LLM structured outputs and domain constants (industries, subsectors), ensuring data consistency between the frontend and the agent service.

## Quick Setup

1.  **Prerequisites:** Node.js 18+ and **pnpm** 9.12.0.
2.  **Install Dependencies:** Run `pnpm install` in the root directory.
3.  **Environment Variables:** Add `SECRETS_KEY=<key-from-team>` to a `.env.local` file in the root, then run `make pull env` to decrypt the `.env` files.
4.  **Database:** Run `pnpm --filter agent db:push` to set up the Supabase PostgreSQL database.
5.  **Start Services:** Run `make run dev` to start both the Next.js web app (port 3000) and the Mastra agent service (port 4111).
