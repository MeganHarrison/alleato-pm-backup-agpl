/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { HubModuleGrid } from "../HubModuleGrid";

describe("HubModuleGrid", () => {
  it("renders one tile per entry", () => {
    const { container } = render(
      <HubModuleGrid
        tiles={[
          { tag: "MODULE 1", title: "The Method", description: "Start here." },
          {
            tag: "MODULE 2",
            title: "The Skill Wheel Exercise",
            description: "The core rep.",
          },
        ]}
      />,
    );

    expect(screen.getByText("The Method")).toBeInTheDocument();
    expect(screen.getByText("The Skill Wheel Exercise")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("grid");
    expect(container.firstChild).toHaveClass("grid-flow-dense");
    expect(container.firstChild).toHaveClass("grid-cols-1");
    expect(container.firstChild).toHaveClass("sm:grid-cols-2");
    expect(container.firstChild).toHaveClass("lg:grid-cols-4");
    expect(container.firstChild).not.toHaveClass("2xl:grid-cols-8");
    expect(container.firstChild).not.toHaveClass("divide-y");
  });
});
