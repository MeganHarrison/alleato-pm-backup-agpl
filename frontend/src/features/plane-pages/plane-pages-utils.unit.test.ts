import type { ProjectPage } from "./plane-pages-data";
import {
  applyPageArchiveResult,
  displayPageTitle,
  filterProjectPages,
  pageBodyPreview,
  sortProjectPages,
} from "./plane-pages-utils";

const pages: ProjectPage[] = [
  {
    id: 1,
    project_id: 7,
    title: "Site logistics",
    body: "Crane access and delivery routes",
    archived: false,
    created_at: "2026-07-30T12:00:00.000Z",
    created_by: "user-1",
    updated_at: "2026-07-30T12:00:00.000Z",
  },
  {
    id: 2,
    project_id: 7,
    title: "Old turnover plan",
    body: "Archived closeout notes",
    archived: true,
    created_at: "2026-07-29T12:00:00.000Z",
    created_by: "user-1",
    updated_at: "2026-07-29T12:00:00.000Z",
  },
];

describe("Plane Pages utilities", () => {
  it("separates active and archived pages before searching", () => {
    expect(filterProjectPages(pages, "active", "delivery")).toEqual([pages[0]]);
    expect(filterProjectPages(pages, "archived", "closeout")).toEqual([pages[1]]);
    expect(filterProjectPages(pages, "active", "closeout")).toEqual([]);
  });

  it("uses quiet fallbacks for empty page content", () => {
    expect(displayPageTitle("   ")).toBe("Untitled");
    expect(pageBodyPreview("\n  ")).toBe("Empty page");
  });

  it("sorts a copy by Plane's supported page ordering fields", () => {
    expect(sortProjectPages(pages, "title", "asc").map((page) => page.id)).toEqual([
      2, 1,
    ]);
    expect(
      sortProjectPages(pages, "updated_at", "desc").map((page) => page.id),
    ).toEqual([1, 2]);
    expect(pages.map((page) => page.id)).toEqual([1, 2]);
  });

  it("returns a restored page to the active scope", () => {
    const restoredPage: ProjectPage = {
      ...pages[1],
      archived: false,
      updated_at: "2026-07-30T15:00:00.000Z",
    };

    const transition = applyPageArchiveResult(pages, restoredPage);

    expect(transition.scope).toBe("active");
    expect(transition.selectedPageId).toBeNull();
    expect(
      filterProjectPages(transition.pages, transition.scope, "").map(
        (page) => page.id,
      ),
    ).toEqual([1, 2]);
  });
});
