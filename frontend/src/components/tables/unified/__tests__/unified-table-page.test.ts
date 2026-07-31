/**
 * @jest-environment jsdom
 */
import {
  MIN_COLUMN_RESIZE_WIDTH,
  TABLE_ABOVE_TABLE_TOOLBAR_CLASSNAME,
  TABLE_FULL_BLEED_PAGE_CONTAINER_CLASSNAME,
  TABLE_FULL_BLEED_SCROLL_SHELL_CLASSNAME,
  TABLE_HEADER_LABEL_CLASSNAME,
  TABLE_HEADER_MOBILE_TOOLBAR_CLASSNAME,
  TABLE_INLINE_PAGE_TABS_CLASSNAME,
  TABLE_SIDE_PANEL_PAGE_CONTAINER_CLASSNAME,
  TABLE_SPLIT_VIEW_CONTAINER_CLASSNAME,
  TABLE_SPLIT_VIEW_PAGE_CONTAINER_CLASSNAME,
  computeResizedColumnWidth,
  mergeContinuousTableItems,
  shouldRenderRowSelection,
  shouldPlaceToolbarInlineWithHeader,
  shouldUseIconOnlyInlineEdit,
} from "../unified-table-page";
import {
  readUnifiedTablePreferences,
  resolveUnifiedTablePerPage,
  saveUnifiedTablePreferences,
  UNIFIED_TABLE_PREFERENCES_STORAGE_KEY,
} from "../use-unified-table-state";

describe("UnifiedTablePage header labels", () => {
  it("does not truncate column headings", () => {
    expect(TABLE_HEADER_LABEL_CLASSNAME).toContain("whitespace-nowrap");
    expect(TABLE_HEADER_LABEL_CLASSNAME).not.toContain("truncate");
  });

  it("keeps the mobile table toolbar in the header until the desktop toolbar can render", () => {
    expect(TABLE_HEADER_MOBILE_TOOLBAR_CLASSNAME).toContain("lg:hidden");
    expect(TABLE_HEADER_MOBILE_TOOLBAR_CLASSNAME).not.toContain("sm:hidden");
    expect(TABLE_ABOVE_TABLE_TOOLBAR_CLASSNAME).toContain("lg:flex");
    expect(TABLE_ABOVE_TABLE_TOOLBAR_CLASSNAME).not.toContain("sm:flex");
  });

  it("removes responsive tab margins inside the vertically centered toolbar row", () => {
    expect(TABLE_INLINE_PAGE_TABS_CLASSNAME).toContain("mb-0");
    expect(TABLE_INLINE_PAGE_TABS_CLASSNAME).toContain("md:mb-0");
  });

  it("keeps editable name columns on icon-only editing by default", () => {
    expect(shouldUseIconOnlyInlineEdit({ id: "name" })).toBe(true);
    expect(shouldUseIconOnlyInlineEdit({ id: "email" })).toBe(false);
    expect(
      shouldUseIconOnlyInlineEdit({ id: "email", editTrigger: "icon" }),
    ).toBe(true);
    expect(
      shouldUseIconOnlyInlineEdit({ id: "name", editTrigger: "cell" }),
    ).toBe(false);
  });

  it("keeps split views on a flex-fill, overflow-contained layout contract", () => {
    expect(TABLE_SPLIT_VIEW_CONTAINER_CLASSNAME).toContain("h-full");
    expect(TABLE_SPLIT_VIEW_CONTAINER_CLASSNAME).toContain("min-h-0");
    expect(TABLE_SPLIT_VIEW_CONTAINER_CLASSNAME).toContain("flex-1");
    expect(TABLE_SPLIT_VIEW_CONTAINER_CLASSNAME).toContain("overflow-hidden");
    expect(TABLE_SPLIT_VIEW_CONTAINER_CLASSNAME).not.toContain("100dvh");
    expect(TABLE_SPLIT_VIEW_PAGE_CONTAINER_CLASSNAME).toContain("h-full");
    expect(TABLE_SPLIT_VIEW_PAGE_CONTAINER_CLASSNAME).toContain("min-h-0");
    expect(TABLE_SPLIT_VIEW_PAGE_CONTAINER_CLASSNAME).toContain(
      "overflow-hidden",
    );
    expect(TABLE_SPLIT_VIEW_PAGE_CONTAINER_CLASSNAME).toContain("pb-0");
    expect(TABLE_SPLIT_VIEW_PAGE_CONTAINER_CLASSNAME).not.toContain("100dvh");
  });

  it("preserves the standard table-page top inset when a side panel is configured", () => {
    expect(TABLE_SIDE_PANEL_PAGE_CONTAINER_CLASSNAME).not.toContain("pt-0");
  });

  it("lets full-bleed tables escape the page gutter instead of clipping the last columns", () => {
    expect(TABLE_FULL_BLEED_PAGE_CONTAINER_CLASSNAME).toContain(
      "overflow-x-visible",
    );
    expect(TABLE_FULL_BLEED_SCROLL_SHELL_CLASSNAME).toContain("-mx-4");
    expect(TABLE_FULL_BLEED_SCROLL_SHELL_CLASSNAME).toContain(
      "w-[calc(100%+2rem)]",
    );
    expect(TABLE_FULL_BLEED_SCROLL_SHELL_CLASSNAME).toContain("sm:-mx-6");
    expect(TABLE_FULL_BLEED_SCROLL_SHELL_CLASSNAME).toContain(
      "sm:w-[calc(100%+3rem)]",
    );
    expect(TABLE_FULL_BLEED_SCROLL_SHELL_CLASSNAME).toContain("lg:-mx-8");
    expect(TABLE_FULL_BLEED_SCROLL_SHELL_CLASSNAME).toContain(
      "lg:w-[calc(100%+4rem)]",
    );
  });

  it("defaults row selection on unless a page explicitly opts out", () => {
    expect(shouldRenderRowSelection()).toBe(true);
    expect(shouldRenderRowSelection({ enableRowSelection: true })).toBe(true);
    expect(shouldRenderRowSelection({ enableRowSelection: false })).toBe(false);
  });

  it("keeps the toolbar visible when a table hides its embedded header", () => {
    expect(shouldPlaceToolbarInlineWithHeader(true, undefined)).toBe(false);
    expect(shouldPlaceToolbarInlineWithHeader(true, true)).toBe(false);
    expect(shouldPlaceToolbarInlineWithHeader(false, undefined)).toBe(true);
    expect(shouldPlaceToolbarInlineWithHeader(false, false)).toBe(false);
  });
});

