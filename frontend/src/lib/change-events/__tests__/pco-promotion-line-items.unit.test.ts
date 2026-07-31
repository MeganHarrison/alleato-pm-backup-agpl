import { mapPrimePcoLineItemToPccoLineItem } from "../pco-promotion-line-items";

describe("PCO promotion line item mapping", () => {
  it("preserves the PCO amount through generated PCCO line_amount math", () => {
    const mapped = mapPrimePcoLineItemToPccoLineItem(2343, {
      description: "Patch floor",
      budget_code_id: "budget-line-id",
      quantity: 4,
      unit_cost: 100,
      unit_of_measure: "SF",
      amount: 250,
    });

    expect(mapped).toEqual({
      pcco_id: 2343,
      description: "Patch floor",
      cost_code: "budget-line-id",
      quantity: 4,
      unit_cost: 62.5,
      uom: "SF",
    });
    expect(mapped.quantity * mapped.unit_cost).toBe(250);
  });

  it("uses one unit when the source quantity is missing or zero", () => {
    const mapped = mapPrimePcoLineItemToPccoLineItem(2343, {
      description: "Door",
      budget_code_id: null,
      quantity: 0,
      unit_cost: null,
      unit_of_measure: null,
      amount: "10475.00",
    });

    expect(mapped.quantity).toBe(1);
    expect(mapped.unit_cost).toBe(10475);
  });
});
