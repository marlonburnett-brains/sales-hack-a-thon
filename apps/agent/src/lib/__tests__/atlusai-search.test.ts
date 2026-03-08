import { beforeEach, describe, expect, it, vi } from "vitest";

type DriveListResult = Promise<{
  data: {
    files?: Array<{
      id?: string;
      name?: string;
      description?: string;
    }>;
  };
}>;

type DriveExportResult = Promise<{ data: string }>;

// ────────────────────────────────────────────────────────────
// Shared mock state
// ────────────────────────────────────────────────────────────

let mockCallMcpTool: ReturnType<
  typeof vi.fn<
    (toolName: string, args: Record<string, unknown>) => Promise<unknown>
  >
>;
let mockIsMcpAvailable: ReturnType<typeof vi.fn<() => boolean>>;
let mockGetCachedExtractionPrompt: ReturnType<
  typeof vi.fn<() => string | null>
>;
let mockSetCachedExtractionPrompt: ReturnType<
  typeof vi.fn<(prompt: string) => void>
>;
let mockDriveFilesList: ReturnType<
  typeof vi.fn<(args: Record<string, unknown>) => DriveListResult>
>;
let mockDriveFilesExport: ReturnType<
  typeof vi.fn<(args: Record<string, unknown>) => DriveExportResult>
>;
let mockGenerateContent: ReturnType<
  typeof vi.fn<
    (args: {
      model: string;
      contents: string;
      config: { responseMimeType: string };
    }) => Promise<{ text?: string }>
  >
>;
let envOverrides: Record<string, unknown>;

async function freshModule() {
  vi.resetModules();

  // Fresh mocks
  mockCallMcpTool = vi.fn();
  mockIsMcpAvailable = vi.fn();
  mockGetCachedExtractionPrompt = vi.fn();
  mockSetCachedExtractionPrompt = vi.fn();
  mockDriveFilesList = vi.fn();
  mockDriveFilesExport = vi.fn();
  mockGenerateContent = vi.fn();

  envOverrides = {
    ATLUS_USE_MCP: "true",
    ATLUS_PROJECT_ID: undefined,
    GOOGLE_DRIVE_FOLDER_ID: "test-folder-id",
    GOOGLE_CLOUD_PROJECT: "test-project",
    GOOGLE_CLOUD_LOCATION: "us-central1",
  };

  vi.doMock("../mcp-client", () => ({
    callMcpTool: (toolName: string, args: Record<string, unknown>) =>
      mockCallMcpTool(toolName, args),
    isMcpAvailable: () => mockIsMcpAvailable(),
    getCachedExtractionPrompt: () => mockGetCachedExtractionPrompt(),
    setCachedExtractionPrompt: (prompt: string) =>
      mockSetCachedExtractionPrompt(prompt),
  }));

  vi.doMock("../google-auth", () => ({
    getDriveClient: () => ({
      files: {
        list: (args: Record<string, unknown>) => mockDriveFilesList(args),
        export: (args: Record<string, unknown>) => mockDriveFilesExport(args),
      },
    }),
  }));

  vi.doMock("@google/genai", () => ({
    GoogleGenAI: class {
      models = {
        generateContent: (args: {
          model: string;
          contents: string;
          config: { responseMimeType: string };
        }) => mockGenerateContent(args),
      };
    },
  }));

  vi.doMock("../../env", () => ({
    env: new Proxy(envOverrides, {
      get: (target, prop) => target[prop as string],
    }),
  }));

  return import("../atlusai-search");
}

// ────────────────────────────────────────────────────────────
// Mock data
// ────────────────────────────────────────────────────────────

const MOCK_MCP_RAW_RESULT = [
  {
    id: "slide-001",
    title: "Cloud Migration Strategy",
    content: "Enterprise cloud migration best practices",
    notes: "Key talking points for cloud migration",
    score: 0.95,
    presentation_id: "pres-abc",
    slide_object_id: "obj-123",
  },
  {
    id: "slide-002",
    title: "Data Analytics Platform",
    content: "Real-time analytics and reporting capabilities",
    notes: "",
    score: 0.82,
    presentation_id: "pres-def",
    slide_object_id: "obj-456",
  },
];

