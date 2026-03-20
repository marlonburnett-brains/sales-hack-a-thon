import express from "express";
import type { Express, Request, Response } from "express";
import type { Server } from "node:http";
import { loadFixtures, loadStageFixtures, loadSequences, deepMerge } from "../fixtures/loader.js";
import type { FixtureSet } from "../fixtures/types.js";

/**
 * Mock Agent Server
 *
 * Express server that serves fixture JSON for every endpoint in api-client.ts.
 * Used during Playwright tutorial captures to replace the real agent service.
 * Default port: 4112 (avoids conflict with real agent on 4111).
 */

const DEFAULT_PORT = 4112;

/**
 * Create the Express app with all mock route handlers.
 */
export function createMockServer(tutorialName: string): Express {
  const app = express();
  const fixtures = loadFixtures(tutorialName);

  // ════════════════════════════════════════════════════════════
  // Stage State & Sequence Counters (Phase 63)
  // ════════════════════════════════════════════════════════════

  let currentStage: string = "idle";
  const sequenceCounters: Record<string, number> = {};
  const sequences = loadSequences(tutorialName);

  /**
   * Get the next response from a named sequence.
   * Advances the counter each call. After exhaustion, repeats the last response.
   * Returns null if no sequence exists for the given key.
   */
  function getNextSequenceResponse(key: string): unknown | null {
    const seq = sequences[key];
    if (!seq || seq.length === 0) return null;

    const idx = sequenceCounters[key] ?? 0;
    const servingIdx = Math.min(idx, seq.length - 1);
    const response = seq[servingIdx];
    sequenceCounters[key] = idx + 1;

    const status = (response as Record<string, unknown>)?.status ?? "unknown";
    console.log(
      `[mock-seq] ${key}: response ${servingIdx + 1}/${seq.length} (status=${status})`
    );

    return response;
  }

  app.use(express.json());

  // Request logging — helps debug mock server usage
  app.use((req: Request, _res: Response, next: Function) => {
    if (!req.url.startsWith("/auth/") && !req.url.startsWith("/mock/")) {
      console.log(`[mock] ${req.method} ${req.url}`);
    }
    next();
  });

  // ════════════════════════════════════════════════════════════
  // Mock Control Endpoints (Phase 63)
  // ════════════════════════════════════════════════════════════

  app.post("/mock/set-stage", (req: Request, res: Response) => {
    const { stage } = req.body ?? {};
    if (typeof stage === "string") {
      currentStage = stage;
      console.log(`[mock-stage] Stage set to: ${stage}`);
      res.json({ stage });
    } else {
      res.status(400).json({ error: "Missing stage in request body" });
    }
  });

  app.get("/mock/get-stage", (_req: Request, res: Response) => {
    res.json({ stage: currentStage });
  });

  app.post("/mock/reset-sequence", (req: Request, res: Response) => {
    const { key } = req.body ?? {};
    if (typeof key === "string") {
      sequenceCounters[key] = 0;
      console.log(`[mock-seq] Reset: ${key}`);
      res.json({ key, counter: 0 });
    } else {
      res.status(400).json({ error: "Missing key in request body" });
    }
  });

  app.post("/mock/reset", (_req: Request, res: Response) => {
    currentStage = "idle";
    for (const key of Object.keys(sequenceCounters)) {
      sequenceCounters[key] = 0;
    }
    console.log(`[mock] Full state reset`);
    res.json({ stage: currentStage, sequences: "reset" });
  });

  // ════════════════════════════════════════════════════════════
  // Supabase Auth API (fully mocked — no real Supabase needed)
  // The Next.js app is started with NEXT_PUBLIC_SUPABASE_URL
  // pointing here, so all auth calls land on these routes.
  // ════════════════════════════════════════════════════════════

  const MOCK_USER = {
    id: "00000000-0000-0000-0000-000000000001",
    email: "tutorial@example.com",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: "Tutorial User" },
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  };

  // getUser() — middleware calls this on full page loads
  app.get("/auth/v1/user", (_req: Request, res: Response) => {
    res.json(MOCK_USER);
  });

  // signInWithPassword / token exchange
  app.post("/auth/v1/token", (_req: Request, res: Response) => {
    const now = Math.floor(Date.now() / 1000);
    res.json({
      access_token: "mock-access-token",
      refresh_token: "mock-refresh-token",
      token_type: "bearer",
      expires_in: 86400,
      expires_at: now + 86400,
      user: MOCK_USER,
    });
  });

  // Token refresh
  app.post("/auth/v1/token?grant_type=refresh_token", (_req: Request, res: Response) => {
    const now = Math.floor(Date.now() / 1000);
    res.json({
      access_token: "mock-access-token-refreshed",
      refresh_token: "mock-refresh-token-refreshed",
      token_type: "bearer",
      expires_in: 86400,
      expires_at: now + 86400,
      user: MOCK_USER,
    });
  });

  // Logout
  app.post("/auth/v1/logout", (_req: Request, res: Response) => {
    res.status(204).send();
  });

  // Supabase REST/PostgREST catch-all (for any direct DB queries via Supabase client)
  app.all("/rest/v1/*", (_req: Request, res: Response) => {
    res.json([]);
  });

  // ────────────────────────────────────────────────────────────
  // Token Check (CRITICAL -- middleware calls this on every page load)
  // ────────────────────────────────────────────────────────────

  app.get("/tokens/check/:userId", (_req: Request, res: Response) => {
    res.json({ hasToken: true });
  });

  app.post("/tokens", (_req: Request, res: Response) => {
    res.json({ success: true, tokenId: "mock-token-id" });
  });

  // ────────────────────────────────────────────────────────────
  // Companies
  // ────────────────────────────────────────────────────────────

  app.get("/companies", (_req: Request, res: Response) => {
    res.json(fixtures.companies);
  });

  app.post("/companies", (req: Request, res: Response) => {
    const newCompany = {
      id: `comp-mock-${Date.now()}`,
      name: req.body?.name ?? "Mock Company",
      industry: req.body?.industry ?? "Technology",
      logoUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    res.json(newCompany);
  });

  // ────────────────────────────────────────────────────────────
  // Deals
  // ────────────────────────────────────────────────────────────

  /**
   * Enrich a deal with joined company and interactions data.
   * Mirrors the real agent server: prisma.deal.findMany({ include: { company: true, interactions: true } })
   */
  function enrichDeal(deal: (typeof fixtures.deals)[number]) {
    const company = fixtures.companies.find((c) => c.id === deal.companyId) ?? null;
    const interactions = (fixtures.interactions ?? []).filter(
      (i) => i.dealId === deal.id
    );
    return { ...deal, company, interactions };
  }

  app.get("/deals", (req: Request, res: Response) => {
    let result = [...fixtures.deals];
    const { status, assignee, userId, ownerId } = req.query;
    if (status && typeof status === "string") {
      result = result.filter((d) => d.status === status);
    }
    if (ownerId && typeof ownerId === "string") {
      result = result.filter((d) => d.ownerId === ownerId);
    }
    if (assignee && assignee !== "all" && typeof assignee === "string") {
      result = result.filter((d) => d.ownerId === assignee);
    }
    if (userId && typeof userId === "string") {
      result = result.filter((d) => d.ownerId === userId);
    }
    res.json(result.map(enrichDeal));
  });

  app.get("/deals/:id", (req: Request, res: Response) => {
    const deal = fixtures.deals.find((d) => d.id === req.params.id);
    if (deal) {
      res.json(enrichDeal(deal));
    } else {
      const fallback = fixtures.deals[0];
      res.json(fallback ? enrichDeal(fallback) : { id: req.params.id, name: "Mock Deal" });
    }
  });

  app.post("/deals", (req: Request, res: Response) => {
    const newDeal = {
      id: `deal-mock-${Date.now()}`,
      companyId: req.body?.companyId ?? "comp-mock",
      name: req.body?.name ?? "Mock Deal",
      salespersonName: req.body?.salespersonName ?? null,
      salespersonPhoto: null,
      driveFolderId: null,
      status: "open",
      ownerId: req.body?.ownerId ?? null,
      ownerEmail: req.body?.ownerEmail ?? null,
      ownerName: req.body?.ownerName ?? null,
      collaborators: req.body?.collaborators ?? "[]",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    res.json(newDeal);
  });

  app.patch("/deals/:id/status", (req: Request, res: Response) => {
    const deal = fixtures.deals.find((d) => d.id === req.params.id);
    res.json({
      ...(deal ?? fixtures.deals[0]),
      status: req.body?.status ?? "open",
      updatedAt: new Date().toISOString(),
    });
  });

  app.patch("/deals/:id/assignment", (req: Request, res: Response) => {
    const deal = fixtures.deals.find((d) => d.id === req.params.id);
    res.json({
      ...(deal ?? fixtures.deals[0]),
      ownerId: req.body?.ownerId ?? null,
      ownerEmail: req.body?.ownerEmail ?? null,
      ownerName: req.body?.ownerName ?? null,
      updatedAt: new Date().toISOString(),
    });
  });

  // ────────────────────────────────────────────────────────────
  // Users
  // ────────────────────────────────────────────────────────────

  app.get("/users/known", (_req: Request, res: Response) => {
    res.json(fixtures.users);
  });

  app.get("/users", (_req: Request, res: Response) => {
    res.json(fixtures.users);
  });

  // ────────────────────────────────────────────────────────────
  // Interactions
  // ────────────────────────────────────────────────────────────

  app.get("/deals/:dealId/interactions", (_req: Request, res: Response) => {
    // Stage-aware: merge stage fixtures if stage is set and stage file exists
    const stageFixtures = loadStageFixtures(tutorialName, currentStage);
    if (stageFixtures?.interactions) {
      // Stage provides full replacement for interactions
      res.json(stageFixtures.interactions);
    } else {
      res.json(fixtures.interactions ?? []);
    }
  });

  // HITL Stage Management
  app.post("/interactions/:id/revert-stage", (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  app.post("/interactions/:id/mark-failed", (_req: Request, res: Response) => {
    res.json({ success: true, status: "failed" });
  });

  app.post("/interactions/:id/regenerate-stage", (_req: Request, res: Response) => {
    res.json({ success: true, stage: "skeleton" });
  });

  app.post("/interactions/:id/retry-generation", (_req: Request, res: Response) => {
    res.json({ success: true, runId: "mock-run-id", interactionId: _req.params.id });
  });

  // Asset Review (stage-aware: checks stage fixtures for assetReview field first)
  app.get("/interactions/:id/asset-review", (req: Request, res: Response) => {
    const stageFixtures = loadStageFixtures(tutorialName, currentStage);
    const stageAssetReview = (stageFixtures as Record<string, unknown>)?.assetReview;
    if (stageAssetReview) {
      res.json(stageAssetReview);
      return;
    }

    // Fallback: hardcoded default response
    res.json({
      interaction: {
        id: req.params.id,
        status: "completed",
        outputRefs: {
          deckUrl: "https://docs.google.com/presentation/d/mock",
          talkTrackUrl: "https://docs.google.com/document/d/mock-talk",
          faqUrl: "https://docs.google.com/document/d/mock-faq",
          dealFolderId: "mock-folder-id",
        },
      },
      deal: {
        companyName: fixtures.companies[0]?.name ?? "Mock Company",
        industry: fixtures.companies[0]?.industry ?? "Technology",
        dealName: fixtures.deals[0]?.name ?? "Mock Deal",
      },
      brief: null,
      complianceResult: { passed: true, warnings: [] },
    });
  });

  app.post("/interactions/:id/approve-assets", (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  app.post("/interactions/:id/reject-assets", (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  // ────────────────────────────────────────────────────────────
  // Deal Chat
  // ────────────────────────────────────────────────────────────

  app.get("/deals/:dealId/chat", (_req: Request, res: Response) => {
    const stageFixtures = loadStageFixtures(tutorialName, currentStage);
    const chatData = (stageFixtures as Record<string, unknown>)?.chatBootstrap;
    if (chatData) {
      res.json(chatData);
    } else {
      res.json({
        messages: [],
        greeting: "Hello! How can I help you with this deal?",
        suggestions: [
          { label: "Summarize this deal", value: "Summarize this deal" },
          { label: "What are the next steps?", value: "What are the next steps?" },
        ],
      });
    }
  });

  app.post("/deals/:dealId/chat", (_req: Request, res: Response) => {
    // Return a streaming-compatible response
    res.setHeader("Content-Type", "text/plain");
    res.write("This is a mock response from the deal chat assistant.");
    res.end();
  });

  app.get("/deals/:dealId/chat/bindings", (_req: Request, res: Response) => {
    res.json([]);
  });

  app.post("/deals/:dealId/chat/bindings", (_req: Request, res: Response) => {
    res.json({
      source: {
        id: "mock-source-id",
        dealId: _req.params.dealId,
        sourceType: "note",
        touchType: null,
        interactionId: null,
        originPage: "chat",
        rawText: "Mock binding text",
        refinedText: null,
        status: "confirmed",
        bindingMetaJson: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      confirmationChip: {
        label: "Note saved",
        type: "success",
      },
    });
  });

  // ────────────────────────────────────────────────────────────
  // Workflows (Touch 1-4 + Pre-Call)
  // ────────────────────────────────────────────────────────────

  const workflowNames = [
    "touch-1-workflow",
    "touch-2-workflow",
    "touch-3-workflow",
    "touch-4-workflow",
    "pre-call-workflow",
  ];

  for (const wf of workflowNames) {
    app.post(`/api/workflows/${wf}/start-async`, (_req: Request, res: Response) => {
      res.json({ runId: `mock-run-${wf}-${Date.now()}`, status: "running" });
    });

    app.get(`/api/workflows/${wf}/runs/:runId`, (_req: Request, res: Response) => {
      // Check sequence first (highest priority)
      const seqResponse = getNextSequenceResponse("workflow-status");
      if (seqResponse !== null) {
        res.json(seqResponse);
        return;
      }
      // Derive from current stage
      let status: string;
      switch (currentStage) {
        case "generating":
          status = "running";
          break;
        case "skeleton":
        case "lowfi":
        case "hifi":
          status = "suspended";
          break;
        case "idle":
        case "completed":
        default:
          status = "completed";
          break;
      }
      res.json({
        runId: _req.params.runId,
        status,
        steps: {},
        result: {},
      });
    });

    app.post(`/api/workflows/${wf}/resume`, (_req: Request, res: Response) => {
      res.json({
        runId: _req.query.runId ?? "mock-run-id",
        status: "completed",
        steps: {},
        result: {},
      });
    });
  }

  // ────────────────────────────────────────────────────────────
  // Generation Logs
  // ────────────────────────────────────────────────────────────

  app.get("/api/generation-logs/:dealId/:touchType", (_req: Request, res: Response) => {
    res.json({ logs: [] });
  });

  app.get("/generation-logs", (_req: Request, res: Response) => {
    res.json({ logs: [] });
  });

  // ────────────────────────────────────────────────────────────
  // Templates
  // ────────────────────────────────────────────────────────────

  app.get("/templates", (_req: Request, res: Response) => {
    const stageFixtures = loadStageFixtures(tutorialName, currentStage);
    const stageTemplates = (stageFixtures as Record<string, unknown>)?.templates;
    if (Array.isArray(stageTemplates)) {
      res.json(stageTemplates);
    } else {
      res.json(fixtures.templates ?? []);
    }
  });

  app.post("/templates", (_req: Request, res: Response) => {
    const template = {
      id: `tmpl-mock-${Date.now()}`,
      name: "Mock Template",
      presentationId: _req.body?.presentationId ?? "mock-presentation",
      googleSlidesUrl: _req.body?.googleSlidesUrl ?? "https://docs.google.com/presentation/d/mock",
      touchTypes: JSON.stringify(_req.body?.touchTypes ?? []),
      artifactType: null,
      accessStatus: "accessible",
      lastIngestedAt: null,
      sourceModifiedAt: null,
      slideCount: 0,
      ingestionStatus: "idle",
      ingestionProgress: null,
      contentClassification: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    res.json({ template, serviceAccountEmail: "mock@mock.iam.gserviceaccount.com" });
  });

  app.delete("/templates/:id", (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  app.post("/templates/:id/check-staleness", (_req: Request, res: Response) => {
    res.json({ isStale: false });
  });

  app.post("/templates/:id/classify", (_req: Request, res: Response) => {
    const tmpl = (fixtures.templates ?? [])[0];
    res.json(tmpl ?? { id: _req.params.id, name: "Mock Template" });
  });

  app.post("/templates/:id/ingest", (_req: Request, res: Response) => {
    res.json({ queued: true });
  });

  app.get("/templates/:id/progress", (_req: Request, res: Response) => {
    // Check sequence first
    const seqResponse = getNextSequenceResponse("ingestion-progress");
    if (seqResponse !== null) {
      res.json(seqResponse);
      return;
    }
    res.json({ status: "idle", current: 0, total: 0 });
  });

  // ────────────────────────────────────────────────────────────
  // Slides
  // ────────────────────────────────────────────────────────────

  app.get("/templates/:templateId/slides", (_req: Request, res: Response) => {
    res.json(fixtures.slides ?? []);
  });

  app.get("/templates/:templateId/thumbnails", (_req: Request, res: Response) => {
    res.json({ thumbnails: [], caching: false });
  });

  app.get("/presentations/:presentationId/thumbnails", (_req: Request, res: Response) => {
    res.json({ thumbnails: [], caching: false });
  });

  app.post("/slides/:slideId/update-classification", (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  app.post("/slides/:slideId/similar", (_req: Request, res: Response) => {
    res.json({ results: [] });
  });

  // ────────────────────────────────────────────────────────────
  // Briefs
  // ────────────────────────────────────────────────────────────

  app.get("/briefs/:briefId", (_req: Request, res: Response) => {
    const baseBrief = {
      id: _req.params.briefId,
      interactionId: "mock-interaction",
      primaryPillar: "Cloud Transformation",
      secondaryPillars: "[]",
      evidence: "Mock evidence",
      customerContext: "Mock context",
      businessOutcomes: "Mock outcomes",
      constraints: "Mock constraints",
      stakeholders: "Mock stakeholders",
      timeline: "Q2 2026",
      budget: "$500k-1M",
      useCases: "[]",
      roiFraming: "{}",
      approvalStatus: "pending_approval",
      reviewerName: null,
      approvedAt: null,
      rejectionFeedback: null,
      workflowRunId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // Stage-aware: merge brief overrides from stage fixtures
    const stageFixtures = loadStageFixtures(tutorialName, currentStage);
    if (stageFixtures && (stageFixtures as Record<string, unknown>).brief) {
      res.json(
        deepMerge(
          baseBrief as unknown as Record<string, unknown>,
          (stageFixtures as Record<string, unknown>).brief as Record<string, unknown>
        )
      );
    } else {
      res.json(baseBrief);
    }
  });

  app.get("/briefs/:briefId/review", (req: Request, res: Response) => {
    const baseBrief = {
      id: req.params.briefId,
      interactionId: "mock-interaction",
      primaryPillar: "Cloud Transformation",
      secondaryPillars: "[]",
      evidence: "Mock evidence",
      customerContext: "Mock context",
      businessOutcomes: "Mock outcomes",
      constraints: "Mock constraints",
      stakeholders: "Mock stakeholders",
      timeline: "Q2 2026",
      budget: "$500k-1M",
      useCases: "[]",
      roiFraming: "{}",
      approvalStatus: "pending_approval",
      reviewerName: null,
      approvedAt: null,
      rejectionFeedback: null,
      workflowRunId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const baseReview = {
      brief: baseBrief,
      deal: {
        companyName: fixtures.companies[0]?.name ?? "Mock Company",
        industry: fixtures.companies[0]?.industry ?? "Technology",
        dealName: fixtures.deals[0]?.name ?? "Mock Deal",
      },
      transcript: null,
    };
    // Stage-aware: merge brief overrides into the review response
    const stageFixtures = loadStageFixtures(tutorialName, currentStage);
    if (stageFixtures && (stageFixtures as Record<string, unknown>).brief) {
      baseReview.brief = deepMerge(
        baseBrief as unknown as Record<string, unknown>,
        (stageFixtures as Record<string, unknown>).brief as Record<string, unknown>
      ) as typeof baseBrief;
    }
    res.json(baseReview);
  });

  app.post("/briefs/:briefId/approve", (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  app.post("/briefs/:briefId/reject", (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  app.post("/briefs/:briefId/edit", (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  // ────────────────────────────────────────────────────────────
  // User Settings (needed for Drive Settings page)
  // ────────────────────────────────────────────────────────────

  const userSettings: Record<string, Record<string, string | null>> = {};

  app.get("/user-settings/:userId/:key", (req: Request, res: Response) => {
    const userId = req.params.userId as string;
    const key = req.params.key as string;
    // Stage-aware: check stage fixtures first
    const stageFixtures = loadStageFixtures(tutorialName, currentStage);
    const stageSettings = (stageFixtures as Record<string, unknown>)?.userSettings as Record<string, string | null> | undefined;
    if (stageSettings && key in stageSettings) {
      res.json({ value: stageSettings[key] });
      return;
    }
    const val = userSettings[userId]?.[key] ?? null;
    res.json({ value: val });
  });

  app.put("/user-settings/:userId/:key", (req: Request, res: Response) => {
    const userId = req.params.userId as string;
    const key = req.params.key as string;
    if (!userSettings[userId]) userSettings[userId] = {};
    userSettings[userId][key] = req.body?.value ?? null;
    res.json({ value: userSettings[userId][key] });
  });

  // ────────────────────────────────────────────────────────────
  // Actions Required (stage-aware)
  // ────────────────────────────────────────────────────────────

  app.get("/actions", (_req: Request, res: Response) => {
    const stageFixtures = loadStageFixtures(tutorialName, currentStage);
    if (stageFixtures && (stageFixtures as Record<string, unknown>).actions) {
      res.json((stageFixtures as Record<string, unknown>).actions);
    } else {
      res.json((fixtures as Record<string, unknown>).actions ?? []);
    }
  });

  app.get("/actions/count", (_req: Request, res: Response) => {
    const stageFixtures = loadStageFixtures(tutorialName, currentStage);
    const stageActions = (stageFixtures as Record<string, unknown>)?.actions;
    if (Array.isArray(stageActions)) {
      res.json({ count: stageActions.length });
    } else {
      const baseActions = (fixtures as Record<string, unknown>).actions;
      res.json({ count: Array.isArray(baseActions) ? baseActions.length : 0 });
    }
  });

  app.patch("/actions/:id/resolve", (req: Request, res: Response) => {
    res.json({ id: req.params.id, resolved: true });
  });

  app.patch("/actions/:id/silence", (req: Request, res: Response) => {
    res.json({ id: req.params.id, silenced: true });
  });

  // ────────────────────────────────────────────────────────────
  // Atlus OAuth
  // ────────────────────────────────────────────────────────────

  app.post("/atlus/oauth/store-token", (_req: Request, res: Response) => {
    res.json({ success: true, accessResult: "stored" });
  });

  // ────────────────────────────────────────────────────────────
  // Discovery (AtlusAI)
  // ────────────────────────────────────────────────────────────

  app.get("/discovery/access-check", (_req: Request, res: Response) => {
    const stageFixtures = loadStageFixtures(tutorialName, currentStage);
    const access = (stageFixtures as Record<string, unknown>)?.discoveryAccess;
    if (access) {
      res.json(access);
    } else {
      res.json({ hasAccess: true });
    }
  });

  app.get("/discovery/browse", (_req: Request, res: Response) => {
    const stageFixtures = loadStageFixtures(tutorialName, currentStage);
    const browse = (stageFixtures as Record<string, unknown>)?.discoveryBrowse;
    if (browse) {
      res.json(browse);
    } else {
      res.json({ documents: [], ingestedHashes: [] });
    }
  });

  app.post("/discovery/search", (_req: Request, res: Response) => {
    const stageFixtures = loadStageFixtures(tutorialName, currentStage);
    const search = (stageFixtures as Record<string, unknown>)?.discoverySearch;
    if (search) {
      res.json(search);
    } else {
      res.json({ results: [], ingestedHashes: [] });
    }
  });

  app.post("/discovery/ingest", (_req: Request, res: Response) => {
    res.json({ batchId: `batch-mock-${Date.now()}` });
  });

  app.get("/discovery/ingest/:batchId/progress", (_req: Request, res: Response) => {
    res.json({ items: [], complete: true });
  });

  // ────────────────────────────────────────────────────────────
  // Deck Structures
  // ────────────────────────────────────────────────────────────

  app.get("/deck-structures", (_req: Request, res: Response) => {
    const stageFixtures = loadStageFixtures(tutorialName, currentStage);
    const structures = (stageFixtures as Record<string, unknown>)?.deckStructures;
    if (Array.isArray(structures)) {
      res.json(structures);
    } else {
      res.json([]);
    }
  });

  app.get("/deck-structures/:touchType", (req: Request, res: Response) => {
    const stageFixtures = loadStageFixtures(tutorialName, currentStage);
    const detail = (stageFixtures as Record<string, unknown>)?.deckStructureDetail;
    if (detail) {
      res.json(detail);
    } else {
      res.json({
        touchType: req.params.touchType,
        structure: { sections: [], sequenceRationale: "Mock rationale" },
        exampleCount: 0,
        confidence: 0,
        confidenceColor: "red",
        confidenceLabel: "No data",
        chatMessages: [],
        chatContext: null,
        slideIdToThumbnail: {},
        inferredAt: null,
        lastChatAt: null,
      });
    }
  });

  app.post("/deck-structures/:touchType/infer", (_req: Request, res: Response) => {
    res.json({
      touchType: _req.params.touchType,
      structure: { sections: [], sequenceRationale: "Mock" },
      confidence: 0,
    });
  });

  app.delete("/deck-structures/:touchType/memories", (req: Request, res: Response) => {
    res.json({
      touchType: req.params.touchType,
      structure: { sections: [], sequenceRationale: "Reset" },
      exampleCount: 0,
      confidence: 0,
      confidenceColor: "red",
      confidenceLabel: "No data",
      chatMessages: [],
      chatContext: null,
      slideIdToThumbnail: {},
      inferredAt: null,
      lastChatAt: null,
    });
  });

  app.delete(
    "/deck-structures/:touchType/messages/:messageId",
    (_req: Request, res: Response) => {
      res.json({ success: true });
    }
  );

  // ────────────────────────────────────────────────────────────
  // Agent Configs
  // ────────────────────────────────────────────────────────────

  app.get("/agent-configs", (_req: Request, res: Response) => {
    const stageFixtures = loadStageFixtures(tutorialName, currentStage);
    const stageAgents = (stageFixtures as Record<string, unknown>)?.agentConfigs;
    if (Array.isArray(stageAgents)) {
      res.json(stageAgents);
    } else {
      res.json([]);
    }
  });

  app.get("/agent-configs/:agentId", (req: Request, res: Response) => {
    const stageFixtures = loadStageFixtures(tutorialName, currentStage);
    const detail = (stageFixtures as Record<string, unknown>)?.agentConfigDetail;
    if (detail) {
      res.json(detail);
    } else {
      res.json({
        agentId: req.params.agentId,
        name: "Mock Agent",
        responsibility: "Mock responsibility",
        family: "mock",
        isShared: false,
        publishedVersion: null,
        draft: null,
      });
    }
  });

  app.get("/agent-configs/:agentId/versions", (_req: Request, res: Response) => {
    const stageFixtures = loadStageFixtures(tutorialName, currentStage);
    const versions = (stageFixtures as Record<string, unknown>)?.agentConfigVersions;
    if (Array.isArray(versions)) {
      res.json(versions);
    } else {
      res.json([]);
    }
  });

  app.post("/agent-configs/:agentId/draft", (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  app.post("/agent-configs/:agentId/publish", (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  app.post("/agent-configs/:agentId/discard", (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  app.post("/agent-configs/:agentId/rollback", (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  app.post("/agent-configs/baseline/draft", (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  app.post("/agent-configs/baseline/publish", (_req: Request, res: Response) => {
    res.json({ agentsUpdated: 0 });
  });

  // ────────────────────────────────────────────────────────────
  // Catch-all 404 (logs unhandled routes for debugging)
  // ────────────────────────────────────────────────────────────

  app.use((req: Request, res: Response) => {
    console.warn(`[mock-server] Unhandled: ${req.method} ${req.url}`);
    res.status(404).json({ error: "Not mocked", path: req.url });
  });

  return app;
}

/**
 * Start the mock server and return a handle for cleanup.
 */
export async function startMockServer(
  tutorialName: string,
  port: number = DEFAULT_PORT
): Promise<{ server: Server; port: number }> {
  const app = createMockServer(tutorialName);

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      resolve({ server, port: actualPort });
    });
  });
}

// ────────────────────────────────────────────────────────────
// Standalone run mode
// ────────────────────────────────────────────────────────────

const isMainModule =
  typeof require !== "undefined"
    ? require.main === module
    : process.argv[1]?.endsWith("mock-server.ts");

if (isMainModule) {
  startMockServer(process.argv[2] || "getting-started").then(({ port }) => {
    console.log(`Mock agent server running on http://localhost:${port}`);
  });
}
