/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PrimeContractPcoHeaderActions } from "../prime-contract-pco-header-actions";

describe("PrimeContractPcoHeaderActions", () => {
  it("shows a visible edit action when the PCO is editable", () => {
    render(
      <PrimeContractPcoHeaderActions
        canDelete={false}
        canEdit
        canPromote={false}
        onCopyId={jest.fn()}
        onDelete={jest.fn()}
        onEdit={jest.fn()}
        onExport={jest.fn()}
        onPromote={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("navigates through the visible edit action instead of hiding edit in the overflow menu", async () => {
    const onEdit = jest.fn();

    render(
      <PrimeContractPcoHeaderActions
        canDelete={false}
        canEdit
        canPromote={false}
        onCopyId={jest.fn()}
        onDelete={jest.fn()}
        onEdit={onEdit}
        onExport={jest.fn()}
        onPromote={jest.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("hides the visible edit action when the PCO is void", () => {
    render(
      <PrimeContractPcoHeaderActions
        canDelete={false}
        canEdit={false}
        canPromote={false}
        onCopyId={jest.fn()}
        onDelete={jest.fn()}
        onEdit={jest.fn()}
        onExport={jest.fn()}
        onPromote={jest.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });
});
