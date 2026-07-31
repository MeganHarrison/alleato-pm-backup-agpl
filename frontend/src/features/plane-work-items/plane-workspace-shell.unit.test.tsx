import { renderToStaticMarkup } from "react-dom/server";

import {
  PLANE_HOST_LAYOUT_SELECTOR,
  PLANE_SIDEBAR_DEFAULT_WIDTH,
  PLANE_SIDEBAR_MAX_WIDTH,
  PLANE_SIDEBAR_MIN_WIDTH,
  PLANE_WORKSPACE_SURFACES,
  PlaneWorkspaceShell,
  clampPlaneSidebarWidth,
  getPlaneSidebarKeyboardWidth,
  getPlaneWorkspaceCommands,
  parsePlaneSidebarPreference,
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
    expect(html).toContain('data-plane-sidebar-collapsed="false"');
    expect(html).toContain(
      `--plane-sidebar-width:${PLANE_SIDEBAR_DEFAULT_WIDTH}px`,
    );
    expect(html).toContain('aria-label="Resize project sidebar"');
    expect(html).toContain('href="/31/home"');
    expect(html).toContain('href="/31/my-work"');
    expect(html).toContain('aria-label="Drafts unavailable"');
    expect(html).toContain('aria-label="Stickies unavailable"');
    expect(html).toContain('aria-label="More unavailable"');
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
    expect(PLANE_HOST_LAYOUT_SELECTOR).toContain('[data-slot="sidebar-inset"]');
    expect(PLANE_HOST_LAYOUT_SELECTOR).toContain('nav[aria-label="Primary"]');
  });

  it("bounds stored and keyboard-resized desktop widths", () => {
    expect(clampPlaneSidebarWidth(100)).toBe(PLANE_SIDEBAR_MIN_WIDTH);
    expect(clampPlaneSidebarWidth(999)).toBe(PLANE_SIDEBAR_MAX_WIDTH);
    expect(getPlaneSidebarKeyboardWidth(250, "ArrowLeft")).toBe(234);
    expect(getPlaneSidebarKeyboardWidth(250, "ArrowRight")).toBe(266);
    expect(getPlaneSidebarKeyboardWidth(250, "Home")).toBe(
      PLANE_SIDEBAR_MIN_WIDTH,
    );
    expect(getPlaneSidebarKeyboardWidth(250, "End")).toBe(
      PLANE_SIDEBAR_MAX_WIDTH,
    );
    expect(getPlaneSidebarKeyboardWidth(250, "Escape")).toBeNull();
  });

  it("parses persisted preferences without changing server defaults", () => {
    expect(parsePlaneSidebarPreference(null)).toEqual({
      width: PLANE_SIDEBAR_DEFAULT_WIDTH,
      collapsed: false,
    });
    expect(
      parsePlaneSidebarPreference(
        JSON.stringify({ width: 318, collapsed: true }),
      ),
    ).toEqual({ width: 318, collapsed: true });
    expect(
      parsePlaneSidebarPreference(
        JSON.stringify({ width: 999, collapsed: false }),
      ),
    ).toEqual({ width: PLANE_SIDEBAR_MAX_WIDTH, collapsed: false });
    expect(parsePlaneSidebarPreference("{not-json")).toEqual({
      width: PLANE_SIDEBAR_DEFAULT_WIDTH,
      collapsed: false,
    });
  });
});
