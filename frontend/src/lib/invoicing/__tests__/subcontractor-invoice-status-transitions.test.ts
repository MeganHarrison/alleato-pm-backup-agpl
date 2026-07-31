import { getSubcontractorInvoiceStatusTransitions } from "../subcontractor-invoice-status-transitions";

describe("getSubcontractorInvoiceStatusTransitions", () => {
  it("offers only 'submit' from the editable pre-review states", () => {
    for (const status of ["draft", "invited", "revise_and_resubmit"]) {
      const transitions = getSubcontractorInvoiceStatusTransitions(status);
      expect(transitions.map((t) => t.action)).toEqual(["submit"]);
    }
  });

  it("offers the four review decisions from under_review, each mapped to its endpoint", () => {
    const transitions = getSubcontractorInvoiceStatusTransitions("under_review");
    expect(transitions.map((t) => t.action)).toEqual([
      "approve",
      "approve-as-noted",
      "pending-owner-approval",
      "revise",
    ]);
  });

  it("offers 'approve' (record owner approval) from pending_owner_approval", () => {
    const transitions = getSubcontractorInvoiceStatusTransitions(
      "pending_owner_approval",
    );
    expect(transitions.map((t) => t.action)).toEqual(["approve"]);
  });

  it("treats terminal / non-inline statuses as read-only (no transitions)", () => {
    // approved/approved_as_noted/paid are terminal in-app (mark-paid disabled,
    // payments sync from Acumatica); void and not_invited are not inline-editable.
    for (const status of [
      "approved",
      "approved_as_noted",
      "paid",
      "void",
      "not_invited",
    ]) {
      expect(getSubcontractorInvoiceStatusTransitions(status)).toEqual([]);
    }
  });

  it("returns no transitions for null / undefined / unknown status", () => {
    expect(getSubcontractorInvoiceStatusTransitions(null)).toEqual([]);
    expect(getSubcontractorInvoiceStatusTransitions(undefined)).toEqual([]);
    expect(getSubcontractorInvoiceStatusTransitions("something_else")).toEqual(
      [],
    );
  });

  it("never routes an inline transition through the disabled mark-paid endpoint", () => {
    const allActions = [
      "draft",
      "invited",
      "revise_and_resubmit",
      "under_review",
      "pending_owner_approval",
      "approved",
      "approved_as_noted",
      "paid",
    ].flatMap((status) =>
      getSubcontractorInvoiceStatusTransitions(status).map((t) => t.action),
    );
    expect(allActions).not.toContain("mark-paid");
  });
});
