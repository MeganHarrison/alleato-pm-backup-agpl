import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { TasksRow } from "@/features/tasks/task-utils";
import type { PlaneTaskGroup } from "./plane-your-work-model";
import {
  PlaneYourWorkGroups,
  PlaneYourWorkScopeTabs,
} from "./plane-your-work-view";

describe("Plane Your Work template", () => {
  it("shows company scope only when authorization permits it", () => {
    const memberHtml = renderToStaticMarkup(
      <PlaneYourWorkScopeTabs
        scope="mine"
        showCompany={false}
        onScopeChange={jest.fn()}
      />,
    );
    const adminHtml = renderToStaticMarkup(
      <PlaneYourWorkScopeTabs
        scope="all"
        showCompany
        onScopeChange={jest.fn()}
      />,
    );

    expect(memberHtml).toContain("My work");
    expect(memberHtml).not.toContain("Company");
    expect(adminHtml).toContain("Company");
    expect(adminHtml).toContain('aria-selected="true"');
  });

  it("renders Plane-style project groups with actionable task rows", () => {
    const task = {
      id: "task-1",
      title: "Confirm storefront header attachment",
      description: "Confirm storefront header attachment",
      status: "open",
      project_name: "All Implementation",
      due_date: "2026-08-05",
      assignee_name: "Megan Harrison",
    } as TasksRow;
    const groups: PlaneTaskGroup[] = [
      {
        key: "31",
        label: "All Implementation",
        tasks: [task],
      },
    ];
    const html = renderToStaticMarkup(
      <PlaneYourWorkGroups
        groups={groups}
        updatingId={null}
        onSelect={jest.fn()}
        onToggleDone={jest.fn()}
      />,
    );

    expect(html).toContain("All Implementation");
    expect(html).toContain("Confirm storefront header attachment");
    expect(html).toContain("Megan Harrison");
    expect(html).toContain("Aug 5, 2026");
    expect(html).toContain("Complete Confirm storefront header attachment");
  });
});
