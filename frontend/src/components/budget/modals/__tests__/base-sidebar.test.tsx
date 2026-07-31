/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";

import { BaseSidebar, SidebarBody, SidebarFooter } from "../BaseSidebar";

describe("BaseSidebar", () => {
  it("reuses the shared side-panel slots and footer treatment", () => {
    render(
      <BaseSidebar open onClose={() => {}} title="Forecast To Complete" subtitle="Forecast">
        <SidebarBody>Body content</SidebarBody>
        <SidebarFooter>Footer actions</SidebarFooter>
      </BaseSidebar>,
    );

    const panel = screen.getByRole("dialog");
    expect(panel).toHaveStyle({ width: "min(100vw, 42rem)" });

    const header = screen.getByText("Forecast To Complete").closest("[data-slot='sheet-header']");
    expect(header).toHaveClass("border-b", "border-border/60");

    const footer = screen.getByText("Footer actions").closest("[data-slot='sheet-footer']");
    expect(footer).toHaveClass("border-t", "border-border/60", "bg-background");
    expect(footer).not.toHaveClass("bg-muted");
  });
});
