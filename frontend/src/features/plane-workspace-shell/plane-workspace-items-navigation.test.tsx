/** @vitest-environment jsdom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  listPlaneWorkspaceItems,
  removePlaneWorkspaceItem,
  savePlaneWorkspaceItem,
  type PlaneWorkspaceItem,
} from "@/features/plane-workspace-items";
import { ApiError } from "@/lib/api-client";
import {
  PlaneWorkspaceItemsNavigation,
  getPlaneSurfaceWorkspaceItem,
  getPlaneWorkspaceItemsError,
  isValidPlaneWorkspaceProjectId,
  sortPlaneSidebarItems,
} from "./plane-workspace-items-navigation";

vi.mock("@/features/plane-workspace-items", () => ({
  listPlaneWorkspaceItems: vi.fn(),
  removePlaneWorkspaceItem: vi.fn(),
  savePlaneWorkspaceItem: vi.fn(),
}));

const listItems = vi.mocked(listPlaneWorkspaceItems);
const removeItem = vi.mocked(removePlaneWorkspaceItem);
const saveItem = vi.mocked(savePlaneWorkspaceItem);

function workspaceItem(
  overrides: Partial<PlaneWorkspaceItem> &
    Pick<PlaneWorkspaceItem, "id" | "name">,
): PlaneWorkspaceItem {
  return {
    id: overrides.id,
    user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    workspace_key: "alleato",
    project_id: 31,
    item_kind: "favorite",
    entity_type: "work_item",
    entity_identifier: `31:${overrides.name.toLowerCase().replaceAll(" ", "-")}`,
    name: overrides.name,
    href: `/31/plane/${overrides.name.toLowerCase().replaceAll(" ", "-")}`,
    sort_order: 65535,
    metadata: {},
    last_accessed_at: "2026-07-31T12:00:00.000Z",
    created_at: "2026-07-31T12:00:00.000Z",
    updated_at: "2026-07-31T12:00:00.000Z",
    ...overrides,
  };
}

function renderNavigation(
  overrides: {
    onNavigate?: () => void;
    projectId?: number;
    collapsed?: boolean;
  } = {},
) {
  return render(
    <PlaneWorkspaceItemsNavigation
      projectId={overrides.projectId ?? 31}
      projectName="Test Project"
      activeSurface="work-items"
      collapsed={overrides.collapsed ?? false}
      onNavigate={overrides.onNavigate ?? vi.fn()}
    />,
  );
}

beforeEach(() => {
  listItems.mockReset();
  removeItem.mockReset();
  listItems.mockResolvedValue([]);
  removeItem.mockResolvedValue(undefined);
  saveItem.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PlaneWorkspaceItemsNavigation", () => {
  it("loads project-scoped items, renders deterministic groups, and navigates validated hrefs", async () => {
    const onNavigate = vi.fn();
    listItems.mockResolvedValue([
      workspaceItem({
        id: "11111111-1111-4111-8111-111111111111",
        name: "Later favorite",
        sort_order: 20,
      }),
      workspaceItem({
        id: "22222222-2222-4222-8222-222222222222",
        name: "Newest recent",
        item_kind: "recent",
        last_accessed_at: "2026-07-31T14:00:00.000Z",
      }),
      workspaceItem({
        id: "33333333-3333-4333-8333-333333333333",
        name: "First favorite",
        sort_order: 10,
      }),
      workspaceItem({
        id: "44444444-4444-4444-8444-444444444444",
        name: "Older recent",
        item_kind: "recent",
        last_accessed_at: "2026-07-31T13:00:00.000Z",
      }),
    ]);

    renderNavigation({ onNavigate });

    expect(await screen.findByText("First favorite")).toBeTruthy();
    expect(
      screen.getAllByRole("link").map((link) => link.textContent?.trim()),
    ).toEqual([
      "First favorite",
      "Later favorite",
      "Newest recent",
      "Older recent",
    ]);
    expect(listItems).toHaveBeenCalledWith({
      workspaceKey: "alleato",
      projectId: 31,
      limit: 50,
    });

    const recentLink = screen.getByRole("link", {
      name: "Recents: Newest recent",
    });
    recentLink.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    });
    fireEvent.click(recentLink);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(
      screen
        .getByRole("link", { name: "Recents: Newest recent" })
        .getAttribute("href"),
    ).toBe("/31/plane/newest-recent");
  });

  it("shows honest empty states and adds the current surface only after server confirmation", async () => {
    const saved = workspaceItem({
      id: "55555555-5555-4555-8555-555555555555",
      name: "Work items",
      entity_identifier: "31:work-items",
      href: "/31/plane/work-items",
    });
    saveItem.mockResolvedValue(saved);

    renderNavigation();

    expect(await screen.findByText("No favorites yet")).toBeTruthy();
    expect(screen.getByText("No recent items yet")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Favorite current surface: Work items",
      }),
    );

    expect(
      await screen.findByRole("link", { name: "Favorites: Work items" }),
    ).toBeTruthy();
    expect(saveItem).toHaveBeenCalledWith({
      workspaceKey: "alleato",
      projectId: 31,
      itemKind: "favorite",
      entityType: "work_item",
      entityIdentifier: "31:work-items",
      name: "Work items",
      href: "/31/plane/work-items",
    });
    expect(
      screen.getByRole("button", {
        name: "Unfavorite current surface: Work items",
      }),
    ).toBeTruthy();
  });

  it("removes a favorite only after the server confirms deletion", async () => {
    const favorite = workspaceItem({
      id: "66666666-6666-4666-8666-666666666666",
      name: "Work items",
      entity_identifier: "31:work-items",
      href: "/31/plane/work-items",
    });
    listItems.mockResolvedValue([favorite]);

    renderNavigation();

    const remove = await screen.findByRole("button", {
      name: "Remove Work items from favorites",
    });
    fireEvent.click(remove);

    await waitFor(() => expect(removeItem).toHaveBeenCalledWith(favorite.id));
    await waitFor(() =>
      expect(
        screen.queryByRole("link", { name: "Favorites: Work items" }),
      ).toBeNull(),
    );
  });

  it("fails loudly on 503 and retries through the same authorized API", async () => {
    listItems
      .mockRejectedValueOnce(
        new ApiError(503, { error: "Workspace storage unavailable" }),
      )
      .mockResolvedValueOnce([]);

    renderNavigation({ collapsed: true });

    const message = await screen.findByText(
      "Favorites and Recents are unavailable while workspace storage is being enabled.",
    );
    expect(message).toBeTruthy();
    expect(message.className).toContain("md:sr-only");
    expect(message.closest('[role="alert"]')?.className).not.toContain(
      "md:hidden",
    );
    expect(screen.getAllByRole("button", { name: "Retry" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("No favorites yet")).toBeTruthy();
    expect(listItems).toHaveBeenCalledTimes(2);
  });

  it("fails closed without an API call when project context is invalid", async () => {
    renderNavigation({ projectId: Number.NaN, collapsed: true });

    const message = await screen.findByText(
      "Favorites and Recents are unavailable because this project context is invalid.",
    );
    expect(message.className).toContain("md:sr-only");
    expect(message.closest('[role="alert"]')?.className).not.toContain(
      "md:hidden",
    );
    expect(listItems).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("discards a stale project response after navigation changes scope", async () => {
    let resolveProject31!: (items: PlaneWorkspaceItem[]) => void;
    let resolveProject32!: (items: PlaneWorkspaceItem[]) => void;
    listItems.mockImplementation(
      ({ projectId }) =>
        new Promise((resolve) => {
          if (projectId === 31) resolveProject31 = resolve;
          if (projectId === 32) resolveProject32 = resolve;
        }),
    );

    const { rerender } = render(
      <PlaneWorkspaceItemsNavigation
        projectId={31}
        projectName="Project 31"
        activeSurface="work-items"
        collapsed={false}
        onNavigate={vi.fn()}
      />,
    );
    rerender(
      <PlaneWorkspaceItemsNavigation
        projectId={32}
        projectName="Project 32"
        activeSurface="work-items"
        collapsed={false}
        onNavigate={vi.fn()}
      />,
    );

    await act(async () => {
      resolveProject32([
        workspaceItem({
          id: "77777777-7777-4777-8777-777777777777",
          project_id: 32,
          name: "Project 32 item",
          href: "/32/plane/work-items",
        }),
      ]);
    });
    expect(await screen.findByText("Project 32 item")).toBeTruthy();

    await act(async () => {
      resolveProject31([
        workspaceItem({
          id: "88888888-8888-4888-8888-888888888888",
          name: "Stale project 31 item",
        }),
      ]);
    });
    expect(screen.queryByText("Stale project 31 item")).toBeNull();
    expect(screen.getByText("Project 32 item")).toBeTruthy();
  });

  it("preserves confirmed state when a mutation fails", async () => {
    saveItem.mockRejectedValue(
      new ApiError(503, { error: "Workspace storage unavailable" }),
    );

    renderNavigation({ collapsed: true });
    await screen.findByText("No favorites yet");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Favorite current surface: Work items",
      }),
    );

    const message = await screen.findByText(
      "Favorites and Recents are unavailable while workspace storage is being enabled.",
    );
    expect(message).toBeTruthy();
    expect(message.className).toContain("md:sr-only");
    expect(message.closest('[role="alert"]')?.className).not.toContain(
      "md:hidden",
    );
    expect(
      screen.queryByRole("link", { name: "Favorites: Work items" }),
    ).toBeNull();
    expect(screen.getByText("No favorites yet")).toBeTruthy();
  });
});

describe("Plane workspace item sidebar contracts", () => {
  it("accepts only positive safe-integer project identifiers", () => {
    expect(isValidPlaneWorkspaceProjectId(31)).toBe(true);
    expect(isValidPlaneWorkspaceProjectId(Number.NaN)).toBe(false);
    expect(isValidPlaneWorkspaceProjectId(31.5)).toBe(false);
    expect(isValidPlaneWorkspaceProjectId(0)).toBe(false);
  });

  it("creates stable descriptors for the active surface", () => {
    expect(getPlaneSurfaceWorkspaceItem(31, "Test Project", "home")).toEqual({
      projectId: 31,
      entityType: "project",
      entityIdentifier: "31:home",
      name: "Test Project home",
      href: "/31/plane/home",
    });
    expect(
      getPlaneSurfaceWorkspaceItem(31, "Test Project", "prime-contracts"),
    ).toMatchObject({
      entityType: "prime_contract",
      entityIdentifier: "31:prime-contracts",
      href: "/31/plane/prime-contracts",
    });
  });

  it("uses stable tie-breakers for favorite and recent ordering", () => {
    const favoriteB = workspaceItem({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      name: "B",
      sort_order: 1,
    });
    const favoriteA = workspaceItem({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "A",
      sort_order: 1,
    });
    const recent = workspaceItem({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      name: "Recent",
      item_kind: "recent",
    });

    expect(
      sortPlaneSidebarItems([recent, favoriteB, favoriteA]).map(
        (item) => item.id,
      ),
    ).toEqual([favoriteA.id, favoriteB.id, recent.id]);
  });

  it("maps permission and session failures without exposing raw API details", () => {
    expect(getPlaneWorkspaceItemsError(new ApiError(401, {}))).toContain(
      "session expired",
    );
    expect(getPlaneWorkspaceItemsError(new ApiError(403, {}))).toContain(
      "do not have permission",
    );
    expect(
      getPlaneWorkspaceItemsError(new Error("secret database detail")),
    ).toBe("Favorites and Recents could not be loaded. Retry to check again.");
  });
});
