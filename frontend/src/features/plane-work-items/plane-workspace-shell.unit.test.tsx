import { renderToStaticMarkup } from "react-dom/server";

import {
  PLANE_HOST_LAYOUT_SELECTOR,
  PLANE_WORKSPACE_SURFACES,
  PlaneWorkspaceShell,
  getPlaneWorkspaceCommands,
} from "./plane-workspace-shell";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe("PlaneWorkspaceShell", () => {
  it("renders one full-viewport shell with canonical project navigation", () => {
    const html = renderToStaticMarkup(
      <PlaneWorkspaceShell
        projectId="31"
        projectName="Test Project"
        activeSurface="pages"
      >
        <div>Plane page content</div>
      </PlaneWorkspaceShell>,
    );

    expect(html.match(/data-plane-workspace-root=/g)).toHaveLength(1);
    expect(html).toContain("z-[2147483000]");
    expect(html).not.toContain("z-[1000]");
    expect(html).toContain('data-plane-workspace-surface="pages"');
    expect(html).toContain("Plane page content");
    expect(html).toContain('href="/31/plane/pages"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('href="/auth/source"');
    expect(html).toContain('placeholder="Search commands..."');
    PLANE_WORKSPACE_SURFACES.forEach((surface) => {
      expect(html).toContain(`href="/31/plane/${surface}"`);
    });
  });

  it("filters the command palette without becoming a work-item text filter", () => {
    expect(getPlaneWorkspaceCommands("31", "cycle")).toEqual([
      { label: "Open Cycles", href: "/31/plane/cycles" },
    ]);
    expect(getPlaneWorkspaceCommands("31", "source")).toEqual([
      { label: "View corresponding source", href: "/auth/source" },
    ]);
  });

  it("targets every host chrome owner that must be inerted", () => {
    expect(PLANE_HOST_LAYOUT_SELECTOR).toContain(
      '[data-slot="sidebar-container"]',
    );
    expect(PLANE_HOST_LAYOUT_SELECTOR).toContain(
      '[data-slot="sidebar-inset"]',
    );
    expect(PLANE_HOST_LAYOUT_SELECTOR).toContain(
      'nav[aria-label="Primary"]',
    );
  });
});
