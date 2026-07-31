/**
 * Regression tests for subcontract data-mapping utilities.
 *
 * Regression: subcontract create started writing `accounting_method`, but the
 * linked `subcontracts` table does not have that column. PostgREST returned
 * PGRST204 and subcontract creation failed at runtime.
 */

import { mapFormToInsert, mapRowToDisplay } from "@/lib/db/subcontracts";
import type { Database } from "@/types/database.types";

type SubcontractRow = Database["public"]["Tables"]["subcontracts"]["Row"];

const BASE_FORM = {
  contractNumber: "SC-001",
  status: "Draft",
};
const PROJECT_ID = 1;
const USER_ID = "user-1";

describe("mapFormToInsert", () => {
  it("does not write accounting_method even when the form includes it", () => {
    const result = mapFormToInsert(
      { ...BASE_FORM, accountingMethod: "unit_quantity" },
      PROJECT_ID,
      USER_ID,
    );
    expect("accounting_method" in result).toBe(false);
  });

  it("does not write accounting_method when amount_based is selected", () => {
    const result = mapFormToInsert(
      { ...BASE_FORM, accountingMethod: "amount_based" },
      PROJECT_ID,
      USER_ID,
    );
    expect("accounting_method" in result).toBe(false);
  });

  it("still maps the required subcontract fields", () => {
    const result = mapFormToInsert({ ...BASE_FORM }, PROJECT_ID, USER_ID);
    expect(result).toMatchObject({
      project_id: PROJECT_ID,
      contract_number: "SC-001",
      status: "Draft",
      created_by: USER_ID,
    });
  });

  it("adds the SC prefix when the form omits it", () => {
    const result = mapFormToInsert(
      { ...BASE_FORM, contractNumber: "001" },
      PROJECT_ID,
      USER_ID,
    );
    expect(result.contract_number).toBe("SC-001");
  });
});

describe("mapRowToDisplay", () => {
  const BASE_ROW: SubcontractRow = {
    id: "row-1",
    project_id: 1,
    contract_number: "SC-001",
    status: "Draft",
    executed: false,
    contract_company_id: null,
    title: null,
    default_retainage_percent: null,
    description: null,
    inclusions: null,
    exclusions: null,
    start_date: null,
    estimated_completion_date: null,
    actual_completion_date: null,
    contract_date: null,
    signed_contract_received_date: null,
    issued_on_date: null,
    is_private: true,
    non_admin_user_ids: [],
    allow_non_admin_view_sov_items: false,
    invoice_contact_ids: [],
    created_by: "user-1",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    acumatica_external_key: null,
    assigned_to: null,
    bill_to: null,
    deleted_at: null,
  } as unknown as SubcontractRow;

  it("defaults accountingMethod to amount_based for the form layer", () => {
    const result = mapRowToDisplay(BASE_ROW);
    expect(result.accountingMethod).toBe("amount_based");
  });

  it("keeps persisted subcontract fields intact", () => {
    const result = mapRowToDisplay(BASE_ROW);
    expect(result.contractNumber).toBe("SC-001");
    expect(result.status).toBe("Draft");
  });
});
