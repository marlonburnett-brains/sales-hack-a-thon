import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock "server-only" to avoid import errors in test env
vi.mock("server-only", () => ({}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock api-client functions
const mockCreateTemplate = vi.fn();
const mockListTemplates = vi.fn();
const mockDeleteTemplate = vi.fn();
const mockCheckTemplateStaleness = vi.fn();
const mockTriggerIngestion = vi.fn();
const mockGetIngestionProgress = vi.fn();

vi.mock("@/lib/api-client", () => ({
  createTemplate: (...args: unknown[]) => mockCreateTemplate(...args),
  listTemplates: (...args: unknown[]) => mockListTemplates(...args),
  deleteTemplate: (...args: unknown[]) => mockDeleteTemplate(...args),
  checkTemplateStaleness: (...args: unknown[]) => mockCheckTemplateStaleness(...args),
  triggerIngestion: (...args: unknown[]) => mockTriggerIngestion(...args),
  getIngestionProgress: (...args: unknown[]) => mockGetIngestionProgress(...args),
}));

// ---------------------------------------------------------------------------
// TMPL-06: Server actions layer testing (validates the action->api-client wiring)
// ---------------------------------------------------------------------------

describe("TMPL-06: Template server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listTemplatesAction calls listTemplates api-client", async () => {
    const templates = [{ id: "t1", name: "Test" }];
    mockListTemplates.mockResolvedValue(templates);

    const { listTemplatesAction } = await import(
      "@/lib/actions/template-actions"
    );
    const result = await listTemplatesAction();

    expect(mockListTemplates).toHaveBeenCalled();
    expect(result).toEqual(templates);
  });

  it("createTemplateAction calls createTemplate and revalidates path", async () => {
    const createResult = {
      template: { id: "t1", accessStatus: "accessible" },
      serviceAccountEmail: null,
    };
    mockCreateTemplate.mockResolvedValue(createResult);

    const { createTemplateAction } = await import(
      "@/lib/actions/template-actions"
    );
    const { revalidatePath } = await import("next/cache");

    const data = {
      name: "Deck",
      googleSlidesUrl: "https://docs.google.com/presentation/d/abc/edit",
      presentationId: "abc",
      touchTypes: ["touch_1"],
    };
    const result = await createTemplateAction(data);

    expect(mockCreateTemplate).toHaveBeenCalledWith(data);
    expect(revalidatePath).toHaveBeenCalledWith("/templates");
    expect(result).toEqual(createResult);
  });

  it("createTemplateAction returns serviceAccountEmail when file not shared", async () => {
    const createResult = {
      template: { id: "t1", accessStatus: "not_accessible" },
      serviceAccountEmail: "sa@project.iam.gserviceaccount.com",
    };
    mockCreateTemplate.mockResolvedValue(createResult);

    const { createTemplateAction } = await import(
      "@/lib/actions/template-actions"
    );
    const result = await createTemplateAction({
      name: "Deck",
      googleSlidesUrl: "https://docs.google.com/presentation/d/abc/edit",
      presentationId: "abc",
      touchTypes: ["touch_1"],
    });

    expect(result.serviceAccountEmail).toBe(
      "sa@project.iam.gserviceaccount.com"
    );
  });

  it("deleteTemplateAction calls deleteTemplate and revalidates path", async () => {
    mockDeleteTemplate.mockResolvedValue({ success: true });

    const { deleteTemplateAction } = await import(
      "@/lib/actions/template-actions"
    );
    const { revalidatePath } = await import("next/cache");

    const result = await deleteTemplateAction("t1");

    expect(mockDeleteTemplate).toHaveBeenCalledWith("t1");
    expect(revalidatePath).toHaveBeenCalledWith("/templates");
    expect(result).toEqual({ success: true });
  });

  it("checkStalenessAction calls checkTemplateStaleness", async () => {
    const stalenessResult = { isStale: true, modifiedTime: "2026-03-05" };
    mockCheckTemplateStaleness.mockResolvedValue(stalenessResult);

    const { checkStalenessAction } = await import(
      "@/lib/actions/template-actions"
    );
    const result = await checkStalenessAction("t1");

    expect(mockCheckTemplateStaleness).toHaveBeenCalledWith("t1");
    expect(result).toEqual(stalenessResult);
  });
});
