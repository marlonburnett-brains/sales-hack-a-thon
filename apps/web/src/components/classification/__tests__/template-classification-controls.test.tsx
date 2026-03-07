import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplateClassificationControls } from "../template-classification-controls";
import { getClassificationLabel } from "@/lib/template-utils";

describe("TemplateClassificationControls", () => {
  it("shows one-touch example selection and only reveals artifact radios for touch_4", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <TemplateClassificationControls
        initialClassification="example"
        initialTouchTypes={[]}
        initialArtifactType={null}
        onSave={onSave}
      />,
    );

    expect(screen.queryByRole("radiogroup", { name: /artifact type/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /touch 1/i }));
    expect(screen.getByRole("radio", { name: /touch 1/i })).toBeChecked();
    expect(screen.queryByRole("radiogroup", { name: /artifact type/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /touch 4\+/i }));

    expect(screen.getByRole("radio", { name: /touch 4\+/i })).toBeChecked();
    expect(screen.queryByRole("radio", { name: /touch 1/i })).not.toBeChecked();
    expect(screen.getByRole("radiogroup", { name: /artifact type/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /proposal/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /talk track/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /faq/i })).toBeInTheDocument();
  });

  it("clears artifact type when touch_4 is removed or classification changes back to template", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <TemplateClassificationControls
        initialClassification="example"
        initialTouchTypes={["touch_4"]}
        initialArtifactType="proposal"
        onSave={onSave}
      />,
    );

    expect(screen.getByRole("radio", { name: /proposal/i })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: /touch 3/i }));

    expect(screen.queryByRole("radiogroup", { name: /artifact type/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenLastCalledWith({
      classification: "example",
      touchTypes: ["touch_3"],
      artifactType: null,
    });

    await user.click(screen.getByRole("button", { name: /template/i }));
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(onSave).toHaveBeenLastCalledWith({
      classification: "template",
      touchTypes: ["touch_3"],
      artifactType: null,
    });
  });
});

describe("getClassificationLabel", () => {
  it("includes the saved artifact label for touch_4 examples", () => {
    expect(getClassificationLabel("example", ["touch_4"], "proposal")).toBe(
      "Example (Touch 4+ - Proposal)",
    );
    expect(getClassificationLabel("example", ["touch_4"], "talk_track")).toBe(
      "Example (Touch 4+ - Talk Track)",
    );
    expect(getClassificationLabel("example", ["touch_4"], "faq")).toBe(
      "Example (Touch 4+ - FAQ)",
    );
  });
});
