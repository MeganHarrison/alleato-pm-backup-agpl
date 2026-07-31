/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

import { ResourceFilters } from "../ResourceFilters";
import { EMPTY_TRAINING_LIBRARY_FILTERS } from "../types";
import { fixtureRoles, fixtureTracks } from "../__fixtures__/training-fixtures";

describe("ResourceFilters", () => {
  it("reflects the current role, track, type, and depth filters", () => {
    render(
      <ResourceFilters
        roles={fixtureRoles}
        tracks={fixtureTracks}
        value={{
          ...EMPTY_TRAINING_LIBRARY_FILTERS,
          roleId: "pm",
          track: "financials",
          type: "video",
          level: "intro",
        }}
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Role" })).toHaveTextContent(
      "Project Manager",
    );
    expect(screen.getByRole("combobox", { name: "Track" })).toHaveTextContent(
      "Financials",
    );
    expect(screen.getByRole("combobox", { name: "Format" })).toHaveTextContent(
      "Video",
    );
    expect(screen.getByRole("combobox", { name: "Depth" })).toHaveTextContent(
      "Intro",
    );
  });

  it("shows All selections when no filter is selected", () => {
    render(
      <ResourceFilters
        roles={fixtureRoles}
        tracks={fixtureTracks}
        value={EMPTY_TRAINING_LIBRARY_FILTERS}
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Role" })).toHaveTextContent(
      "Role",
    );
    expect(screen.getByRole("combobox", { name: "Track" })).toHaveTextContent(
      "Track",
    );
    expect(screen.getByRole("combobox", { name: "Format" })).toHaveTextContent(
      "Format",
    );
    expect(screen.getByRole("combobox", { name: "Depth" })).toHaveTextContent(
      "Depth",
    );
  });

  it("accepts search input and reports the merged filter value", () => {
    const onChange = jest.fn();
    render(
      <ResourceFilters
        roles={fixtureRoles}
        tracks={fixtureTracks}
        value={{ ...EMPTY_TRAINING_LIBRARY_FILTERS, roleId: "pm" }}
        onChange={onChange}
      />,
    );

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search training resources" }),
      { target: { value: "budget" } },
    );

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_TRAINING_LIBRARY_FILTERS,
      roleId: "pm",
      search: "budget",
    });
  });

  it("renders the five requested retrieval controls", () => {
    render(
      <ResourceFilters
        roles={fixtureRoles}
        tracks={fixtureTracks}
        value={EMPTY_TRAINING_LIBRARY_FILTERS}
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Role" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Track" })).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Format" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Depth" })).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "Search training resources" }),
    ).toBeInTheDocument();
  });

  it("keeps secondary filters behind a mobile disclosure", () => {
    const { container } = render(
      <ResourceFilters
        roles={fixtureRoles}
        tracks={fixtureTracks}
        value={EMPTY_TRAINING_LIBRARY_FILTERS}
        onChange={jest.fn()}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Filters" });
    const secondaryFilters = container.querySelector(
      "#training-secondary-filters",
    );

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(secondaryFilters).toHaveClass("hidden");

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(secondaryFilters).toHaveClass("grid");
  });
});
