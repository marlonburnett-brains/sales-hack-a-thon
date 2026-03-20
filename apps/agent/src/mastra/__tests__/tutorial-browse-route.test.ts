import { beforeEach, describe, expect, it, vi } from "vitest";

// ────────────────────────────────────────────────────────────
// Hoisted mocks: capture registered routes + control dependencies
// ────────────────────────────────────────────────────────────

const {
  registeredRoutes,
  mockGetVerifiedUserId,
  mockTutorialFindMany,
  mockTutorialViewFindMany,
} = vi.hoisted(() => ({
  registeredRoutes: [] as Array<{
    path: string;
    method: string;
    handler: (context: any) => Promise<any>;
  }>,
  mockGetVerifiedUserId: vi.fn(),
  mockTutorialFindMany: vi.fn(),
  mockTutorialViewFindMany: vi.fn(),
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

// Prisma mock: tutorial and tutorialView are controlled; all others are no-ops
vi.mock("../../lib/db", () => ({
  prisma: new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "tutorial") {
          return { findMany: mockTutorialFindMany };
        }
        if (prop === "tutorialView") {
          return { findMany: mockTutorialViewFindMany };
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
}) {
  return {
    req: {
      header: (name: string) => {
        if (name === "Authorization") return options.authHeader;
        return undefined;
      },
      param: (_key: string) => "",
      query: (_key?: string) => undefined,
      json: async () => ({}),
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

// Fixed category key order from the plan spec
const EXPECTED_CATEGORY_ORDER = [
  "getting_started",
  "deal_workflows",
  "touch_points",
  "content_management",
  "review",
  "settings_admin",
];

// Sample tutorial rows (DB order is intentionally scrambled to verify fixed sort)
const sampleTutorials = [
  {
    id: "t-4",
    slug: "review-basics",
    title: "Review Basics",
    description: "How to review",
    category: "review",
    durationSec: 120,
    thumbnailUrl: "https://cdn.example.com/review-basics.jpg",
    sortOrder: 14,
  },
  {
    id: "t-1",
    slug: "getting-started-welcome",
    title: "Welcome",
    description: "Welcome tutorial",
    category: "getting_started",
    durationSec: 90,
    thumbnailUrl: "https://cdn.example.com/welcome.jpg",
    sortOrder: 1,
  },
  {
    id: "t-3",
    slug: "touch-points-intro",
    title: "Touch Points Intro",
    description: "Touch points",
    category: "touch_points",
    durationSec: 60,
    thumbnailUrl: null,
    sortOrder: 8,
  },
  {
    id: "t-2",
    slug: "deal-workflows-overview",
    title: "Deal Workflows Overview",
    description: "Deals overview",
    category: "deal_workflows",
    durationSec: 150,
    thumbnailUrl: "https://cdn.example.com/deals.jpg",
    sortOrder: 4,
  },
];

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe("GET /tutorials browse route contract", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    registeredRoutes.length = 0;
    await import("../index");
  });

  it("Test 1: returns categories in locked order regardless of DB ordering", async () => {
    mockGetVerifiedUserId.mockResolvedValue("user-abc");
    mockTutorialFindMany.mockResolvedValue(sampleTutorials);
    mockTutorialViewFindMany.mockResolvedValue([
      { tutorialId: "t-1", watched: true },
    ]);

    const route = getRoute("/tutorials", "GET");
    const ctx = createContext({ authHeader: "Bearer test-jwt" });
    const response = await route.handler(ctx);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(200);
    expect(body.categories).toHaveLength(EXPECTED_CATEGORY_ORDER.length);

    const returnedKeys = body.categories.map((c: { key: string }) => c.key);
    expect(returnedKeys).toEqual(EXPECTED_CATEGORY_ORDER);
  });

  it("Test 2: watched counts use only the authenticated user's TutorialView rows", async () => {
    const userId = "user-xyz";
    mockGetVerifiedUserId.mockResolvedValue(userId);

    // Two tutorials in getting_started
    mockTutorialFindMany.mockResolvedValue([
      { id: "t-gs-1", slug: "gs-1", title: "GS One", description: "d", category: "getting_started", durationSec: 60, thumbnailUrl: null, sortOrder: 1 },
      { id: "t-gs-2", slug: "gs-2", title: "GS Two", description: "d", category: "getting_started", durationSec: 60, thumbnailUrl: null, sortOrder: 2 },
    ]);

    // Only one view row for this user (the other user's view is NOT included)
    mockTutorialViewFindMany.mockResolvedValue([
      { tutorialId: "t-gs-1", watched: true },
    ]);

    const route = getRoute("/tutorials", "GET");
    const ctx = createContext({ authHeader: "Bearer jwt" });
    const response = await route.handler(ctx);
    const { body } = await parseResponse(response);

    const gsCat = body.categories.find((c: { key: string }) => c.key === "getting_started");
    expect(gsCat).toBeDefined();
    expect(gsCat.tutorialCount).toBe(2);
    expect(gsCat.watchedCount).toBe(1);
    expect(gsCat.completionPercent).toBe(50);

    // Overall should reflect the same per-user scoping
    expect(body.overall.totalCount).toBe(2);
    expect(body.overall.completedCount).toBe(1);
    expect(body.overall.completionPercent).toBe(50);

    // Verify the prisma query was scoped to userId
    expect(mockTutorialViewFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId }),
      }),
    );
  });

  it("Test 3: each tutorial card includes slug, title, description, durationSec, thumbnailUrl (nullable), and watched", async () => {
    mockGetVerifiedUserId.mockResolvedValue("user-123");
    mockTutorialFindMany.mockResolvedValue([
      {
        id: "t-with-thumb",
        slug: "has-thumbnail",
        title: "Has Thumbnail",
        description: "With thumb",
        category: "getting_started",
        durationSec: 300,
        thumbnailUrl: "https://cdn.example.com/thumb.jpg",
        sortOrder: 1,
      },
      {
        id: "t-no-thumb",
        slug: "no-thumbnail",
        title: "No Thumbnail",
        description: "Without thumb",
        category: "getting_started",
        durationSec: 120,
        thumbnailUrl: null,
        sortOrder: 2,
      },
    ]);

    mockTutorialViewFindMany.mockResolvedValue([
      { tutorialId: "t-with-thumb", watched: true },
    ]);

    const route = getRoute("/tutorials", "GET");
    const ctx = createContext({ authHeader: "Bearer jwt" });
    const response = await route.handler(ctx);
    const { body } = await parseResponse(response);

    const gsCat = body.categories.find((c: { key: string }) => c.key === "getting_started");
    expect(gsCat.tutorials).toHaveLength(2);

    const [watchedCard, unwatchedCard] = gsCat.tutorials;

    // Card with thumbnail + watched
    expect(watchedCard).toMatchObject({
      id: "t-with-thumb",
      slug: "has-thumbnail",
      title: "Has Thumbnail",
      description: "With thumb",
      durationSec: 300,
      thumbnailUrl: "https://cdn.example.com/thumb.jpg",
      watched: true,
    });

    // Card without thumbnail + not watched
    expect(unwatchedCard).toMatchObject({
      id: "t-no-thumb",
      slug: "no-thumbnail",
      title: "No Thumbnail",
      description: "Without thumb",
      durationSec: 120,
      thumbnailUrl: null,
      watched: false,
    });
  });

  it("Test 4: returns safe empty shape when no tutorials exist", async () => {
    mockGetVerifiedUserId.mockResolvedValue("user-empty");
    mockTutorialFindMany.mockResolvedValue([]);
    mockTutorialViewFindMany.mockResolvedValue([]);

    const route = getRoute("/tutorials", "GET");
    const ctx = createContext({ authHeader: "Bearer jwt" });
    const response = await route.handler(ctx);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(200);
    expect(body.overall.totalCount).toBe(0);
    expect(body.overall.completedCount).toBe(0);
    expect(body.overall.completionPercent).toBe(0);

    // All six categories present with empty tutorial arrays
    expect(body.categories).toHaveLength(6);
    for (const cat of body.categories) {
      expect(Array.isArray(cat.tutorials)).toBe(true);
      expect(cat.tutorials).toHaveLength(0);
      expect(cat.tutorialCount).toBe(0);
      expect(cat.watchedCount).toBe(0);
      expect(cat.completionPercent).toBe(0);
    }
  });

  it("returns 401 when no verified user id is available", async () => {
    mockGetVerifiedUserId.mockResolvedValue(undefined);
    mockTutorialFindMany.mockResolvedValue([]);
    mockTutorialViewFindMany.mockResolvedValue([]);

    const route = getRoute("/tutorials", "GET");
    const ctx = createContext({});
    const response = await route.handler(ctx);
    const { status } = await parseResponse(response);

    expect(status).toBe(401);

    // Should not query DB when unauthenticated
    expect(mockTutorialFindMany).not.toHaveBeenCalled();
    expect(mockTutorialViewFindMany).not.toHaveBeenCalled();
  });
});
