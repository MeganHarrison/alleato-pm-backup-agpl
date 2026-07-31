/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

import { VendorCombobox } from "../VendorCombobox";

beforeAll(() => {
  Element.prototype.hasPointerCapture = jest.fn();
  Element.prototype.setPointerCapture = jest.fn();
  Element.prototype.releasePointerCapture = jest.fn();
  Element.prototype.scrollIntoView = jest.fn();
});

describe("VendorCombobox", () => {
  it("clears the selected vendor from the visible X control", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <VendorCombobox
        value="vendor-1"
        onChange={onChange}
        vendors={[
          { id: "vendor-1", vendor_name: "R.J. Skelding Co, Inc" },
          { id: "vendor-2", vendor_name: "Ordcha Engineering" },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Clear vendor" }));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("keeps the checkmark toggle behavior in the dropdown list", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <VendorCombobox
        value="vendor-1"
        onChange={onChange}
        vendors={[
          { id: "vendor-1", vendor_name: "R.J. Skelding Co, Inc" },
          { id: "vendor-2", vendor_name: "Ordcha Engineering" },
        ]}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Select vendor" }));
    await user.click(
      screen.getByRole("option", { name: "R.J. Skelding Co, Inc" }),
    );

    expect(onChange).toHaveBeenCalledWith("");
  });
});
