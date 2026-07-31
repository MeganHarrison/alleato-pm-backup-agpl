/**
 * REGRESSION GUARD — commitment SOV unit/quantity pricing must persist.
 *
 * The subcontract SOV form has a "unit/quantity" accounting method that collects
 * quantity, unit cost and unit of measure per line. The create route never wrote
 * those three columns — only the extended `amount` survived — so a subcontract
 * entered as 100 EA @ $25 came back as a bare $2,500 with the unit detail gone.
 * The purchase-order create route had always persisted them, which is what made
 * the omission obvious.
 *
 * These tests read the row back from the database rather than trusting the API
 * response, because the original bug produced a perfectly successful response.
 */
import { expect, test } from "../../fixtures/index";
import { createClient } from "@supabase/supabase-js";

const PROJECT_ID = 67;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

test.describe("Commitment SOV unit pricing", () => {
  const createdSubcontractIds: string[] = [];
  let contractCompanyId: string;
  let projectBudgetCodeId: string;

  test.beforeAll(async () => {
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id")
      .limit(1)
      .single();
    contractCompanyId = company!.id;

    // A non-zero SOV row without a budget code is rejected by a CHECK constraint.
    const { data: budgetCode } = await supabaseAdmin
      .from("project_budget_codes")
      .select("id")
      .eq("project_id", PROJECT_ID)
      .limit(1)
      .single();
    projectBudgetCodeId = budgetCode!.id;
  });

  test.afterAll(async () => {
    for (const id of createdSubcontractIds) {
      await supabaseAdmin.from("subcontract_sov_items").delete().eq("subcontract_id", id);
      await supabaseAdmin.from("subcontracts").delete().eq("id", id);
    }
  });

  test("subcontract create persists quantity, unit cost and unit of measure", async ({
    authenticatedRequest,
  }) => {
    const contractNumber = `SC-UNIT-${Date.now()}`;

    const response = await authenticatedRequest.post(
      `/api/projects/${PROJECT_ID}/subcontracts`,
      {
        data: {
          contractNumber,
          title: "Unit pricing guard",
          status: "Draft",
          executed: false,
          contractCompanyId,
          accountingMethod: "unit_quantity",
          dates: {},
          privacy: { isPrivate: true, allowNonAdminViewSovItems: false },
          sov: [
            {
              lineNumber: 1,
              description: "Concrete placement",
              projectBudgetCodeId,
              quantity: 100,
              unitCost: 25,
              unitOfMeasure: "EA",
              amount: 2500,
            },
          ],
        },
      },
    );

    expect(response.ok(), `create failed: ${await response.text()}`).toBe(true);
    const body = await response.json();
    const subcontractId = body?.data?.id as string | undefined;
    expect(subcontractId, "created subcontract should return an id").toBeTruthy();
    createdSubcontractIds.push(subcontractId!);

    // Read back from the database — the API response is not the source of truth here.
    const { data: rows, error } = await supabaseAdmin
      .from("subcontract_sov_items")
      .select("line_number, amount, quantity, unit_cost, unit_of_measure")
      .eq("subcontract_id", subcontractId!)
      .order("line_number");

    expect(error, `SOV read-back failed: ${error?.message}`).toBeNull();
    expect(rows, "one SOV line should have been created").toHaveLength(1);

    const line = rows![0];
    expect(Number(line.amount), "extended amount").toBe(2500);
    expect(
      Number(line.quantity),
      "quantity must persist — it was silently dropped before this guard",
    ).toBe(100);
    expect(
      Number(line.unit_cost),
      "unit cost must persist — it was silently dropped before this guard",
    ).toBe(25);
    expect(
      line.unit_of_measure,
      "unit of measure must persist — it was silently dropped before this guard",
    ).toBe("EA");
  });
});
