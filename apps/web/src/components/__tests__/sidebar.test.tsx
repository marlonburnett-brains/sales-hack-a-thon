import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Use vi.hoisted so the state object exists before hoisted vi.mock factories run
const state = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => {
    return React.createElement("a", { href, ...props }, children);
  },
}));

vi.mock("@/components/atlusdeck-logo", () => ({
  AtlusDeckLogo: (props: Record<string, unknown>) =>
    React.createElement("svg", { "data-testid": "atlusdeck-logo", ...props }),
}));

vi.mock("@/components/user-nav", () => ({
  UserNav: ({ user, collapsed }: { user: { name: string; email: string }; collapsed?: boolean }) => (
    <div data-testid="user-nav">
      {user.name}
      {!collapsed && <span data-testid="user-info">{user.name} {user.email}</span>}
    </div>
  ),
}));

import { Sidebar } from "../sidebar";

const mockUser = { name: "Test User", email: "test@example.com", avatarUrl: "" };

function getDesktopSidebar() {
  return document.querySelectorAll("aside")[0]!;
}

// ---------------------------------------------------------------------------
// NAV-01: Navigate between Deals and Templates via persistent side panel
// ---------------------------------------------------------------------------

describe("NAV-01: Navigate between Deals and Templates", () => {
  beforeEach(() => {
    localStorage.clear();
    state.pathname = "/";
  });

  it("renders Deals and Templates nav links in desktop sidebar", () => {
    state.pathname = "/deals";
    render(<Sidebar user={mockUser}>Content</Sidebar>);

    const desktop = getDesktopSidebar();
    expect(desktop.querySelector("a[href='/deals']")).toBeTruthy();
    expect(desktop.querySelector("a[href='/templates']")).toBeTruthy();
  });

  it("renders Slide Library nav link", () => {
    state.pathname = "/deals";
    render(<Sidebar user={mockUser}>Content</Sidebar>);

    const desktop = getDesktopSidebar();
    expect(desktop.querySelector("a[href='/slides']")).toBeTruthy();
  });

  it("highlights Deals link when on /deals path", () => {
    state.pathname = "/deals";
    render(<Sidebar user={mockUser}>Content</Sidebar>);

    const desktop = getDesktopSidebar();
    const dealsLink = desktop.querySelector("a[href='/deals']")!;
    expect(dealsLink.className).toContain("bg-slate-100");
    expect(dealsLink.className).toContain("font-medium");
  });

  it("highlights Templates link when on /templates path", () => {
    state.pathname = "/templates";
    render(<Sidebar user={mockUser}>Content</Sidebar>);

    const desktop = getDesktopSidebar();
    const templatesLink = desktop.querySelector("a[href='/templates']")!;
    expect(templatesLink.className).toContain("bg-slate-100");
    expect(templatesLink.className).toContain("font-medium");
  });

  it("does not highlight inactive links", () => {
    state.pathname = "/deals";
    render(<Sidebar user={mockUser}>Content</Sidebar>);

    const desktop = getDesktopSidebar();
    const templatesLink = desktop.querySelector("a[href='/templates']")!;
    expect(templatesLink.className).not.toContain("bg-slate-100");
    expect(templatesLink.className).toContain("text-slate-600");
  });

  it("renders children content in main area", () => {
    state.pathname = "/deals";
    render(
      <Sidebar user={mockUser}>
        <div data-testid="page-content">Page</div>
      </Sidebar>
    );

    expect(screen.getByTestId("page-content")).toBeInTheDocument();
  });

  it("renders UserNav component", () => {
    state.pathname = "/deals";
    render(<Sidebar user={mockUser}>Content</Sidebar>);

    expect(screen.getAllByTestId("user-nav").length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// NAV-02: Collapsible sidebar with localStorage persistence
// ---------------------------------------------------------------------------

describe("NAV-02: Collapsible sidebar with localStorage persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    state.pathname = "/deals";
  });

  it("starts expanded by default (shows text labels)", () => {
    render(<Sidebar user={mockUser}>Content</Sidebar>);

    const desktop = getDesktopSidebar();
    expect(desktop.className).toContain("w-[240px]");
  });

  it("collapses when toggle button is clicked", () => {
    render(<Sidebar user={mockUser}>Content</Sidebar>);

    const desktop = getDesktopSidebar();
    const collapseBtn = desktop.querySelector(
      'button[aria-label="Collapse sidebar"]'
    ) as HTMLElement;
    fireEvent.click(collapseBtn);

    expect(desktop.className).toContain("w-[60px]");
  });

  it("persists collapsed state to localStorage", () => {
    render(<Sidebar user={mockUser}>Content</Sidebar>);

    const desktop = getDesktopSidebar();
    const collapseBtn = desktop.querySelector(
      'button[aria-label="Collapse sidebar"]'
    ) as HTMLElement;
    fireEvent.click(collapseBtn);

    expect(localStorage.getItem("sidebar-collapsed")).toBe("true");
  });

  it("restores collapsed state from localStorage on mount", () => {
    localStorage.setItem("sidebar-collapsed", "true");
    render(<Sidebar user={mockUser}>Content</Sidebar>);

    const desktop = getDesktopSidebar();
    expect(desktop.className).toContain("w-[60px]");
  });

  it("expands when clicking toggle while collapsed", () => {
    render(<Sidebar user={mockUser}>Content</Sidebar>);

    const desktop = getDesktopSidebar();

    const collapseBtn = desktop.querySelector(
      'button[aria-label="Collapse sidebar"]'
    ) as HTMLElement;
    fireEvent.click(collapseBtn);
    expect(desktop.className).toContain("w-[60px]");

    const expandBtn = desktop.querySelector(
      'button[aria-label="Expand sidebar"]'
    ) as HTMLElement;
    fireEvent.click(expandBtn);

    expect(desktop.className).toContain("w-[240px]");
    expect(localStorage.getItem("sidebar-collapsed")).toBe("false");
  });

  it("shows mobile hamburger button", () => {
    render(<Sidebar user={mockUser}>Content</Sidebar>);

    expect(screen.getByLabelText("Open navigation")).toBeInTheDocument();
  });

  it("opens mobile drawer when hamburger is clicked", () => {
    render(<Sidebar user={mockUser}>Content</Sidebar>);

    const hamburger = screen.getByLabelText("Open navigation");
    fireEvent.click(hamburger);

    expect(screen.getByLabelText("Close navigation")).toBeInTheDocument();
  });

  it("shows Collapse text label when sidebar is expanded", () => {
    render(<Sidebar user={mockUser}>Content</Sidebar>);

    const desktop = getDesktopSidebar();
    const collapseBtn = desktop.querySelector(
      'button[aria-label="Collapse sidebar"]'
    ) as HTMLElement;
    expect(collapseBtn.textContent).toContain("Collapse");
  });

  it("hides Collapse text when sidebar is collapsed", () => {
    localStorage.setItem("sidebar-collapsed", "true");
    render(<Sidebar user={mockUser}>Content</Sidebar>);

    const desktop = getDesktopSidebar();
    const expandBtn = desktop.querySelector(
      'button[aria-label="Expand sidebar"]'
    ) as HTMLElement;
    expect(expandBtn.textContent).not.toContain("Collapse");
    expect(expandBtn.getAttribute("title")).toBe("Expand");
  });

  it("shows user info inline when sidebar is expanded", () => {
    render(<Sidebar user={mockUser}>Content</Sidebar>);

    const desktop = getDesktopSidebar();
    const userInfo = desktop.querySelector('[data-testid="user-info"]');
    expect(userInfo).toBeTruthy();
  });

  it("hides user info when sidebar is collapsed", () => {
    localStorage.setItem("sidebar-collapsed", "true");
    render(<Sidebar user={mockUser}>Content</Sidebar>);

    const desktop = getDesktopSidebar();
    const userInfo = desktop.querySelector('[data-testid="user-info"]');
    expect(userInfo).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// UI-sidebar-badge: Action Required nav item with badge count
// ---------------------------------------------------------------------------

describe("UI-sidebar-badge: Action Required nav with badge count", () => {
  beforeEach(() => {
    localStorage.clear();
    state.pathname = "/deals";
    // Reset fetch mock
    vi.restoreAllMocks();
  });

  it("renders Action Required nav link in sidebar", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ count: 0 })))
    );
    render(<Sidebar user={mockUser}>Content</Sidebar>);

    const desktop = getDesktopSidebar();
    expect(desktop.querySelector("a[href='/actions']")).toBeTruthy();
  });

  it("shows badge with pending count when actions exist", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("/api/actions/count")) {
        return Promise.resolve(new Response(JSON.stringify({ count: 5 })));
      }
      return Promise.resolve(new Response(JSON.stringify({ count: 0 })));
    });
    render(<Sidebar user={mockUser}>Content</Sidebar>);

    // Wait for useEffect fetch to resolve and badge to appear
    // Both desktop and mobile sidebars render the badge, so use getAllBy
    const badges = await screen.findAllByText("5");
    expect(badges.length).toBeGreaterThan(0);
    expect(badges[0].className).toContain("bg-red-500");
  });

  it("does not show badge when count is 0", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ count: 0 })))
    );
    render(<Sidebar user={mockUser}>Content</Sidebar>);

    // Give the useEffect a tick to complete
    await new Promise((r) => setTimeout(r, 50));

    // No red badge should be present
    const desktop = getDesktopSidebar();
    const badges = desktop.querySelectorAll(".bg-red-500");
    expect(badges.length).toBe(0);
  });

  it("fetches count from /api/actions/count on mount", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("/api/actions/count")) {
        return Promise.resolve(new Response(JSON.stringify({ count: 3 })));
      }
      return Promise.resolve(new Response(JSON.stringify({ count: 0 })));
    });
    render(<Sidebar user={mockUser}>Content</Sidebar>);

    // Both desktop and mobile sidebars render, use findAllByText
    await screen.findAllByText("3");

    expect(fetchSpy).toHaveBeenCalledWith("/api/actions/count");
  });

  it("shows red dot indicator when sidebar is collapsed and count > 0", async () => {
    localStorage.setItem("sidebar-collapsed", "true");
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("/api/actions/count")) {
        return Promise.resolve(new Response(JSON.stringify({ count: 2 })));
      }
      return Promise.resolve(new Response(JSON.stringify({ count: 0 })));
    });
    render(<Sidebar user={mockUser}>Content</Sidebar>);

    // Wait for fetch
    await new Promise((r) => setTimeout(r, 50));

    const desktop = getDesktopSidebar();
    // In collapsed mode, the red dot is a small 2x2 circle
    const redDot = desktop.querySelector(".h-2.w-2.bg-red-500");
    expect(redDot).toBeTruthy();
  });

  it("silently handles fetch failure without breaking sidebar", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    render(<Sidebar user={mockUser}>Content</Sidebar>);

    // Give the useEffect a tick to complete
    await new Promise((r) => setTimeout(r, 50));

    // Sidebar should still render normally
    const desktop = getDesktopSidebar();
    expect(desktop.querySelector("a[href='/actions']")).toBeTruthy();
    expect(desktop.querySelector("a[href='/deals']")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// BROWSE-01: Tutorials nav item with "New" badge for unwatched content
// ---------------------------------------------------------------------------

describe("BROWSE-01: Tutorials nav item with unwatched badge", () => {
  beforeEach(() => {
    localStorage.clear();
    state.pathname = "/deals";
    vi.restoreAllMocks();
  });

  it("renders Tutorials nav link in sidebar", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ count: 0 })))
    );
    render(<Sidebar user={mockUser}>Content</Sidebar>);
    const desktop = getDesktopSidebar();
    expect(desktop.querySelector("a[href='/tutorials']")).toBeTruthy();
  });

  it("shows blue 'New' pill in expanded sidebar when unwatchedCount > 0", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("/api/tutorials/unwatched-count")) {
        return Promise.resolve(new Response(JSON.stringify({ count: 3 })));
      }
      return Promise.resolve(new Response(JSON.stringify({ count: 0 })));
    });
    render(<Sidebar user={mockUser}>Content</Sidebar>);
    const badges = await screen.findAllByText("New");
    expect(badges.length).toBeGreaterThan(0);
    expect(badges[0].className).toContain("bg-blue-500");
  });

  it("does not show blue pill when unwatchedCount is 0", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ count: 0 })))
    );
    render(<Sidebar user={mockUser}>Content</Sidebar>);
    await new Promise((r) => setTimeout(r, 50));
    const desktop = getDesktopSidebar();
    expect(desktop.querySelectorAll(".bg-blue-500").length).toBe(0);
  });

  it("shows blue dot in collapsed sidebar when unwatchedCount > 0", async () => {
    localStorage.setItem("sidebar-collapsed", "true");
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("/api/tutorials/unwatched-count")) {
        return Promise.resolve(new Response(JSON.stringify({ count: 2 })));
      }
      return Promise.resolve(new Response(JSON.stringify({ count: 0 })));
    });
    render(<Sidebar user={mockUser}>Content</Sidebar>);
    await new Promise((r) => setTimeout(r, 50));
    const desktop = getDesktopSidebar();
    const blueDot = desktop.querySelector(".h-2.w-2.bg-blue-500");
    expect(blueDot).toBeTruthy();
  });

  it("fetches /api/tutorials/unwatched-count on mount", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ count: 0 })))
    );
    render(<Sidebar user={mockUser}>Content</Sidebar>);
    await new Promise((r) => setTimeout(r, 50));
    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain("/api/tutorials/unwatched-count");
  });
});
