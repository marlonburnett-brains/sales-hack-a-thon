import { beforeEach, describe, expect, it, vi } from "vitest";

// ────────────────────────────────────────────────────────────
// Hoisted mocks: capture registered routes + control dependencies
// ────────────────────────────────────────────────────────────

const {
  registeredRoutes,
  mockGetVerifiedUserId,
  mockTutorialViewUpsert,
} = vi.hoisted(() => ({
  registeredRoutes: [] as Array<{
    path: string;
    method: string;
    handler: (context: any) => Promise<any>;
  }>,
  mockGetVerifiedUserId: vi.fn(),
  mockTutorialViewUpsert: vi.fn(),
}));

vi.mock("@mastra/core", () => ({
  Mastra: class {
    config: Record<string, unknown>;
    constructor(config: Record<string, unknown>) {
      this.config = config;
    }
    getWorkflow() {
      return {
        createRun: async () => ({ resume: async () => undefined, get: async () => ({}) }),
      };
    }
  },
}));

vi.mock("@mastra/core/server", () => ({
  registerApiRoute: (
    path: string,
    config: { method: string; handler: (context: any) => Promise<any> },
  ) => {
    const route = { path, ...config };
    registeredRoutes.push(route);
    return route;
  },
  SimpleAuth: class {},
  MastraAuthProvider: class {},
}));

vi.mock("@mastra/pg", () => ({
  PostgresStore: class {
    init = vi.fn(async () => undefined);
  },
}));

vi.mock("../../env", () => ({
  env: {
    DATABASE_URL: "postgres://example",
    MASTRA_PORT: "4111",
    WEB_APP_URL: "http://localhost:3000",
    SUPABASE_URL: "https://test-project.supabase.co",
    NODE_ENV: "test",
    GOOGLE_CLOUD_PROJECT: "test-project",
    GOOGLE_CLOUD_LOCATION: "us-central1",
    GOOGLE_DRIVE_FOLDER_ID: "drive-folder",
  },
}));

// Prisma mock: tutorialView.upsert is controlled; all others are no-ops
vi.mock("../../lib/db", () => ({
  prisma: new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "tutorialView") {
          return {
            findMany: vi.fn(async () => []),
            upsert: mockTutorialViewUpsert,
          };
        }
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

vi.mock("../../lib/request-auth", () => ({
  extractGoogleAuth: vi.fn(),
  getVerifiedUserId: mockGetVerifiedUserId,
}));

// Stub out all other heavy dependencies that index.ts imports
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
vi.mock("../../deck-intelligence/auto-infer-cron", () => ({
  startDeckInferenceCron: vi.fn(),
}));
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
vi.mock("../../deck-intelligence/deck-structure-schema", () => ({
  calculateConfidence: vi.fn(),
}));
vi.mock("../../deck-intelligence/chat-refinement", () => ({
  streamChatRefinement: vi.fn(),
}));
vi.mock("../agents", () => ({ namedMastraAgents: {} }));
vi.mock("../../lib/agent-config", () => ({
  compileAgentInstructions: vi.fn(),
  invalidateAgentPromptCache: vi.fn(),
  getPublishedAgentConfig: vi.fn(),
}));
vi.mock("@google/genai", () => ({
  Type: {
    OBJECT: "OBJECT",
    ARRAY: "ARRAY",
    STRING: "STRING",
    NUMBER: "NUMBER",
    BOOLEAN: "BOOLEAN",
  },
  GoogleGenAI: class {},
}));

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function createContext(options: {
  authHeader?: string;
  tutorialId?: string;
  body?: Record<string, unknown>;
}) {
  return {
    req: {
      header: (name: string) => {
        if (name === "Authorization") return options.authHeader;
        return undefined;
      },
      param: (key: string) => {
        if (key === "id") return options.tutorialId ?? "tutorial-123";
        return "";
      },
      query: (_key?: string) => undefined,
      json: async () => options.body ?? {},
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

async function parseResponse(response: Response) {
  const text = await response.text();
  return { status: response.status, body: JSON.parse(text) };
}

// ────────────────────────────────────────────────────────────
// Tests: PATCH /tutorials/:id/progress
// ────────────────────────────────────────────────────────────

describe("PATCH /tutorials/:id/progress", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    registeredRoutes.length = 0;
    await import("../index");
  });

  it("returns 401 when getVerifiedUserId returns null", async () => {
    mockGetVerifiedUserId.mockResolvedValue(null);

    const route = getRoute("/tutorials/:id/progress", "PATCH");
    const ctx = createContext({});
    const response = await route.handler(ctx);
    const { status } = await parseResponse(response);

    expect(status).toBe(401);
    expect(mockTutorialViewUpsert).not.toHaveBeenCalled();
  });

  it("calls tutorialView.upsert with tutorialId, userId, lastPosition and returns { ok: true }", async () => {
    const userId = "user-abc";
    const tutorialId = "tutorial-456";
    const lastPosition = 42.5;

    mockGetVerifiedUserId.mockResolvedValue(userId);
    mockTutorialViewUpsert.mockResolvedValue({
      id: "view-1",
      tutorialId,
      userId,
      lastPosition,
      watched: false,
      watchedAt: null,
    });

    const route = getRoute("/tutorials/:id/progress", "PATCH");
    const ctx = createContext({
      authHeader: "Bearer test-jwt",
      tutorialId,
      body: { lastPosition },
    });
    const response = await route.handler(ctx);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(mockTutorialViewUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tutorialId_userId: { tutorialId, userId } },
        update: expect.objectContaining({ lastPosition }),
        create: expect.objectContaining({ tutorialId, userId, lastPosition }),
      }),
    );
  });
});

// ────────────────────────────────────────────────────────────
// Tests: PATCH /tutorials/:id/watched
// ────────────────────────────────────────────────────────────

describe("PATCH /tutorials/:id/watched", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    registeredRoutes.length = 0;
    await import("../index");
  });

  it("returns 401 when getVerifiedUserId returns null", async () => {
    mockGetVerifiedUserId.mockResolvedValue(null);

    const route = getRoute("/tutorials/:id/watched", "PATCH");
    const ctx = createContext({});
    const response = await route.handler(ctx);
    const { status } = await parseResponse(response);

    expect(status).toBe(401);
    expect(mockTutorialViewUpsert).not.toHaveBeenCalled();
  });

  it("calls tutorialView.upsert with watched=true, watchedAt, lastPosition and returns { ok: true }", async () => {
    const userId = "user-abc";
    const tutorialId = "tutorial-789";
    const lastPosition = 300;

    mockGetVerifiedUserId.mockResolvedValue(userId);
    mockTutorialViewUpsert.mockResolvedValue({
      id: "view-2",
      tutorialId,
      userId,
      lastPosition,
      watched: true,
      watchedAt: new Date(),
    });

    const route = getRoute("/tutorials/:id/watched", "PATCH");
    const ctx = createContext({
      authHeader: "Bearer test-jwt",
      tutorialId,
      body: { lastPosition },
    });
    const response = await route.handler(ctx);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(mockTutorialViewUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tutorialId_userId: { tutorialId, userId } },
        update: expect.objectContaining({
          watched: true,
          watchedAt: expect.any(Date),
          lastPosition,
        }),
        create: expect.objectContaining({
          tutorialId,
          userId,
          watched: true,
          watchedAt: expect.any(Date),
          lastPosition,
        }),
      }),
    );
  });
});
