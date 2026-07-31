import { createContractRequestSchema } from "./validation";

describe("createContractRequestSchema", () => {
  it("preserves privacy controls and validates nested SOV lines", () => {
    const parsed = createContractRequestSchema.parse({
      project_id: 42,
      contract_number: "PC-0042",
      title: "Owner contract",
      original_contract_value: 25_000,
      allowed_user_ids: ["11111111-1111-4111-8111-111111111111"],
      allow_sov_view: true,
      line_items: [
        {
          line_number: 1,
          description: "General conditions",
          quantity: 1,
          unit_cost: 25_000,
          budget_code_id: "22222222-2222-4222-8222-222222222222",
        },
      ],
    });

    expect(parsed).toMatchObject({
      allowed_user_ids: ["11111111-1111-4111-8111-111111111111"],
      allow_sov_view: true,
      line_items: [
        {
          line_number: 1,
          description: "General conditions",
          quantity: 1,
          unit_cost: 25_000,
          budget_code_id: "22222222-2222-4222-8222-222222222222",
        },
      ],
    });
  });

  it("rejects invalid nested budget-code links before creating a contract", () => {
    const parsed = createContractRequestSchema.safeParse({
      project_id: 42,
      contract_number: "PC-0042",
      title: "Owner contract",
      original_contract_value: 25_000,
      line_items: [
        {
          line_number: 1,
          description: "General conditions",
          quantity: 1,
          unit_cost: 25_000,
          budget_code_id: "not-a-uuid",
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });
});
