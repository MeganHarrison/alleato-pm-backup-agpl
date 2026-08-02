/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GlobalSearch } from "../global-search";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/contexts/project-context", () => ({
  useOptionalProject: () => null,
}));

jest.mock("@/hooks/use-global-search", () => ({
  useGlobalSearch: () => ({
    results: [],
    isLoading: false,
    isError: false,
    enabled: false,
  }),
}));

describe("GlobalSearch", () => {
  it("uses a compact icon trigger that opens the search palette", async () => {
    render(<GlobalSearch />);
    const user = userEvent.setup();

    const trigger = screen.getByRole("button", { name: "Search" });
    expect(trigger).toHaveClass("h-8", "w-8");
    expect(trigger).not.toHaveTextContent("Search");

    await user.click(trigger);

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(
      screen.getByPlaceholderText("Search projects, contacts, RFIs, drawings…"),
    ).toBeVisible();
  });
});
