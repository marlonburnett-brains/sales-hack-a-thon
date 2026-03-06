import { describe, it, expect } from "vitest";
import {
  extractPresentationId,
  getTemplateStatus,
  SLIDES_URL_REGEX,
  TOUCH_TYPES,
  STATUS_CONFIG,
  type TemplateStatus,
} from "../template-utils";

// ---------------------------------------------------------------------------
// TMPL-05: URL validation + presentationId extraction
// ---------------------------------------------------------------------------

describe("TMPL-05: URL validation and presentationId extraction", () => {
  describe("extractPresentationId", () => {
    it("extracts presentationId from a standard Google Slides URL", () => {
      const url =
        "https://docs.google.com/presentation/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit";
      expect(extractPresentationId(url)).toBe("1aBcDeFgHiJkLmNoPqRsTuVwXyZ");
    });

    it("extracts presentationId from a URL without trailing path", () => {
      const url =
        "https://docs.google.com/presentation/d/abc123_-XYZ";
      expect(extractPresentationId(url)).toBe("abc123_-XYZ");
    });

    it("extracts presentationId from a URL with query parameters", () => {
      const url =
        "https://docs.google.com/presentation/d/myPresentationId123/edit?usp=sharing";
      expect(extractPresentationId(url)).toBe("myPresentationId123");
    });

    it("returns null for a non-Google-Slides URL", () => {
      expect(extractPresentationId("https://example.com/slides")).toBeNull();
    });

    it("returns null for a Google Docs URL (not Slides)", () => {
      expect(
        extractPresentationId(
          "https://docs.google.com/document/d/abc123/edit"
        )
      ).toBeNull();
    });

    it("returns null for an empty string", () => {
      expect(extractPresentationId("")).toBeNull();
    });

    it("returns null for a partial Google Slides URL missing the ID", () => {
      expect(
        extractPresentationId("https://docs.google.com/presentation/d/")
      ).toBeNull();
    });
  });

  describe("SLIDES_URL_REGEX", () => {
    it("matches a valid Google Slides URL", () => {
      expect(
        SLIDES_URL_REGEX.test(
          "https://docs.google.com/presentation/d/1abc_DEF-xyz/edit"
        )
      ).toBe(true);
    });

    it("rejects a URL with http instead of https", () => {
      expect(
        SLIDES_URL_REGEX.test(
          "http://docs.google.com/presentation/d/abc123/edit"
        )
      ).toBe(false);
    });

    it("rejects a completely unrelated URL", () => {
      expect(SLIDES_URL_REGEX.test("https://slides.google.com/d/abc")).toBe(
        false
      );
    });
  });
});

// ---------------------------------------------------------------------------
// TMPL-07: Staleness detection via getTemplateStatus()
// ---------------------------------------------------------------------------

describe("TMPL-07: Staleness detection via getTemplateStatus", () => {
  it("returns 'ready' when template is accessible and ingested with no source changes", () => {
    const status = getTemplateStatus({
      accessStatus: "accessible",
      lastIngestedAt: "2026-03-01T00:00:00Z",
      sourceModifiedAt: "2026-02-28T00:00:00Z",
    });
    expect(status).toBe("ready");
  });

  it("returns 'no_access' when accessStatus is not_accessible", () => {
    const status = getTemplateStatus({
      accessStatus: "not_accessible",
      lastIngestedAt: "2026-03-01T00:00:00Z",
      sourceModifiedAt: null,
    });
    expect(status).toBe("no_access");
  });

  it("returns 'not_ingested' when lastIngestedAt is null", () => {
    const status = getTemplateStatus({
      accessStatus: "accessible",
      lastIngestedAt: null,
      sourceModifiedAt: null,
    });
    expect(status).toBe("not_ingested");
  });

  it("returns 'stale' when source was modified after last ingestion", () => {
    const status = getTemplateStatus({
      accessStatus: "accessible",
      lastIngestedAt: "2026-03-01T00:00:00Z",
      sourceModifiedAt: "2026-03-05T12:00:00Z",
    });
    expect(status).toBe("stale");
  });

  it("returns 'ready' when sourceModifiedAt is null even if ingested", () => {
    const status = getTemplateStatus({
      accessStatus: "accessible",
      lastIngestedAt: "2026-03-01T00:00:00Z",
      sourceModifiedAt: null,
    });
    expect(status).toBe("ready");
  });

  it("returns 'ready' when source modified at same time as ingestion", () => {
    const ts = "2026-03-01T00:00:00Z";
    const status = getTemplateStatus({
      accessStatus: "accessible",
      lastIngestedAt: ts,
      sourceModifiedAt: ts,
    });
    expect(status).toBe("ready");
  });

  it("returns 'ingesting' when ingestionStatus is ingesting (overrides other states)", () => {
    const status = getTemplateStatus({
      accessStatus: "accessible",
      lastIngestedAt: null,
      sourceModifiedAt: null,
      ingestionStatus: "ingesting",
    });
    expect(status).toBe("ingesting");
  });

  it("returns 'queued' when ingestionStatus is queued", () => {
    const status = getTemplateStatus({
      accessStatus: "accessible",
      lastIngestedAt: "2026-03-01T00:00:00Z",
      sourceModifiedAt: null,
      ingestionStatus: "queued",
    });
    expect(status).toBe("queued");
  });

  it("returns 'failed' when ingestionStatus is failed", () => {
    const status = getTemplateStatus({
      accessStatus: "accessible",
      lastIngestedAt: "2026-03-01T00:00:00Z",
      sourceModifiedAt: null,
      ingestionStatus: "failed",
    });
    expect(status).toBe("failed");
  });

  it("ingestionStatus takes priority over no_access", () => {
    const status = getTemplateStatus({
      accessStatus: "not_accessible",
      lastIngestedAt: null,
      sourceModifiedAt: null,
      ingestionStatus: "ingesting",
    });
    expect(status).toBe("ingesting");
  });
});

// ---------------------------------------------------------------------------
// Additional coverage: TOUCH_TYPES and STATUS_CONFIG constants
// ---------------------------------------------------------------------------

describe("Template constants", () => {
  it("TOUCH_TYPES has 4 entries with value and label", () => {
    expect(TOUCH_TYPES).toHaveLength(4);
    expect(TOUCH_TYPES[0]).toEqual({ value: "touch_1", label: "Touch 1" });
    expect(TOUCH_TYPES[3]).toEqual({ value: "touch_4", label: "Touch 4+" });
  });

  it("STATUS_CONFIG covers all TemplateStatus variants", () => {
    const statuses: TemplateStatus[] = [
      "ready",
      "no_access",
      "not_ingested",
      "stale",
      "ingesting",
      "queued",
      "failed",
    ];
    for (const s of statuses) {
      expect(STATUS_CONFIG[s]).toBeDefined();
      expect(STATUS_CONFIG[s].label).toBeTruthy();
      expect(STATUS_CONFIG[s].className).toBeTruthy();
    }
  });
});
