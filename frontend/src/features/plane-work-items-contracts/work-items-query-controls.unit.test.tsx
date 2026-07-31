import { renderToStaticMarkup } from "react-dom/server";

import {
  countPlaneWorkItemFilters,
  PlaneWorkItemsQueryControls,
} from "./work-items-query-controls";
import { parsePlaneWorkItemsQuery } from "./work-items-query";

describe("Plane Work Items query controls", () => {
  it("counts only active filters and non-manual sorting", () => {
    expect(
      countPlaneWorkItemFilters(
        parsePlaneWorkItemsQuery(
          "?q=storefront&status=open,done&assignee=person-a&priority=high&due=overdue&sort=priority",
        ),
      ),
    ).toBe(7);

    expect(
      countPlaneWorkItemFilters(parsePlaneWorkItemsQuery("?view=board&peek=task-1")),
    ).toBe(0);
  });

  it("announces the active filter count from the Plane toolbar trigger", () => {
    const html = renderToStaticMarkup(
      <PlaneWorkItemsQueryControls
        query={parsePlaneWorkItemsQuery("?q=owner&status=open&sort=title")}
        assignees={[{ value: "person-a", label: "Megan" }]}
        onChange={jest.fn()}
      />,
    );

    expect(html).toContain(
      'aria-label="Filter and sort work items, 3 active"',
    );
    expect(html).toContain(">3<");
  });
});
