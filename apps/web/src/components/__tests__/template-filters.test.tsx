import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TemplateFilters } from "../template-filters";

// TemplateFilters is a pure prop-driven component — no Next.js mocks needed

describe("Template filters", () => {
  it("renders status filter chips", () => {
    render(
      <TemplateFilters
        statusFilters={[]}
        touchTypeFilters={[]}
        onStatusChange={vi.fn()}
        onTouchTypeChange={vi.fn()}
      />
    );

    expect(screen.getByText("Status:")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("No Access")).toBeInTheDocument();
    expect(screen.getByText("Not Ingested")).toBeInTheDocument();
    expect(screen.getByText("Stale")).toBeInTheDocument();
  });

  it("renders touch type filter chips", () => {
    render(
      <TemplateFilters
        statusFilters={[]}
        touchTypeFilters={[]}
        onStatusChange={vi.fn()}
        onTouchTypeChange={vi.fn()}
      />
    );

    expect(screen.getByText("Touch:")).toBeInTheDocument();
    expect(screen.getByText("Touch 1")).toBeInTheDocument();
    expect(screen.getByText("Touch 2")).toBeInTheDocument();
  });

  it("calls onStatusChange when a status chip is toggled", () => {
    const onStatusChange = vi.fn();
    render(
      <TemplateFilters
        statusFilters={[]}
        touchTypeFilters={[]}
        onStatusChange={onStatusChange}
        onTouchTypeChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Ready"));
    expect(onStatusChange).toHaveBeenCalledWith(["ready"]);
  });

  it("removes status from filters when already selected", () => {
    const onStatusChange = vi.fn();
    render(
      <TemplateFilters
        statusFilters={["ready"]}
        touchTypeFilters={[]}
        onStatusChange={onStatusChange}
        onTouchTypeChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Ready"));
    expect(onStatusChange).toHaveBeenCalledWith([]);
  });

  it("calls onTouchTypeChange when a touch type chip is toggled", () => {
    const onTouchTypeChange = vi.fn();
    render(
      <TemplateFilters
        statusFilters={[]}
        touchTypeFilters={[]}
        onStatusChange={vi.fn()}
        onTouchTypeChange={onTouchTypeChange}
      />
    );

    fireEvent.click(screen.getByText("Touch 1"));
    expect(onTouchTypeChange).toHaveBeenCalledWith(["touch_1"]);
  });
});
