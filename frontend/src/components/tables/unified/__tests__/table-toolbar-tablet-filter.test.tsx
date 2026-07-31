/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { TableToolbar } from "../table-toolbar";

describe("TableToolbar tablet filter sheet", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
        matches: query === "(max-width: 1023px)",
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("uses full-width touch controls in the filter sheet", () => {
    render(
      <TableToolbar
        totalItems={3}
        filteredItems={3}
        selectedCount={0}
        searchValue=""
        onSearchChange={jest.fn()}
        currentView="table"
        onViewChange={jest.fn()}
        filters={[{ id: "client", label: "Client", type: "select", options: [] }]}
        activeFilters={{ client: "active" }}
        onFilterChange={jest.fn()}
        onClearFilters={jest.fn()}
        visibleColumns={[]}
        onColumnVisibilityChange={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open table settings" }));
    fireEvent.click(screen.getByRole("button", { name: /Filter Client/i }));
    act(() => {
      jest.advanceTimersByTime(160);
    });

    expect(screen.getByRole("button", { name: "Clear" })).toBeVisible();
    expect(screen.getByRole("combobox")).toHaveClass("h-11", "w-full");
  });
});