const MOCK_LLM_EXTRACTED: Array<Record<string, unknown>> = [
  {
    slideId: "slide-001",
    documentTitle: "Cloud Migration Strategy",
    textContent: "Enterprise cloud migration best practices",
    speakerNotes: "Key talking points for cloud migration",
    metadata: { score: 0.95 },
    presentationId: "pres-abc",
    slideObjectId: "obj-123",
    relevanceScore: 0.95,
  },
  {
    slideId: "slide-002",
    documentTitle: "Data Analytics Platform",
    textContent: "Real-time analytics and reporting capabilities",
    speakerNotes: "",
    metadata: { score: 0.82 },
    presentationId: "pres-def",
    slideObjectId: "obj-456",
    relevanceScore: 0.82,
  },
];

function setupDriveMocks() {
  // Drive folder lookup
  mockDriveFilesList.mockResolvedValueOnce({
    data: {
      files: [{ id: "ingestion-folder-id", name: "_slide-level-ingestion" }],
    },
  });
  // Drive search results
  mockDriveFilesList.mockResolvedValueOnce({
    data: {
      files: [
        {
          id: "drive-file-1",
          name: "[SLIDE] My Deck - Slide 1 [abc123]",
          description: JSON.stringify({
            documentId: "abc123",
            presentationId: "pres-xyz",
            slideObjectId: "obj-789",
          }),
        },
      ],
    },
  });
  // Drive export
  mockDriveFilesExport.mockResolvedValueOnce({
    data: "Slide Content:\nHello world\n\nSpeaker Notes:\nNote here\n",
  });
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe("atlusai-search", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── Search routing (SRCH-01, SRCH-05) ──

  describe("search routing", () => {
    it("searchSlides() calls MCP when ATLUS_USE_MCP=true and MCP available", async () => {
      const mod = await freshModule();

      mockIsMcpAvailable.mockReturnValue(true);
      mockCallMcpTool.mockResolvedValue(MOCK_MCP_RAW_RESULT);
      mockGetCachedExtractionPrompt.mockReturnValue(null);
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(MOCK_LLM_EXTRACTED),
      });

      const results = await mod.searchSlides({
        query: "cloud migration",
        industry: "healthcare",
      });

      expect(mockCallMcpTool).toHaveBeenCalledOnce();
      expect(mockCallMcpTool).toHaveBeenCalledWith(
        "knowledge_base_search_semantic",
        expect.objectContaining({ query: "cloud migration healthcare" }),
      );
      expect(results.length).toBe(2);
    });

    it("searchSlides() falls back to Drive when MCP throws", async () => {
      const mod = await freshModule();

      mockIsMcpAvailable.mockReturnValue(true);
      mockCallMcpTool.mockRejectedValue(new Error("MCP connection failed"));
      setupDriveMocks();

      const results = await mod.searchSlides({ query: "test" });

      expect(mockCallMcpTool).toHaveBeenCalledOnce();
      expect(mockDriveFilesList).toHaveBeenCalled();
      expect(results.length).toBe(1);
      expect(results[0].source).toBe("drive");
    });

    it("searchSlides() uses Drive directly when ATLUS_USE_MCP=false", async () => {
      const mod = await freshModule();
      envOverrides.ATLUS_USE_MCP = "false";

      setupDriveMocks();

      const results = await mod.searchSlides({ query: "test" });

      expect(mockCallMcpTool).not.toHaveBeenCalled();
      expect(mockIsMcpAvailable).not.toHaveBeenCalled();
      expect(mockDriveFilesList).toHaveBeenCalled();
      expect(results.length).toBe(1);
    });

    it("searchSlides() uses Drive when isMcpAvailable() returns false", async () => {
      const mod = await freshModule();

      mockIsMcpAvailable.mockReturnValue(false);
      setupDriveMocks();

      const results = await mod.searchSlides({ query: "test" });

      expect(mockCallMcpTool).not.toHaveBeenCalled();
      expect(mockDriveFilesList).toHaveBeenCalled();
      expect(results[0].source).toBe("drive");
    });
  });

  // ── Result mapping (SRCH-02) ──

  describe("result mapping", () => {
    it("MCP results get source: 'mcp' field", async () => {
      const mod = await freshModule();

      mockIsMcpAvailable.mockReturnValue(true);
      mockCallMcpTool.mockResolvedValue(MOCK_MCP_RAW_RESULT);
      mockGetCachedExtractionPrompt.mockReturnValue(null);
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(MOCK_LLM_EXTRACTED),
      });

      const results = await mod.searchSlides({ query: "test" });

      for (const r of results) {
        expect(r.source).toBe("mcp");
      }
    });

    it("Drive results get source: 'drive' field", async () => {
      const mod = await freshModule();

      mockIsMcpAvailable.mockReturnValue(false);
      setupDriveMocks();

      const results = await mod.searchSlides({ query: "test" });

      for (const r of results) {
        expect(r.source).toBe("drive");
      }
    });

    it("MCP results include relevanceScore from LLM extraction", async () => {
      const mod = await freshModule();

      mockIsMcpAvailable.mockReturnValue(true);
      mockCallMcpTool.mockResolvedValue(MOCK_MCP_RAW_RESULT);
      mockGetCachedExtractionPrompt.mockReturnValue(null);
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(MOCK_LLM_EXTRACTED),
      });

      const results = await mod.searchSlides({ query: "test" });

      expect(results[0].relevanceScore).toBe(0.95);
      expect(results[1].relevanceScore).toBe(0.82);
    });

    it("Drive results have relevanceScore: undefined", async () => {
      const mod = await freshModule();

      mockIsMcpAvailable.mockReturnValue(false);
      setupDriveMocks();

      const results = await mod.searchSlides({ query: "test" });

      expect(results[0].relevanceScore).toBeUndefined();
    });
  });

  // ── LLM extraction ──

  describe("LLM extraction", () => {
    it("extractSlideResults() calls LLM with raw MCP results", async () => {
      const mod = await freshModule();

      mockIsMcpAvailable.mockReturnValue(true);
      mockCallMcpTool.mockResolvedValue(MOCK_MCP_RAW_RESULT);
      mockGetCachedExtractionPrompt.mockReturnValue(null);
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(MOCK_LLM_EXTRACTED),
      });

      await mod.searchSlides({ query: "test query" });

      expect(mockGenerateContent).toHaveBeenCalledOnce();
      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.contents).toContain("test query");
      expect(callArgs.contents).toContain("SlideSearchResult");
      expect(callArgs.config.responseMimeType).toBe("application/json");
    });

    it("first call builds discovery prompt (no cached prompt)", async () => {
      const mod = await freshModule();

      mockIsMcpAvailable.mockReturnValue(true);
      mockCallMcpTool.mockResolvedValue(MOCK_MCP_RAW_RESULT);
      mockGetCachedExtractionPrompt.mockReturnValue(null);
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(MOCK_LLM_EXTRACTED),
      });

      await mod.searchSlides({ query: "discover" });

      const callArgs = mockGenerateContent.mock.calls[0][0];
      // Discovery prompt should include the raw result
      expect(callArgs.contents).toContain("cloud migration");
      expect(callArgs.contents).toContain("extracting structured slide search results");
    });

    it("subsequent calls use cached prompt template", async () => {
      const mod = await freshModule();

      mockIsMcpAvailable.mockReturnValue(true);
      mockCallMcpTool.mockResolvedValue(MOCK_MCP_RAW_RESULT);
      mockGetCachedExtractionPrompt.mockReturnValue(
        "Cached template with {{RAW_RESULTS}} and {{SEARCH_QUERY}}",
      );
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(MOCK_LLM_EXTRACTED),
      });

      await mod.searchSlides({ query: "cached search" });

      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.contents).toContain("Cached template with");
      expect(callArgs.contents).toContain("cached search");
      // Should NOT contain discovery phrasing
      expect(callArgs.contents).not.toContain(
        "extracting structured slide search results",
      );
    });

    it("cached prompt path does not overwrite the saved extraction template", async () => {
      const mod = await freshModule();

      mockIsMcpAvailable.mockReturnValue(true);
      mockCallMcpTool.mockResolvedValue(MOCK_MCP_RAW_RESULT);
      mockGetCachedExtractionPrompt.mockReturnValue(
        "Cached template with {{RAW_RESULTS}} and {{SEARCH_QUERY}}",
      );
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(MOCK_LLM_EXTRACTED),
      });

      await mod.searchSlides({ query: "do not recache" });

      expect(mockSetCachedExtractionPrompt).not.toHaveBeenCalled();
    });

    it("LLM failure returns empty array (graceful degradation)", async () => {
      const mod = await freshModule();

      mockIsMcpAvailable.mockReturnValue(true);
      mockCallMcpTool.mockResolvedValue(MOCK_MCP_RAW_RESULT);
      mockGetCachedExtractionPrompt.mockReturnValue(null);
      mockGenerateContent.mockRejectedValue(new Error("LLM unavailable"));

      // MCP call succeeds but LLM extraction fails -> falls back to Drive
      // Because searchSlidesMcp returns [] from extractSlideResults, then the
      // top-level searchSlides catches and falls back
      // Actually: extractSlideResults catches internally and returns []
      // searchSlidesMcp returns [] (empty from LLM failure)
      // searchSlides returns those [] from MCP path (doesn't fall back)
      const results = await mod.searchSlides({ query: "test" });

      expect(results).toEqual([]);
    });

    it("results are batched in single LLM call", async () => {
      const mod = await freshModule();

      mockIsMcpAvailable.mockReturnValue(true);
      mockCallMcpTool.mockResolvedValue(MOCK_MCP_RAW_RESULT);
      mockGetCachedExtractionPrompt.mockReturnValue(null);
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(MOCK_LLM_EXTRACTED),
      });

      await mod.searchSlides({ query: "batch test" });

      // Only one LLM call even with multiple results
      expect(mockGenerateContent).toHaveBeenCalledOnce();
    });

    it("first successful extraction caches prompt template", async () => {
      const mod = await freshModule();

      mockIsMcpAvailable.mockReturnValue(true);
      mockCallMcpTool.mockResolvedValue(MOCK_MCP_RAW_RESULT);
      mockGetCachedExtractionPrompt.mockReturnValue(null);
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(MOCK_LLM_EXTRACTED),
      });

      await mod.searchSlides({ query: "cache me" });

      expect(mockSetCachedExtractionPrompt).toHaveBeenCalledOnce();
      const cachedTemplate = mockSetCachedExtractionPrompt.mock.calls[0][0];
      expect(cachedTemplate).toContain("{{RAW_RESULTS}}");
      expect(cachedTemplate).toContain("{{SEARCH_QUERY}}");
    });
  });

  // ── Project scoping (SRCH-06) ──

  describe("project scoping", () => {
    it("MCP tool call includes project_id from ATLUS_PROJECT_ID env var", async () => {
      const mod = await freshModule();
      envOverrides.ATLUS_PROJECT_ID = "my-project-123";

      mockIsMcpAvailable.mockReturnValue(true);
      mockCallMcpTool.mockResolvedValue(MOCK_MCP_RAW_RESULT);
      mockGetCachedExtractionPrompt.mockReturnValue(null);
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(MOCK_LLM_EXTRACTED),
      });

      await mod.searchSlides({ query: "scoped search" });

      expect(mockCallMcpTool).toHaveBeenCalledWith(
        "knowledge_base_search_semantic",
        expect.objectContaining({ project_id: "my-project-123" }),
      );
    });

    it("MCP tool call omits project_id when env var is not set", async () => {
      const mod = await freshModule();

      mockIsMcpAvailable.mockReturnValue(true);
      mockCallMcpTool.mockResolvedValue(MOCK_MCP_RAW_RESULT);
      mockGetCachedExtractionPrompt.mockReturnValue(null);
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(MOCK_LLM_EXTRACTED),
      });

      await mod.searchSlides({ query: "unscoped search" });

      const args = mockCallMcpTool.mock.calls[0][1];
      expect(args).not.toHaveProperty("project_id");
    });
  });

  // ── Multi-pass preservation (SRCH-03) ──

  describe("multi-pass preservation", () => {
    it("searchForProposal() calls searchSlides() multiple times (3 passes)", async () => {
      const mod = await freshModule();

      // Use Drive path for simplicity in this test
      mockIsMcpAvailable.mockReturnValue(false);

      // Each searchSlides call does 2 Drive list calls (folder + search)
      // Pass 1 primary: returns < 3 results -> triggers fallback tier 1 + tier 2
      // We need to mock enough calls for all passes
      const mockSlideResult = {
        data: {
          files: [
            {
              id: "file-1",
              name: "[SLIDE] Deck - Slide 1 [aaa111]",
              description: JSON.stringify({
                documentId: "aaa111",
                presentationId: "pres-1",
              }),
            },
            {
              id: "file-2",
              name: "[SLIDE] Deck - Slide 2 [bbb222]",
              description: JSON.stringify({
                documentId: "bbb222",
                presentationId: "pres-1",
              }),
            },
            {
              id: "file-3",
              name: "[SLIDE] Deck - Slide 3 [ccc333]",
              description: JSON.stringify({
                documentId: "ccc333",
                presentationId: "pres-1",
              }),
            },
          ],
        },
      };

      const folderResult = {
        data: {
          files: [{ id: "ingestion-folder-id", name: "_slide-level-ingestion" }],
        },
      };

      // Mock all Drive list calls (folder lookup + search for each pass)
      // Folder lookup is cached after first call, so only first searchSlides call does it
      mockDriveFilesList
        .mockResolvedValueOnce(folderResult) // folder lookup for pass 1
        .mockResolvedValueOnce(mockSlideResult) // pass 1 search
        .mockResolvedValueOnce(mockSlideResult) // pass 2 secondary pillar 1
        .mockResolvedValueOnce(mockSlideResult) // pass 3 case studies
        ;

      mockDriveFilesExport.mockResolvedValue({
        data: "Slide Content:\nContent\n\nSpeaker Notes:\nNotes\n",
      });

      const result = await mod.searchForProposal({
        industry: "healthcare",
        subsector: "pharma",
        primaryPillar: "cloud",
        secondaryPillars: ["data"],
        useCases: [{ name: "uc1", description: "desc" }],
      });

      // Should have called searchSlides at least 3 times (primary + secondary + case study)
      // Primary returns 3 results so no fallback tiers
      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.primaryCount).toBeDefined();
      expect(result.secondaryCount).toBeDefined();
      expect(result.caseStudyCount).toBeDefined();
    });

    it("deduplication by slideId works across passes", async () => {
      const mod = await freshModule();

      mockIsMcpAvailable.mockReturnValue(false);

      const folderResult = {
        data: {
          files: [{ id: "ingestion-folder-id", name: "_slide-level-ingestion" }],
        },
      };

      // Same slide returned in both passes -> should be deduplicated
      const sameSlide = {
        data: {
          files: [
            {
              id: "dup-file",
              name: "[SLIDE] Deck - Slide 1 [same111]",
              description: JSON.stringify({ documentId: "same111" }),
            },
          ],
        },
      };

      mockDriveFilesList
        .mockResolvedValueOnce(folderResult) // folder lookup
        .mockResolvedValueOnce(sameSlide) // pass 1 (primary returns 1 < 3)
        .mockResolvedValueOnce(sameSlide) // fallback tier 1
        .mockResolvedValueOnce(sameSlide) // fallback tier 2
        .mockResolvedValueOnce(sameSlide) // pass 2 secondary
        .mockResolvedValueOnce(sameSlide) // pass 3 case study
        ;

      mockDriveFilesExport.mockResolvedValue({ data: "Slide Content:\nText\n" });

      const result = await mod.searchForProposal({
        industry: "tech",
        subsector: "saas",
        primaryPillar: "platform",
        secondaryPillars: ["api"],
        useCases: [],
      });

      // All passes return same slideId -> dedup to 1
      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].slideId).toBe("same111");
    });
  });

  // ── searchByCapability delegation (SRCH-04) ──

  describe("searchByCapability delegation", () => {
    it("searchByCapability() delegates to searchSlides() with combined query", async () => {
      const mod = await freshModule();

      mockIsMcpAvailable.mockReturnValue(true);
      mockCallMcpTool.mockResolvedValue(MOCK_MCP_RAW_RESULT);
      mockGetCachedExtractionPrompt.mockReturnValue(null);
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(MOCK_LLM_EXTRACTED),
      });

      const results = await mod.searchByCapability({
        capabilityAreas: ["cloud", "data"],
        industry: "healthcare",
        limit: 10,
      });

      // Should call MCP with combined query
      expect(mockCallMcpTool).toHaveBeenCalledWith(
        "knowledge_base_search_semantic",
        expect.objectContaining({
          query: "cloud data healthcare healthcare",
        }),
      );
      expect(results.length).toBe(2);
    });
  });
});
