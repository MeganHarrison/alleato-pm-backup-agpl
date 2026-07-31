/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

import { ContactFormSheet } from "../ContactFormSheet";

// --- Mocks -----------------------------------------------------------------

// Supabase client: the sheet fetches companies on open.
jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        order: () =>
          Promise.resolve({
            data: [{ id: "company-1", name: "Acme Construction" }],
            error: null,
          }),
      }),
    }),
  }),
}));

// Server actions are never invoked in this flow, but must resolve as modules.
jest.mock("@/app/(main)/actions/table-actions", () => ({
  createContact: jest.fn(),
  updateContact: jest.fn(),
}));

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

// jsdom lacks pointer-capture / scrollIntoView that Radix Popover + cmdk use.
beforeAll(() => {
  Element.prototype.hasPointerCapture = jest.fn();
  Element.prototype.setPointerCapture = jest.fn();
  Element.prototype.releasePointerCapture = jest.fn();
  Element.prototype.scrollIntoView = jest.fn();
});

// --- Tests -----------------------------------------------------------------

describe("ContactFormSheet — company combobox", () => {
  it("lets the user pick an existing company but never offers to create a new one", async () => {
    // Companies are managed exclusively in Acumatica (ERP) by Accounting, so
    // this combobox must only ever select from the synced list.
    const user = userEvent.setup();
    const onOpenChange = jest.fn();

    render(
      <ContactFormSheet open onOpenChange={onOpenChange} contact={null} />,
    );

    // Wait for companies to load — the trigger label flips from
    // "Loading companies..." to "Select company" and becomes enabled.
    const triggerLabel = await screen.findByText("Select company");
    const combobox = triggerLabel.closest<HTMLButtonElement>(
      '[role="combobox"]',
    );
    expect(combobox).not.toBeNull();
    await waitFor(() => expect(combobox).not.toBeDisabled());

    // Open the company combobox popover.
    await user.click(combobox!);

    // The synced company is selectable...
    const companyOption = await screen.findByText("Acme Construction");
    await user.click(companyOption);

    // ...but there is no way to create a new company from this form.
    expect(
      screen.queryByRole("button", { name: /add new company/i }),
    ).not.toBeInTheDocument();

    // ...and the sheet itself must NOT be closed by selecting a company.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
