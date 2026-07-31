/**
 * @jest-environment jsdom
 */

import fs from "node:fs";
import path from "node:path";
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { DetailPropertyItem } from "@/components/ui/detail-property-bar";
import { CalendarDays } from "lucide-react";

import { RecordDetailPage } from "../record-detail-page";

jest.mock("../page-shell", () => ({
  PageShell: ({ title, actions, children }) => {
    const React = require("react");
    return React.createElement(
      "main",
      null,
      React.createElement("h1", null, title),
      actions,
      children,
    );
  },
}));

describe("RecordDetailPage", () => {
  it("owns the shared detail header, property bar, and body landmark", () => {
    render(
      <RecordDetailPage
        title="Punch item"
        actions={<span>Edit</span>}
        properties={<DetailPropertyItem icon={CalendarDays}>Due Jul 16</DetailPropertyItem>}
      >
        <section>Record body</section>
      </RecordDetailPage>,
    );

    expect(screen.getByRole("heading", { name: "Punch item" })).toBeInTheDocument();
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByTestId("record-detail-page")).toContainElement(
      screen.getByTestId("record-detail-properties"),
    );
    expect(screen.getByText("Due Jul 16")).toBeInTheDocument();
    expect(screen.getByText("Record body")).toBeInTheDocument();
  });

  it("keeps detail-route consumers on the shared template", () => {
    const srcRoot = path.resolve(__dirname, "../../..");
    const punchDetail = fs.readFileSync(
      path.join(srcRoot, "app/(main)/[projectId]/punch-list/[punchItemId]/punch-item-detail.tsx"),
      "utf8",
    );
    const directCostDetail = fs.readFileSync(
      path.join(srcRoot, "app/(main)/[projectId]/direct-costs/[costId]/page.tsx"),
      "utf8",
    );

    expect(punchDetail).toContain("<RecordDetailPage");
    expect(directCostDetail).toContain("<RecordDetailPage");
    expect(punchDetail).not.toContain("<PageShell");
    expect(directCostDetail).not.toContain("<PageShell");
    expect(punchDetail).not.toContain("<DetailPropertyBar");
    expect(directCostDetail).not.toContain("<DetailPropertyBar");
  });
});
