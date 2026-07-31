import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ChangeEvent } from "@/types/change-events";
import {
  PlaneChangeEventsList,
  PlaneChangeEventsTabs,
} from "./plane-change-events-view";

describe("Plane Change Events template", () => {
  it("renders Plane-style underlined canonical data tabs", () => {
    const html = renderToStaticMarkup(
      <PlaneChangeEventsTabs
        activeTab="line_items"
        counts={{ all: 9, line_items: 5, no_line_items: 4, rfqs: 2 }}
        onTabChange={jest.fn()}
      />,
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain(">Line Items</span>");
    expect(html).toContain(">5</span>");
  });

  it("keeps the decision fields visible in each list row", () => {
    const html = renderToStaticMarkup(
      <PlaneChangeEventsList
        events={[
          {
            id: "ce-1",
            project_id: 31,
            number: "CE-042",
            title: "Confirm storefront header attachment",
            status: "Open",
            scope: "In Scope",
            cost_rom: 12500,
          } as ChangeEvent,
        ]}
        onSelect={jest.fn()}
      />,
    );

    expect(html).toContain("CE-042");
    expect(html).toContain("Confirm storefront header attachment");
    expect(html).toContain("In Scope");
    expect(html).toContain("$12,500.00");
  });
});
