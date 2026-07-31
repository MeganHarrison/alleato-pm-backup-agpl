/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";

import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
} from "../side-panel";

describe("SidePanel", () => {
  it("owns compact right-panel layout for feature drawers", () => {
    render(
      <SidePanel open>
        <SidePanelContent>
          <SidePanelHeader>
            <SidePanelTitle>Task details</SidePanelTitle>
          </SidePanelHeader>
          <SidePanelBody>Panel body</SidePanelBody>
          <SidePanelFooter>Panel footer</SidePanelFooter>
        </SidePanelContent>
      </SidePanel>,
    );

    const panel = screen.getByRole("dialog");
    expect(panel).toHaveStyle({ width: "min(100vw, 28rem)" });
    expect(panel).toHaveStyle({ maxWidth: "100vw" });
    expect(panel).toHaveClass("gap-0", "overflow-hidden", "p-0");

    const header = screen.getByText("Task details").closest("[data-slot='sheet-header']");
    expect(header).toHaveClass("px-5", "py-4");
    expect(header).not.toHaveClass("border-b");
    expect(screen.getByText("Panel body")).toHaveClass("flex-1", "overflow-y-auto", "px-5");
    const footer = screen.getByText("Panel footer").closest("[data-slot='sheet-footer']");
    expect(footer).toHaveClass("px-5", "py-4");
    expect(footer).not.toHaveClass("border-t");
  });

  it("supports larger shared sizes without local width classes", () => {
    render(
      <SidePanel open>
        <SidePanelContent size="lg">
          <SidePanelTitle>Large panel</SidePanelTitle>
        </SidePanelContent>
      </SidePanel>,
    );

    expect(screen.getByRole("dialog")).toHaveStyle({
      width: "min(100vw, 42rem)",
    });
  });
});