describe("column resize width computation", () => {
  it("tracks the drag delta while widening a column", () => {
    expect(computeResizedColumnWidth(280, 150)).toBe(430);
    expect(computeResizedColumnWidth(200, 0)).toBe(200);
  });

  it("never shrinks a column below the minimum resize width", () => {
    expect(computeResizedColumnWidth(200, -500)).toBe(MIN_COLUMN_RESIZE_WIDTH);
    expect(computeResizedColumnWidth(MIN_COLUMN_RESIZE_WIDTH, -1)).toBe(
      MIN_COLUMN_RESIZE_WIDTH,
    );
    expect(MIN_COLUMN_RESIZE_WIDTH).toBe(120);
  });
});

describe("unified table preferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists the selected row count without discarding the loading behavior", () => {
    saveUnifiedTablePreferences({ paginationBehavior: "scroll" });
    saveUnifiedTablePreferences({ perPage: 150 });

    expect(readUnifiedTablePreferences()).toEqual({
      perPage: 150,
      paginationBehavior: "scroll",
    });
    expect(resolveUnifiedTablePerPage(null, 25)).toBe(150);
    expect(resolveUnifiedTablePerPage("50", 25)).toBe(50);
  });

  it("rejects malformed saved values and keeps the supplied table default", () => {
    window.localStorage.setItem(
      UNIFIED_TABLE_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ perPage: 999, paginationBehavior: "unexpected" }),
    );

    expect(readUnifiedTablePreferences()).toEqual({
      perPage: undefined,
      paginationBehavior: undefined,
    });
    expect(resolveUnifiedTablePerPage(null, 25)).toBe(25);
  });

  it("keeps earlier server rows while adding the next scroll page", () => {
    const getRowId = (item: { id: string; value: string }) => item.id;
    const firstPage = [
      { id: "a", value: "first" },
      { id: "b", value: "second" },
    ];
    const nextPage = [
      { id: "b", value: "updated" },
      { id: "c", value: "third" },
    ];

    expect(
      mergeContinuousTableItems(firstPage, nextPage, getRowId, false),
    ).toEqual([
      { id: "a", value: "first" },
      { id: "b", value: "updated" },
      { id: "c", value: "third" },
    ]);
  });
});
