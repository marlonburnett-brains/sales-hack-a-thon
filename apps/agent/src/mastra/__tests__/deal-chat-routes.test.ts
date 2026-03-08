import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  registeredRoutes,
  mockGetDealChatMessages,
  mockAppendDealChatMessage,
  mockSaveDealContextSource,
  mockConfirmDealContextSource,
  mockRunDealChatTurn,
} = vi.hoisted(() => ({
  registeredRoutes: [] as Array<{ path: string; method: string; handler: (context: any) => Promise<any> }>,
  mockGetDealChatMessages: vi.fn(),
  mockAppendDealChatMessage: vi.fn(),
  mockSaveDealContextSource: vi.fn(),
  mockConfirmDealContextSource: vi.fn(),
  mockRunDealChatTurn: vi.fn(),
}));

vi.mock("@mastra/core", () => ({
  Mastra: class {
    config: Record<string, unknown>;

    constructor(config: Record<string, unknown>) {
      this.config = config;
    }

    getWorkflow() {
      return {
        createRun: async () => ({
          resume: async () => undefined,
          get: async () => ({}),
        }),
      };
    }
  },
}));

vi.mock("@mastra/core/server", () => ({
  registerApiRoute: (path: string, config: { method: string; handler: (context: any) => Promise<any> }) => {
    const route = { path, ...config };
    registeredRoutes.push(route);
    return route;
  },
  SimpleAuth: class {},
}));

vi.mock("@mastra/pg", () => ({
  PostgresStore: class {},
}));

vi.mock("../../env", () => ({
  env: {
    DATABASE_URL: "postgres://example",
    MASTRA_PORT: "4111",
    WEB_APP_URL: "http://localhost:3000",
    AGENT_API_KEY: "test-key",
    NODE_ENV: "test",
    GOOGLE_CLOUD_PROJECT: "test-project",
    GOOGLE_CLOUD_LOCATION: "us-central1",
    GOOGLE_DRIVE_FOLDER_ID: "drive-folder",
  },
}));

vi.mock("../../lib/db", () => ({
  prisma: new Proxy(
    {},
    {
      get() {
        return {
          findMany: vi.fn(async () => []),
          findUnique: vi.fn(async () => null),
          findFirst: vi.fn(async () => null),
          create: vi.fn(async () => ({})),
          update: vi.fn(async () => ({})),
          upsert: vi.fn(async () => ({})),
        };
      },
    },
  ),
}));

vi.mock("../../deal-chat/persistence", () => ({
  getDealChatMessages: mockGetDealChatMessages,
  appendDealChatMessage: mockAppendDealChatMessage,
  saveDealContextSource: mockSaveDealContextSource,
  confirmDealContextSource: mockConfirmDealContextSource,
}));

vi.mock("../../deal-chat/assistant", () => ({
  buildDealChatSuggestions: (routeContext: { pageLabel: string }) => [
    {
      id: "suggestion-1",
      label: `Ask about ${routeContext.pageLabel}`,
      prompt: `Ask about ${routeContext.pageLabel}`,
      kind: "question",
    },
  ],
  runDealChatTurn: mockRunDealChatTurn,
}));

