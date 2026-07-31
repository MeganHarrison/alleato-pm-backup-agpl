/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 *
 * Pins the Plane Views structure adapted at Plane commit
 * 39856932cd6b9bd17eab0920506d628190b47af2.
 */

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";

import type { SavedTableView } from "@/hooks/use-saved-table-views";

const mockPush = jest.fn();
const mockUseSavedTableViews = jest.fn();
const mockUseCreateSavedTableView = jest.fn();
const mockUseUpdateSavedTableView = jest.fn();
const mockUseDeleteSavedTableView = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/hooks/use-saved-table-views", () => ({
  useSavedTableViews: (...args: unknown[]) => mockUseSavedTableViews(...args),
  useCreateSavedTableView: (...args: unknown[]) =>
    mockUseCreateSavedTableView(...args),
  useUpdateSavedTableView: (...args: unknown[]) =>
    mockUseUpdateSavedTableView(...args),
  useDeleteSavedTableView: (...args: unknown[]) =>
    mockUseDeleteSavedTableView(...args),
}));

import { PlaneProjectViewsIndex } from "../project-views-client";

const VIEW: SavedTableView = {
  id: "view-1",
  scope_key: "project-tasks-31",
  name: "Critical closeout",
  is_default: true,
  visible_columns: ["name", "status"],
  column_order: ["name", "status"],
  column_widths: null,
  sort_by: "created_at",
  sort_direction: "desc",
  filters: {
    view: "list",
    status: "done",
    priority: "high",
    description: "Closeout items requiring attention",
    access: "private",
  },
  created_at: "2026-07-30T12:00:00.000Z",
  updated_at: "2026-07-30T12:00:00.000Z",
};

function renderViews() {
  return renderToStaticMarkup(
    <PlaneProjectViewsIndex projectId="31" projectName="All Implementation" />,
  );
}

describe("Plane Views rendered structure", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockUseSavedTableViews.mockReset();
    mockUseCreateSavedTableView.mockReset();
    mockUseUpdateSavedTableView.mockReset();
    mockUseDeleteSavedTableView.mockReset();

    for (const mutationHook of [
      mockUseCreateSavedTableView,
      mockUseUpdateSavedTableView,
      mockUseDeleteSavedTableView,
    ]) {
      mutationHook.mockReturnValue({
        mutateAsync: jest.fn(),
        isPending: false,
      });
    }
  });

  it("defaults saved views to the canonical Plane work-items route", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "../project-views-client.tsx"),
      "utf8",
    );

    expect(source).toContain("taskRoute = `/${projectId}/plane/work-items`");
    expect(source).not.toContain("taskRoute = `/${projectId}/tasks`");
  });

  it("pins the Plane desktop and mobile header controls", () => {
    mockUseSavedTableViews.mockReturnValue({
      data: [VIEW],
      isLoading: false,
      error: null,
    });

    const markup = renderViews();

    expect(markup).toContain("All Implementation");
    expect(markup).toContain(">Views<");
    expect(markup).toContain('aria-label="Search views"');
    expect(markup).toContain('aria-label="Order views by name descending"');
    expect(markup).toContain('aria-label="Filter views"');
    expect(markup).toContain("md:hidden");
    expect(markup).toContain(">Order by<");
    expect(markup).toContain(">Filters<");
  });

  it("pins the 52px Plane row and truthful metadata cluster", () => {
    mockUseSavedTableViews.mockReturnValue({
      data: [VIEW],
      isLoading: false,
      error: null,
    });

    const markup = renderViews();

    expect(markup).toContain("min-h-[52px]");
    expect(markup).toContain("Critical closeout");
    expect(markup).toContain("Closeout items requiring attention");
    expect(markup).toContain('aria-label="Default view"');
    expect(markup).toContain('title="Private view"');
    expect(markup).toContain("Done · High priority");
  });

  it("renders the Plane loading branch as five 52px rows", () => {
    mockUseSavedTableViews.mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
    });

    const markup = renderViews();

    expect(markup.match(/animate-pulse/g)).toHaveLength(5);
    expect(markup.match(/h-\[52px\]/g)).toHaveLength(5);
  });

  it("renders distinct empty and query-error branches", () => {
    mockUseSavedTableViews.mockReturnValueOnce({
      data: [],
      isLoading: false,
      error: null,
    });

    const emptyMarkup = renderViews();
    expect(emptyMarkup).toContain("No views yet");
    expect(emptyMarkup).toContain(
      "Saved task views will appear here when they are available.",
    );

    mockUseSavedTableViews.mockReturnValueOnce({
      data: [],
      isLoading: false,
      error: new Error("Saved-view request timed out"),
    });

    const errorMarkup = renderViews();
    expect(errorMarkup).toContain('role="alert"');
    expect(errorMarkup).toContain("Saved views could not be loaded.");
    expect(errorMarkup).toContain("Saved-view request timed out");
  });

  it("renders enabled creation and per-view mutation entry points", () => {
    mockUseSavedTableViews.mockReturnValue({
      data: [VIEW],
      isLoading: false,
      error: null,
    });

    const markup = renderViews();

    const addViewLabelIndex = markup.indexOf(">Add view</span>");
    const addViewButtonStart = markup.lastIndexOf("<button", addViewLabelIndex);
    const addViewButtonEnd = markup.indexOf(">", addViewButtonStart);
    expect(addViewLabelIndex).toBeGreaterThan(-1);
    expect(markup.slice(addViewButtonStart, addViewButtonEnd)).not.toMatch(
      /\sdisabled(?:=|\s|$)/,
    );
    expect(markup).toContain('aria-label="Actions for Critical closeout"');
    expect(markup).not.toContain("read-only pilot");
    expect(mockUseCreateSavedTableView).toHaveBeenCalledWith(
      "project-tasks-31",
    );
    expect(mockUseUpdateSavedTableView).toHaveBeenCalledWith(
      "project-tasks-31",
    );
    expect(mockUseDeleteSavedTableView).toHaveBeenCalledWith(
      "project-tasks-31",
    );
  });
});
