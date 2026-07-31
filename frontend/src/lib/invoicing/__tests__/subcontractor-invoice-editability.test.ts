import {
  getSubcontractorInvoiceEditability,
  isSubcontractorInvoiceAccountingSynced,
} from "../subcontractor-invoice-editability";

describe("subcontractor invoice editability", () => {
  it("allows an unsynced under-review invoice to return to draft", () => {
    expect(
      getSubcontractorInvoiceEditability({
        status: "under_review",
        acumatica_ref_nbr: null,
        acumatica_doc_type: null,
        acumatica_sync_at: null,
        acumatica_ap_bill_id: null,
      }),
    ).toEqual({
      isAccountingSynced: false,
      canEdit: false,
      canReturnToDraft: true,
    });
  });

  it.each([
    ["acumatica_ref_nbr", "AP000123"],
    ["acumatica_doc_type", "Bill"],
    ["acumatica_sync_at", "2026-07-30T20:00:00.000Z"],
    ["acumatica_ap_bill_id", 123],
  ] as const)(
    "treats %s as an accounting sync marker",
    (field, value) => {
      const invoice = { status: "under_review", [field]: value };

      expect(isSubcontractorInvoiceAccountingSynced(invoice)).toBe(true);
      expect(
        getSubcontractorInvoiceEditability(invoice).canReturnToDraft,
      ).toBe(false);
    },
  );

  it.each(["draft", "invited", "revise_and_resubmit"])(
    "keeps %s invoices editable",
    (status) => {
      expect(
        getSubcontractorInvoiceEditability({ status }),
      ).toMatchObject({
        canEdit: true,
        canReturnToDraft: false,
      });
    },
  );

  it.each(["draft", "invited", "revise_and_resubmit"])(
    "blocks editing a synced %s invoice",
    (status) => {
      expect(
        getSubcontractorInvoiceEditability({
          status,
          acumatica_ref_nbr: "AP000123",
        }),
      ).toMatchObject({
        isAccountingSynced: true,
        canEdit: false,
        canReturnToDraft: false,
      });
    },
  );

  it.each(["approved", "approved_as_noted", "paid", "void"])(
    "does not reopen terminal status %s",
    (status) => {
      expect(
        getSubcontractorInvoiceEditability({ status }),
      ).toMatchObject({
        canEdit: false,
        canReturnToDraft: false,
      });
    },
  );
});
