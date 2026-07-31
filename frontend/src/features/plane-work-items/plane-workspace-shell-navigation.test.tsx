/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  PLANE_SIDEBAR_STORAGE_KEY,
  PlaneWorkspaceShell,
} from "./plane-workspace-shell";

vi.mock("@/features/plane-workspace-items", () => ({
  listPlaneWorkspaceItems: vi.fn().mockResolvedValue([]),
  removePlaneWorkspaceItem: vi.fn(),
  savePlaneWorkspaceItem: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/hooks/use-project-permissions", () => ({
  useProjectPermissions: () => ({
    permissions: {
      contracts: ["read"],
      rfis: ["read"],
      submittals: ["read"],
      change_orders: ["read"],
    },
    isLoading: false,
  }),
  hasModulePermission: (
    permissions: Record<string, string[]>,
    module: string,
  ) => (permissions[module] ?? []).some((level) => level !== "none"),
}));

beforeAll(() => {
  vi.stubGlobal("PointerEvent", MouseEvent);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function renderShell() {
  return render(
    <PlaneWorkspaceShell
      projectId="31"
      projectName="Test Project"
      activeSurface="work-items"
    >
      <div>Work items</div>
    </PlaneWorkspaceShell>,
  );
}

describe("Plane workspace desktop sidebar navigation", () => {
  it("hydrates a collapsed preference, restores it, resizes by keyboard, and persists", async () => {
    window.localStorage.setItem(
      PLANE_SIDEBAR_STORAGE_KEY,
      JSON.stringify({ width: 312, collapsed: true }),
    );

    renderShell();

    const sidebar = await screen.findByLabelText("Plane workspace navigation");
    await waitFor(() =>
      expect(sidebar.getAttribute("data-plane-sidebar-collapsed")).toBe("true"),
    );
    expect(sidebar.style.getPropertyValue("--plane-sidebar-width")).toBe(
      "52px",
    );
    expect(screen.getByLabelText("Work items").getAttribute("title")).toBe(
      "Work items",
    );
    expect(sidebar.classList.contains("w-[250px]")).toBe(true);

    fireEvent.click(screen.getByLabelText("Restore project sidebar"));

    const separator = await screen.findByRole("separator", {
      name: "Resize project sidebar",
    });
    expect(separator.getAttribute("aria-valuenow")).toBe("312");

    fireEvent.keyDown(separator, { key: "ArrowRight" });
    await waitFor(() =>
      expect(separator.getAttribute("aria-valuenow")).toBe("328"),
    );
    await waitFor(() =>
      expect(
        JSON.parse(
          window.localStorage.getItem(PLANE_SIDEBAR_STORAGE_KEY) ?? "{}",
        ),
      ).toEqual({ width: 328, collapsed: false }),
    );
  });

  it("uses real destinations and exposes unavailable items honestly", async () => {
    renderShell();

    expect(
      (await screen.findByRole("link", { name: "Home" })).getAttribute("href"),
    ).toBe("/31/plane/home");
    expect(
      screen.getByRole("link", { name: "Your work" }).getAttribute("href"),
    ).toBe("/31/plane/your-work");
    expect(
      screen.getByRole("link", { name: "Drafts" }).getAttribute("href"),
    ).toBe("/31/plane/drafts");
    expect(
      screen.getByRole("link", { name: "Stickies" }).getAttribute("href"),
    ).toBe("/31/plane/stickies");
    expect(
      screen.getByRole("link", { name: "Projects" }).getAttribute("href"),
    ).toBe("/31/plane/projects");

    for (const label of ["More unavailable"]) {
      const control = screen.getByRole("button", { name: label });
      expect((control as HTMLButtonElement).disabled).toBe(true);
      expect(control.getAttribute("aria-disabled")).toBe("true");
    }

    for (const slug of [
      "rfis",
      "submittals",
      "change-events",
      "commitments",
      "prime-contracts",
    ]) {
      const link = screen.getByRole("link", {
        name:
          slug === "rfis"
            ? "RFIs"
            : slug
                .split("-")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" "),
      });
      expect(link.getAttribute("href")).toBe(`/31/plane/${slug}`);
    }

    expect(screen.getAllByRole("link", { name: "Projects" })).toHaveLength(1);
  });

  it("bounds pointer resizing at the desktop maximum", async () => {
    renderShell();

    const separator = await screen.findByRole("separator", {
      name: "Resize project sidebar",
    });
    fireEvent.pointerDown(separator, { button: 0, clientX: 250 });
    fireEvent.pointerMove(window, { clientX: 800 });
    fireEvent.pointerUp(window);

    await waitFor(() =>
      expect(separator.getAttribute("aria-valuenow")).toBe("360"),
    );
  });
});
