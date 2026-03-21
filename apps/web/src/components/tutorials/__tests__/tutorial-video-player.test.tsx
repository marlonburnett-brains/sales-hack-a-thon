/**
 * TDD stub tests for TutorialVideoPlayer component.
 * These tests are in RED phase — the component does not exist yet.
 * They will turn GREEN once Plan 73-02 creates the component.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock server actions to avoid "use server" boundary issues in jsdom
vi.mock("@/lib/actions/tutorial-actions", () => ({
  listTutorialsAction: vi.fn(async () => ({ overall: { completedCount: 0, totalCount: 0, completionPercent: 0 }, categories: [] })),
  updateTutorialProgressAction: vi.fn(async () => undefined),
  markTutorialWatchedAction: vi.fn(async () => undefined),
}));

// Import the component — will fail RED until Plan 02 creates it
import TutorialVideoPlayer from "@/components/tutorials/tutorial-video-player";

const BASE_PROPS = {
  tutorialId: "t-1",
  slug: "getting-started-welcome",
  title: "Welcome",
  gcsUrl: "https://storage.googleapis.com/bucket/welcome.mp4",
  durationSec: 90,
  initialWatched: false,
  initialLastPosition: 0,
  prevTutorial: null as null | { slug: string; title: string },
  nextTutorial: null as null | { slug: string; title: string },
};

describe("TutorialVideoPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a video element with src equal to gcsUrl prop", () => {
    render(<TutorialVideoPlayer {...BASE_PROPS} />);
    const video = screen.getByRole("region", { name: /tutorial video/i }) ?? document.querySelector("video");
    // Accept either a video element or a wrapper with the GCS URL accessible
    const videoEl = document.querySelector("video");
    expect(videoEl).not.toBeNull();
    expect(videoEl?.src).toBe(BASE_PROPS.gcsUrl);
  });

  it("shows Watched badge when initialWatched prop is true", () => {
    render(<TutorialVideoPlayer {...BASE_PROPS} initialWatched={true} />);
    const badge = screen.getByText(/watched/i);
    expect(badge).toBeDefined();
  });

  it("does not show Watched badge when initialWatched prop is false", () => {
    render(<TutorialVideoPlayer {...BASE_PROPS} initialWatched={false} />);
    const badge = screen.queryByText(/watched/i);
    expect(badge).toBeNull();
  });

  it("renders prev tutorial button when prevTutorial prop provided", () => {
    const prevTutorial = { slug: "prev-tutorial", title: "Previous Tutorial" };
    render(<TutorialVideoPlayer {...BASE_PROPS} prevTutorial={prevTutorial} />);
    const prevButton = screen.getByRole("link", { name: /previous tutorial/i }) ??
      screen.getByText(/previous tutorial/i);
    expect(prevButton).toBeDefined();
  });

  it("renders next tutorial button when nextTutorial prop provided", () => {
    const nextTutorial = { slug: "next-tutorial", title: "Next Tutorial" };
    render(<TutorialVideoPlayer {...BASE_PROPS} nextTutorial={nextTutorial} />);
    const nextButton = screen.getByRole("link", { name: /next tutorial/i }) ??
      screen.getByText(/next tutorial/i);
    expect(nextButton).toBeDefined();
  });
});
