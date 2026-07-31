import { renderToStaticMarkup } from "react-dom/server";

import { PlaneWorkItemsPage } from "./plane-work-items-page";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe("PlaneWorkItemsPage", () => {
  it("renders the Plane command, display, analytics, and creation controls", () => {
    const html = renderToStaticMarkup(
      <PlaneWorkItemsPage projectId="31" projectName="AI Implementation" />,
    );

    expect(html).toContain('placeholder="Search commands..."');
    expect(html).toContain(">Display<");
    expect(html).toContain(">Analytics<");
    expect(html).toContain(">Add work item<");
    expect(html).toContain('data-plane-workspace-surface="work-items"');
  });
});
