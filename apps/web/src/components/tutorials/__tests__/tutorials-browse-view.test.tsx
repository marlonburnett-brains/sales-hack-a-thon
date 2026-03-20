import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TutorialBrowseResponse } from "@/lib/api-client";

// Mock next/image to render a plain <img>
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    ...props
  }: {
    src: string;
    alt: string;
    [key: string]: unknown;
  }) => <img src={src} alt={alt} {...props} />,
}));

// Mock next/link to render a plain <a>
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { TutorialsBrowseView } from "../tutorials-browse-view";

// ──────────────────────────────────────────────────────────
// Fixture helpers
// ──────────────────────────────────────────────────────────

function makeTutorial(
  overrides: Partial<TutorialBrowseResponse["categories"][0]["tutorials"][0]> = {},
) {
  return {
    id: "t1",
    slug: "getting-started",
    title: "Getting Started",
    description: "Learn the basics",
    durationSec: 180,
    thumbnailUrl: null,
    watched: false,
    ...overrides,
  };
}

function makeCategory(
  overrides: Partial<TutorialBrowseResponse["categories"][0]> = {},
) {
  return {
    key: "getting_started",
    label: "Getting Started",
    tutorialCount: 1,
    watchedCount: 0,
    completionPercent: 0,
    tutorials: [makeTutorial()],
    ...overrides,
  };
}

function makeBrowseData(
  overrides: Partial<TutorialBrowseResponse> = {},
): TutorialBrowseResponse {
  return {
    overall: { completedCount: 0, totalCount: 17, completionPercent: 0 },
    categories: [makeCategory()],
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────
// Test 1: Category sections
// ──────────────────────────────────────────────────────────

describe("TutorialsBrowseView – category sections", () => {
  it("renders a section with icon, X of Y copy, and a progress bar", () => {
    const data = makeBrowseData({
      categories: [
        makeCategory({
          key: "getting_started",
          label: "Getting Started",
          tutorialCount: 3,
          watchedCount: 1,
          completionPercent: 33,
        }),
      ],
    });

    render(<TutorialsBrowseView data={data} />);

    // Category heading visible
    expect(
      screen.getByRole("heading", { name: /getting started/i }),
    ).toBeInTheDocument();

    // X of Y progress copy
    expect(screen.getByText(/1 of 3/i)).toBeInTheDocument();

    // Progress bar elements (one in header, one in category section)
    const progressBars = screen.getAllByRole("progressbar");
    expect(progressBars.length).toBeGreaterThanOrEqual(1);
  });

  it("shows a completed accent when the category is 100% complete", () => {
    const data = makeBrowseData({
      categories: [
        makeCategory({
          tutorialCount: 2,
          watchedCount: 2,
          completionPercent: 100,
          tutorials: [
            makeTutorial({ id: "t1", watched: true }),
            makeTutorial({ id: "t2", slug: "advanced", title: "Advanced", watched: true }),
          ],
        }),
      ],
    });

    render(<TutorialsBrowseView data={data} />);

    // When 100% complete the category shows "Complete!" in the X of Y text
    expect(screen.getByText(/complete!/i)).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────
// Test 2: Tutorial cards
// ──────────────────────────────────────────────────────────

describe("TutorialsBrowseView – tutorial cards", () => {
  it("renders title, description, and human-readable duration", () => {
    const data = makeBrowseData({
      categories: [
        makeCategory({
          tutorials: [
            makeTutorial({ title: "My Tutorial", description: "Great content", durationSec: 125 }),
          ],
        }),
      ],
    });

    render(<TutorialsBrowseView data={data} />);

    expect(screen.getByText("My Tutorial")).toBeInTheDocument();
    expect(screen.getByText("Great content")).toBeInTheDocument();
    // 125s = 2:05
    expect(screen.getByText("2:05")).toBeInTheDocument();
  });

  it("does NOT render a watched checkmark when the tutorial is unwatched", () => {
    const data = makeBrowseData({
      categories: [makeCategory({ tutorials: [makeTutorial({ watched: false })] })],
    });

    render(<TutorialsBrowseView data={data} />);

    expect(screen.queryByTestId("watched-checkmark")).not.toBeInTheDocument();
  });

  it("renders a watched checkmark when the tutorial is watched", () => {
    const data = makeBrowseData({
      categories: [makeCategory({ tutorials: [makeTutorial({ watched: true })] })],
    });

    render(<TutorialsBrowseView data={data} />);

    expect(screen.getByTestId("watched-checkmark")).toBeInTheDocument();
  });

  it("renders next/image when thumbnailUrl is provided", () => {
    const data = makeBrowseData({
      categories: [
        makeCategory({
          tutorials: [
            makeTutorial({ thumbnailUrl: "https://example.com/thumb.jpg" }),
          ],
        }),
      ],
    });

    render(<TutorialsBrowseView data={data} />);

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/thumb.jpg");
  });

  it("renders a fallback thumbnail shell when thumbnailUrl is null", () => {
    const data = makeBrowseData({
      categories: [makeCategory({ tutorials: [makeTutorial({ thumbnailUrl: null })] })],
    });

    render(<TutorialsBrowseView data={data} />);

    expect(screen.getByTestId("thumbnail-fallback")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders a link to /tutorials/[slug]", () => {
    const data = makeBrowseData({
      categories: [
        makeCategory({
          tutorials: [makeTutorial({ slug: "my-tutorial-slug" })],
        }),
      ],
    });

    render(<TutorialsBrowseView data={data} />);

    const links = screen.getAllByRole("link");
    const cardLink = links.find((l) =>
      l.getAttribute("href")?.includes("my-tutorial-slug"),
    );
    expect(cardLink).toBeTruthy();
  });
});

// ──────────────────────────────────────────────────────────
// Test 3: Page header
// ──────────────────────────────────────────────────────────

describe("TutorialsBrowseView – page header", () => {
  it("renders overall progress copy when not fully complete", () => {
    const data = makeBrowseData({
      overall: { completedCount: 5, totalCount: 17, completionPercent: 29 },
    });

    render(<TutorialsBrowseView data={data} />);

    expect(screen.getByText(/5 of 17 completed/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/all 17 tutorials completed/i),
    ).not.toBeInTheDocument();
  });

  it("renders the all-complete state when completedCount === totalCount", () => {
    const data = makeBrowseData({
      overall: { completedCount: 17, totalCount: 17, completionPercent: 100 },
    });

    render(<TutorialsBrowseView data={data} />);

    expect(
      screen.getByText(/all 17 tutorials completed/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/17 of 17 completed/i)).not.toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────
// Test 4: Empty state
// ──────────────────────────────────────────────────────────

describe("TutorialsBrowseView – empty state", () => {
  it("renders an empty state message when there are no categories", () => {
    const data: TutorialBrowseResponse = {
      overall: { completedCount: 0, totalCount: 0, completionPercent: 0 },
      categories: [],
    };

    render(<TutorialsBrowseView data={data} />);

    expect(
      screen.getByText(/no tutorials available/i),
    ).toBeInTheDocument();
  });
});
