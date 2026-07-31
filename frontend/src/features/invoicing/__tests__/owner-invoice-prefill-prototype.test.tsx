/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";

import {
  buildPrefillPreview,
  OwnerInvoicePrefillPrototype,
} from "../owner-invoice-prefill-prototype";

describe("buildPrefillPreview", () => {
  it("includes eligible source costs and excludes draft, outside-period, and unmatched records", () => {
    const preview = buildPrefillPreview({
      billingPeriodId: "june-2026",
      includeCosts: true,
      includeRetainage: false,
      includeBackup: false,
    });

    expect(preview.totals.currentPayment).toBe(125850);
    expect(preview.totals.retainage).toBe(0);
    expect(
      preview.decisions.find((source) => source.id === "SC-104")?.eligible,
    ).toBe(true);
    expect(
      preview.decisions.find((source) => source.id === "SC-412")?.reason,
    ).toMatch(/not an eligible/i);
    expect(
      preview.decisions.find((source) => source.id === "DC-443")?.reason,
    ).toMatch(/outside June 2026/i);
    expect(
      preview.decisions.find((source) => source.id === "CCO-32")?.reason,
    ).toMatch(/No owner SOV line/i);
  });

  it("adds retainage and backup only when their independent options are selected", () => {
    const preview = buildPrefillPreview({
      billingPeriodId: "june-2026",
      includeCosts: true,
      includeRetainage: true,
      includeBackup: true,
    });

    expect(preview.totals.retainage).toBe(11710);
    expect(preview.totals.netDue).toBe(114140);
    expect(preview.attachments).toHaveLength(6);
    expect(
      preview.attachments.some(
        (attachment) => attachment.sourceId === "CCO-14",
      ),
    ).toBe(false);
  });

  it("keeps backup independent when cost prefill is off", () => {
    const preview = buildPrefillPreview({
      billingPeriodId: "june-2026",
      includeCosts: false,
      includeRetainage: false,
      includeBackup: true,
    });

    expect(preview.totals.currentPayment).toBe(0);
    expect(preview.attachments).toHaveLength(6);
  });

  it("re-evaluates source dates for a different billing period", () => {
    const preview = buildPrefillPreview({
      billingPeriodId: "july-2026",
      includeCosts: true,
      includeRetainage: false,
      includeBackup: false,
    });

    expect(preview.totals.currentPayment).toBe(4900);
    expect(
      preview.decisions.find((source) => source.id === "DC-443")?.eligible,
    ).toBe(true);
    expect(
      preview.decisions.find((source) => source.id === "SC-104")?.reason,
    ).toMatch(/outside July 2026/i);
  });
});

describe("OwnerInvoicePrefillPrototype", () => {
  it("disables and clears retainage when cost prefill is turned off", () => {
    render(<OwnerInvoicePrefillPrototype />);

    const costPrefill = screen.getByRole("checkbox", {
      name: /pre-fill the SOV with costs/i,
    });
    const retainage = screen.getByRole("checkbox", {
      name: /also pre-fill retainage/i,
    });

    fireEvent.click(retainage);
    expect(retainage).toBeChecked();
    fireEvent.click(costPrefill);
    expect(retainage).not.toBeChecked();
    expect(retainage).toBeDisabled();
  });

  it("shows exact included and excluded reasons on demand", () => {
    render(<OwnerInvoicePrefillPrototype />);

    fireEvent.click(
      screen.getByRole("button", { name: /review source eligibility/i }),
    );

    expect(screen.getByText("Source eligibility")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Draft is not an eligible subcontractor invoice status/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/No owner SOV line matches/i)).toBeInTheDocument();
  });

  it("fails loudly when reset removes the required billing period", () => {
    render(<OwnerInvoicePrefillPrototype />);

    fireEvent.click(screen.getByRole("button", { name: /reset prototype/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /create draft preview/i }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      /Select a billing period/i,
    );
  });

  it("makes the non-persisted result and correction path explicit", () => {
    render(<OwnerInvoicePrefillPrototype />);

    fireEvent.click(
      screen.getByRole("button", { name: /create draft preview/i }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      /Draft preview created for June 2026. Nothing was saved/i,
    );
    expect(
      screen.getByRole("button", { name: /refresh draft preview/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reset prototype/i }),
    ).toBeInTheDocument();
  });
});