vi.mock("../workflows/touch-1-workflow", () => ({ touch1Workflow: {} }));
vi.mock("../workflows/touch-2-workflow", () => ({ touch2Workflow: {} }));
vi.mock("../workflows/touch-3-workflow", () => ({ touch3Workflow: {} }));
vi.mock("../workflows/touch-4-workflow", () => ({ touch4Workflow: {} }));
vi.mock("../workflows/pre-call-workflow", () => ({ preCallWorkflow: {} }));
vi.mock("../../lib/drive-folders", () => ({
  getOrCreateDealFolder: vi.fn(),
  shareWithOrg: vi.fn(),
  resolveRootFolderId: vi.fn(),
  archiveExistingFile: vi.fn(),
}));
vi.mock("../../lib/google-auth", () => ({
  getDriveClient: vi.fn(),
  getSlidesClient: vi.fn(),
  getPooledGoogleAuth: vi.fn(),
}));
vi.mock("../../lib/request-auth", () => ({ extractGoogleAuth: vi.fn() }));
vi.mock("../../lib/atlusai-client", () => ({ ingestDocument: vi.fn() }));
vi.mock("../../ingestion/ingestion-queue", () => ({
  ingestionQueue: { enqueue: vi.fn() },
  clearStaleIngestions: vi.fn(async () => undefined),
}));
vi.mock("../../ingestion/backfill-descriptions", () => ({
  detectAndQueueBackfill: vi.fn(async () => undefined),
}));
vi.mock("../../ingestion/auto-classify-templates", () => ({
  autoClassifyTemplates: vi.fn(),
  autoIngestNewTemplates: vi.fn(),
}));
vi.mock("../../lib/token-encryption", () => ({ encryptToken: vi.fn() }));
vi.mock("../../lib/atlus-auth", () => ({
  detectAtlusAccess: vi.fn(),
  upsertAtlusToken: vi.fn(),
  resolveActionsByType: vi.fn(),
  getPooledAtlusAuth: vi.fn(),
}));
vi.mock("../../lib/mcp-client", () => ({
  initMcp: vi.fn(async () => undefined),
  shutdownMcp: vi.fn(async () => undefined),
  callMcpTool: vi.fn(),
  isMcpAvailable: vi.fn(() => false),
}));
vi.mock("../../lib/atlusai-search", () => ({ searchSlides: vi.fn() }));
vi.mock("../../lib/gcs-thumbnails", () => ({
  cacheThumbnailsForTemplate: vi.fn(),
  THUMBNAIL_TTL_MS: 1000,
  cacheDocumentCover: vi.fn(),
  checkGcsCoverExists: vi.fn(),
}));
vi.mock("../../deck-intelligence/auto-infer-cron", () => ({ startDeckInferenceCron: vi.fn() }));
vi.mock("../../deck-intelligence/deck-structure-key", () => ({
  getDeckStructureListKeys: vi.fn(() => []),
  resolveDeckStructureKey: vi.fn(),
}));
vi.mock("../../deck-intelligence/infer-deck-structure", () => ({
  buildEmptyDeckStructureOutput: vi.fn(() => ({ sections: [], sequenceRationale: "" })),
  GENERIC_TOUCH_4_UNAVAILABLE_MESSAGE: "unavailable",
  inferDeckStructure: vi.fn(),
  isUnsupportedGenericTouch4: vi.fn(() => false),
}));
vi.mock("../../deck-intelligence/deck-structure-schema", () => ({ calculateConfidence: vi.fn() }));
vi.mock("../../deck-intelligence/chat-refinement", () => ({ streamChatRefinement: vi.fn() }));
vi.mock("../agents", () => ({ namedMastraAgents: {} }));
vi.mock("../../lib/agent-config", () => ({
  compileAgentInstructions: vi.fn(),
  invalidateAgentPromptCache: vi.fn(),
  getPublishedAgentConfig: vi.fn(),
}));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {},
}));

