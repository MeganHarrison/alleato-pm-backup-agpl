/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { FormActions } from "./FormActions";

describe("FormActions", () => {
  it("keeps Tier 2 actions sticky when requested", () => {
    const { container } = render(
      <FormActions sticky submitLabel="Create RFI" onCancel={() => {}}>
        <span>Unsaved changes</span>
      </FormActions>,
    );

    expect(container.firstChild).toHaveClass("sticky", "bottom-0");
    expect(container.firstChild).not.toHaveClass("border-t");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("min-h-11");
    expect(
      screen.getByRole("button", { name: "Create RFI" }),
    ).toHaveClass("min-h-11");
  });
});
