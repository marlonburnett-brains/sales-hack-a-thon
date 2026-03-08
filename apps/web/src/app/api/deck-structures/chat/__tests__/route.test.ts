import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextRequest } from "next/server";

vi.mock("@/env", () => ({
  env: {
    AGENT_SERVICE_URL: "http://test-agent:4111",
    AGENT_API_KEY: "test-key",
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Phase 38 deck chat proxy route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("hello\n---STRUCTURE_UPDATE---\n{}"));
          controller.close();
        },
      }),
    });
  });

  it("rejects touch_4 requests without artifactType", async () => {
    const { POST } = await import("@/app/api/deck-structures/chat/route");
    const request = new NextRequest("http://localhost/api/deck-structures/chat", {
      method: "POST",
      body: JSON.stringify({ touchType: "touch_4", message: "Refine this" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/artifactType/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("forwards artifactType to the deployed agent chat route and preserves the stream", async () => {
    const { POST } = await import("@/app/api/deck-structures/chat/route");
    const request = new NextRequest("http://localhost/api/deck-structures/chat", {
      method: "POST",
      body: JSON.stringify({
        touchType: "touch_4",
        artifactType: "proposal",
        message: "Refine this",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const text = await response.text();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-agent:4111/deck-structures/touch_4/chat?artifactType=proposal",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ message: "Refine this" }),
      }),
    );
    expect(text).toContain("---STRUCTURE_UPDATE---");
  });

  it("keeps the proxy source aligned with the deployed agent route family", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/api/deck-structures/chat/route.ts"),
      "utf8",
    );

    expect(source).toMatch(/URLSearchParams/);
    expect(source).toMatch(/artifactType/);
    expect(source).toMatch(/\$\{env\.AGENT_SERVICE_URL\}\/deck-structures\//);
    expect(source).not.toMatch(/\$\{env\.AGENT_SERVICE_URL\}\/api\/deck-structures\//);
  });
});