function createContext(options: {
  params?: Record<string, string>;
  query?: Record<string, string | null | undefined>;
  body?: unknown;
}) {
  return {
    req: {
      param: (key: string) => options.params?.[key] ?? "",
      query: (key?: string) => {
        if (!key) {
          return options.query ?? {};
        }

        return options.query?.[key] ?? undefined;
      },
      json: async () => options.body,
    },
    json(payload: unknown, status = 200) {
      return new Response(JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    },
  };
}

function getRoute(path: string, method: string) {
  const route = registeredRoutes.find(
    (entry) => entry.path === path && entry.method === method,
  );

  if (!route) {
    throw new Error(`Missing route ${method} ${path}`);
  }

  return route;
}

describe("deal chat route contract", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    registeredRoutes.length = 0;
    await import("../index");

    mockGetDealChatMessages.mockResolvedValue([
      {
        id: "message-1",
        role: "assistant",
        content: "Saved answer",
        metaJson: JSON.stringify({ response: { directAnswer: "Saved answer" } }),
        createdAt: new Date("2026-03-08T23:00:00Z"),
      },
    ]);
    mockAppendDealChatMessage.mockResolvedValue(undefined);
    mockRunDealChatTurn.mockResolvedValue({
      text: "Direct answer: Grounded answer\n\nSupporting details:\n- Deal context",
      meta: {
        response: {
          directAnswer: "Grounded answer",
          supportingBullets: ["Deal context"],
          missingInfoCallouts: [],
          nextSteps: ["Ask a follow-up"],
          knowledgeMatches: [],
        },
        suggestions: [],
        binding: {
          status: "needs_confirmation",
          source: {
            id: null,
            sourceType: "note",
            touchType: null,
            title: null,
            rawText: "Meeting note",
            refinedText: null,
            routeContext: {
              section: "briefing",
              touchType: null,
              pathname: "/deals/deal-1/briefing",
              pageLabel: "Briefing",
            },
          },
          guessedTouchType: null,
          confirmationLabel: "Save as general deal notes",
          reason: "Need confirmation",
        },
        refineBeforeSave: null,
        confirmationChips: [],
        promptVersion: {
          agentId: "deal-chat-assistant",
          id: "version-1",
          version: 1,
          publishedAt: "2026-03-08T23:00:00.000Z",
          publishedBy: "planner",
        },
      },
    });
    mockSaveDealContextSource.mockResolvedValue({ id: "source-1" });
    mockConfirmDealContextSource.mockResolvedValue({
      id: "source-1",
      sourceType: "note",
      touchType: "touch_2",
      status: "saved",
    });
  });

  it("returns persisted thread bootstrap for a deal", async () => {
    const route = getRoute("/deals/:dealId/chat", "GET");

    const response = await route.handler(
      createContext({
        params: { dealId: "deal-1" },
        query: {
          section: "briefing",
          pathname: "/deals/deal-1/briefing",
          pageLabel: "Briefing",
        },
      }),
    );

    const payload = await response.json();

    expect(mockGetDealChatMessages).toHaveBeenCalledWith("deal-1");
    expect(payload).toMatchObject({
      messages: [
        {
          id: "message-1",
          role: "assistant",
          content: "Saved answer",
        },
      ],
      suggestions: [
        expect.objectContaining({ label: "Ask about Briefing" }),
      ],
    });
  });

  it("streams assistant text and appends the final deal chat meta payload", async () => {
    const route = getRoute("/deals/:dealId/chat", "POST");

    const response = await route.handler(
      createContext({
        params: { dealId: "deal-1" },
        body: {
          message: "Save these notes",
          routeContext: {
            section: "briefing",
            touchType: null,
            pathname: "/deals/deal-1/briefing",
            pageLabel: "Briefing",
          },
        },
      }),
    );

    const text = await response.text();

    expect(mockAppendDealChatMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ role: "user", dealId: "deal-1" }),
    );
    expect(mockRunDealChatTurn).toHaveBeenCalledWith(
      expect.objectContaining({ dealId: "deal-1" }),
    );
    expect(mockAppendDealChatMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ role: "assistant", metaJson: expect.any(String) }),
    );
    expect(text).toContain("Direct answer: Grounded answer");
    expect(text).toContain("---DEAL_CHAT_META---");
    expect(text).toContain('"promptVersion"');
  });

  it("accepts binding confirmation payloads and returns saved source metadata", async () => {
    const route = getRoute("/deals/:dealId/chat/bindings", "POST");

    const response = await route.handler(
      createContext({
        params: { dealId: "deal-1" },
        body: {
          action: "correct",
          touchType: "touch_2",
          source: {
            id: null,
            sourceType: "note",
            touchType: null,
            title: null,
            rawText: "Meeting note",
            refinedText: "Meeting note",
            routeContext: {
              section: "briefing",
              touchType: null,
              pathname: "/deals/deal-1/briefing",
              pageLabel: "Briefing",
            },
          },
        },
      }),
    );

    const payload = await response.json();

    expect(mockSaveDealContextSource).toHaveBeenCalledWith(
      expect.objectContaining({ dealId: "deal-1" }),
    );
    expect(mockConfirmDealContextSource).toHaveBeenCalledWith(
      "source-1",
      expect.objectContaining({ touchType: "touch_2" }),
    );
    expect(payload).toMatchObject({
      source: {
        id: "source-1",
        status: "saved",
      },
      confirmationChip: {
        label: "Saved to touch 2",
      },
    });
  });

  it("uses persistence helpers and the deal chat orchestrator instead of stub data", async () => {
    const source = await import("node:fs").then(({ readFileSync }) =>
      readFileSync(new URL("../index.ts", import.meta.url), "utf8"),
    );

    expect(source).toMatch(/getDealChatMessages/);
    expect(source).toMatch(/appendDealChatMessage/);
    expect(source).toMatch(/runDealChatTurn/);
    expect(source).toMatch(/saveDealContextSource/);
    expect(source).toMatch(/confirmDealContextSource/);
    expect(source).toMatch(/registerApiRoute\("\/deals\/:dealId\/chat"/);
    expect(source).toMatch(/registerApiRoute\("\/deals\/:dealId\/chat\/bindings"/);
  });
});
