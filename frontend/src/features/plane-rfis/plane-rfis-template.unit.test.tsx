import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { RFI } from "@/types/database-extensions";
import { PlaneRfisList, PlaneRfisStatusTabs } from "./plane-rfis-view";

describe("Plane RFIs template", () => {
  it("renders Plane-style underlined status tabs with accessible state", () => {
    const html = renderToStaticMarkup(
      <PlaneRfisStatusTabs
        activeFilter="open"
        counts={{ all: 9, open: 7, closed: 2 }}
        onFilterChange={jest.fn()}
      />,
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain(">Open</span>");
    expect(html).toContain(">7<");
  });

  it("keeps the actionable record hierarchy in each list row", () => {
    const html = renderToStaticMarkup(
      <PlaneRfisList
        rfis={[
          {
            id: "rfi-1",
            number: 42,
            subject: "Confirm storefront header attachment",
            status: "open",
            assignees: ["Architect"],
            ball_in_court: "Architect",
            due_date: "2026-08-05",
          } as RFI,
        ]}
        onSelect={jest.fn()}
      />,
    );

    expect(html).toContain("RFI-042");
    expect(html).toContain("Confirm storefront header attachment");
    expect(html).toContain("Architect");
    expect(html).toContain("Aug 5, 2026");
  });
});
