import { mapCommitmentPcoLineItemToCoLine } from "../commitment-pco-promotion-line-items";

describe("commitment PCO promotion line item mapping", () => {
  it("maps PCO amount and budget line into a commitment change order line", () => {
    expect(
      mapCommitmentPcoLineItemToCoLine("co-1", {
        budget_code_id: "budget-line-1",
        description: "Added framing",
        amount: "1250.75",
      }),
    ).toEqual({
      commitment_change_order_id: "co-1",
      budget_line_id: "budget-line-1",
      description: "Added framing",
      amount: 1250.75,
    });
  });

  it("uses zero when the PCO amount is missing or invalid", () => {
    expect(
      mapCommitmentPcoLineItemToCoLine("co-1", {
        budget_code_id: null,
        description: null,
        amount: "not-a-number",
      }),
    ).toEqual({
      commitment_change_order_id: "co-1",
      budget_line_id: null,
      description: null,
      amount: 0,
    });
  });
});
