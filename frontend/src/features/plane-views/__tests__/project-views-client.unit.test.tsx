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

import type { SavedTableView } from "@/hooks/use-saved-table-views";

const mockPush = jest.fn();
const mockUseSavedTableViews = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/hooks/use-saved-table-views", () => ({
  useSavedTableViews: (...args: unknown[]) => mockUseSavedTableViews(...args),
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
    <PlaneProjectViewsIndex
      projectId="31"
      projectName="All Implementation"
      taskRoute="/31/tasks"
    />,
  );
}

describe("Plane Views rendered structure", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockUseSavedTableViews.mockReset();
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

  it("keeps creation disabled and mutation controls absent", () => {
    mockUseSavedTableViews.mockReturnValue({
      data: [VIEW],
      isLoading: false,
      error: null,
    });

    const markup = renderViews();

    expect(markup).toMatch(
      /<button[^>]*disabled=""[^>]*aria-describedby="plane-view-create-status"[^>]*>/,
    );
    expect(markup).toContain(
      "View creation is unavailable in this read-only pilot.",
    );
    expect(markup).not.toContain(">Create view<");
    expect(markup).not.toContain(">Edit<");
    expect(markup).not.toContain(">Delete<");
    expect(markup).not.toContain(">Set as default<");
    expect(markup).not.toContain(">Remove as default<");
  });
});
