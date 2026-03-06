import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ActionRequiredItem } from "@/lib/api-client";

// Mock server actions
const mockResolveActionAction = vi.fn();
const mockSilenceActionAction = vi.fn();
const mockSubmitAtlusCredentialsAction = vi.fn();
vi.mock("@/lib/actions/action-required-actions", () => ({
  resolveActionAction: (...args: unknown[]) => mockResolveActionAction(...args),
  silenceActionAction: (...args: unknown[]) => mockSilenceActionAction(...args),
  submitAtlusCredentialsAction: (...args: unknown[]) => mockSubmitAtlusCredentialsAction(...args),
}));

import { ActionsClient } from "../actions-client";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeAction(overrides: Partial<ActionRequiredItem> = {}): ActionRequiredItem {
  return {
    id: "action-1",
    userId: "user-1",
    actionType: "reauth_needed",
    title: "Re-authentication needed",
    description: "Your token has expired. Please log in again.",
    resourceId: null,
    resourceName: null,
    resolved: false,
    resolvedAt: null,
    silenced: false,
    seenAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("UI-actions-page: Action Required page renders action cards", () => {
  it("renders empty state when no actions are provided", () => {
    render(<ActionsClient userId="test-user" email="test@example.com" initialActions={[]} />);

    expect(screen.getByText("No actions required")).toBeInTheDocument();
    expect(screen.getByText(/All issues have been resolved/)).toBeInTheDocument();
  });

  it("renders action card with title and description", () => {
    const action = makeAction({
      title: "Re-auth needed for alice@test.com",
      description: "Token expired, please re-login.",
    });
    render(<ActionsClient userId="test-user" email="test@example.com" initialActions={[action]} />);

    expect(screen.getByText("Re-auth needed for alice@test.com")).toBeInTheDocument();
    expect(screen.getByText("Token expired, please re-login.")).toBeInTheDocument();
  });

  it("renders type-specific icon for reauth_needed (AlertTriangle)", () => {
    const action = makeAction({ actionType: "reauth_needed" });
    render(<ActionsClient userId="test-user" email="test@example.com" initialActions={[action]} />);

    // AlertTriangle renders with text-red-500 class
    const icon = document.querySelector(".text-red-500");
    expect(icon).toBeTruthy();
  });

  it("renders type-specific icon for share_with_sa (Share2 amber)", () => {
    const action = makeAction({
      actionType: "share_with_sa",
      title: "Share template with service account",
    });
    render(<ActionsClient userId="test-user" email="test@example.com" initialActions={[action]} />);

    const icon = document.querySelector(".text-amber-500");
    expect(icon).toBeTruthy();
  });

  it("renders type-specific icon for drive_access (FolderOpen blue)", () => {
    const action = makeAction({
      actionType: "drive_access",
      title: "Drive access required",
    });
    render(<ActionsClient userId="test-user" email="test@example.com" initialActions={[action]} />);

    const icon = document.querySelector(".text-blue-500");
    expect(icon).toBeTruthy();
  });

  it("renders resource name when present", () => {
    const action = makeAction({ resourceName: "Q4 Pitch Deck" });
    render(<ActionsClient userId="test-user" email="test@example.com" initialActions={[action]} />);

    expect(screen.getByText(/Q4 Pitch Deck/)).toBeInTheDocument();
  });

  it("renders dismiss button for each action", () => {
    const action = makeAction({ title: "Re-auth needed" });
    render(<ActionsClient userId="test-user" email="test@example.com" initialActions={[action]} />);

    expect(screen.getByRole("button", { name: /dismiss/i })).toBeInTheDocument();
  });

  it("dismiss button calls resolveActionAction and optimistically removes card", async () => {
    mockResolveActionAction.mockResolvedValue({});
    const action = makeAction({ id: "act-xyz", title: "Fix this" });
    render(<ActionsClient userId="test-user" email="test@example.com" initialActions={[action]} />);

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    // Card should be optimistically removed
    await waitFor(() => {
      expect(screen.queryByText("Fix this")).not.toBeInTheDocument();
    });
    expect(screen.getByText("No actions required")).toBeInTheDocument();
  });

  it("renders count badge in header when actions exist", () => {
    const actions = [
      makeAction({ id: "a1", title: "Action 1" }),
      makeAction({ id: "a2", title: "Action 2" }),
    ];
    render(<ActionsClient userId="test-user" email="test@example.com" initialActions={actions} />);

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Action Required")).toBeInTheDocument();
  });

  it("does not render count badge when no actions", () => {
    render(<ActionsClient userId="test-user" email="test@example.com" initialActions={[]} />);

    // Only the heading, no badge
    expect(screen.getByText("Action Required")).toBeInTheDocument();
    // The badge with a count number should not exist
    const badges = document.querySelectorAll(".bg-red-500");
    expect(badges.length).toBe(0);
  });
});
