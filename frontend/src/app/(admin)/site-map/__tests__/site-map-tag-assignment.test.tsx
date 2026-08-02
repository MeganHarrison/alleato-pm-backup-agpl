/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";

import { BulkTagAssignmentMenu } from "../site-map-client";

describe("BulkTagAssignmentMenu", () => {
  const catalog = [
    {
      slug: "brandons-dashboard",
      label: "Brandon's Dashboard",
      color: null,
      updatedAt: null,
    },
  ];

  it("applies a selected tag directly from the table bulk toolbar", () => {
    const onApply = jest.fn();

    render(
      <BulkTagAssignmentMenu
        catalog={catalog}
        isBusy={false}
        onApply={onApply}
      />,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "Apply tags" }), {
      key: "ArrowDown",
    });
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Brandon's Dashboard" }),
    );

    expect(onApply).toHaveBeenCalledWith("brandons-dashboard");
  });

  it("stays unavailable until a tag can be applied", () => {
    render(
      <BulkTagAssignmentMenu catalog={[]} isBusy={false} onApply={jest.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Apply tags" })).toBeDisabled();
  });
});
