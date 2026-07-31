/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import {
  FilterMenu,
  TableDisplaySettings,
  TableToolbar,
  ViewSwitcher,
} from "../table-toolbar";

describe("ViewSwitcher", () => {
  it("keeps icon-only view controls accessible without visible labels", () => {
    render(
      <ViewSwitcher
        currentView="card"
        onViewChange={jest.fn()}
        enabledViews={["table", "card", "list"]}
        display="icons"
      />,
    );

    expect(screen.getByRole("tab", { name: "Table view" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Grid view" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "List view" })).toBeVisible();
    expect(screen.queryByText("Table")).not.toBeInTheDocument();
    expect(screen.queryByText("Grid")).not.toBeInTheDocument();
    expect(screen.queryByText("List")).not.toBeInTheDocument();
  });

  it("keeps layout selection inside the shared filter menu", () => {
    render(
      <FilterMenu
        filters={[
          {
            id: "date",
            label: "Date Added",
            type: "dateRange",
          },
        ]}
        activeFilters={{}}
        onFilterChange={jest.fn()}
        onClearFilters={jest.fn()}
        viewSettings={{
          currentView: "table",
          onViewChange: jest.fn(),
          enabledViews: ["table", "card", "list"],
        }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Filters and view settings" }),
    );

    expect(screen.getByText("Layout")).toBeVisible();
    expect(screen.getByText("Filters")).toBeVisible();
    expect(screen.getByRole("button", { name: "From" })).toBeVisible();
  });

  it("uses the same view-settings shell for filters and table display settings", () => {
    const { unmount } = render(
      <FilterMenu
        filters={[]}
        activeFilters={{}}
        onFilterChange={jest.fn()}
        onClearFilters={jest.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Filters and view settings" }),
    );
    expect(screen.getByText("View settings")).toBeVisible();
    unmount();

    render(
      <TableDisplaySettings
        columns={[]}
        visibleColumns={[]}
        onColumnVisibilityChange={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Table settings" }));
    expect(screen.getByText("View settings")).toBeVisible();
  });
});

describe("TableToolbar row count", () => {
  it("shows the filtered count alongside the total count", () => {
    render(
      <TableToolbar
        totalItems={9}
        filteredItems={1}
        selectedCount={0}
        searchValue="Rag pipeline"
        onSearchChange={jest.fn()}
        currentView="table"
        onViewChange={jest.fn()}
        activeFilters={{}}
        onFilterChange={jest.fn()}
        onClearFilters={jest.fn()}
        visibleColumns={[]}
        onColumnVisibilityChange={jest.fn()}
        features={{
          search: false,
          views: false,
          filters: false,
          columnToggle: false,
          export: false,
          bulkDelete: false,
        }}
      />,
    );

    expect(screen.getByText("1 of 9 rows")).toBeVisible();
  });
});
