import {
  createPrimeContract,
  PrimeContractCreationError,
  PrimeContractPersistenceError,
  type PrimeContractCreationStore,
} from "./create-prime-contract";
import type { Database } from "@/types/database.types";

type Tables = Database["public"]["Tables"];
type PrimeContractInsert = Tables["prime_contracts"]["Insert"];
type PrimeContractRow = Tables["prime_contracts"]["Row"];
type ContractLineItemInsert = Tables["contract_line_items"]["Insert"];
type ContractLineItemRow = Tables["contract_line_items"]["Row"];

const BASE_CONTRACT: PrimeContractInsert = {
  project_id: 42,
  contract_number: "PC-0042",
  title: "Owner contract",
  status: "draft",
  original_contract_value: 0,
  revised_contract_value: 0,
};

function primeContractRow(
  overrides: Partial<PrimeContractRow> = {},
): PrimeContractRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    project_id: 42,
    contract_number: "PC-0042",
    title: "Owner contract",
    vendor_id: null,
    description: null,
    status: "draft",
    original_contract_value: 0,
    revised_contract_value: 0,
    start_date: null,
    end_date: null,
    retention_percentage: 0,
    payment_terms: null,
    billing_schedule: null,
    created_by: "22222222-2222-4222-8222-222222222222",
    created_at: "2026-07-18T00:00:00.000Z",
    updated_at: "2026-07-18T00:00:00.000Z",
    executed_at: null,
    contractor_id: null,
    architect_engineer_id: null,
    contract_company_id: null,
    substantial_completion_date: null,
    actual_completion_date: null,
    signed_contract_received_date: null,
    contract_termination_date: null,
    is_private: false,
    inclusions: null,
    exclusions: null,
    executed: false,
    client_id: null,
    erp_status: "unsynced",
    allowed_user_ids: [],
    allow_sov_view: false,
    estimate_id: null,
    estimate_version: null,
    last_synced_from_estimate_at: null,
    ...overrides,
  };
}

function lineItemRow(
  payload: ContractLineItemInsert,
): ContractLineItemRow {
  return {
    id: `line-${payload.line_number}`,
    contract_id: payload.contract_id,
    line_number: payload.line_number,
    description: payload.description,
    cost_code_id: payload.cost_code_id ?? null,
    budget_code_id: payload.budget_code_id ?? null,
    quantity: payload.quantity ?? 0,
    unit_of_measure: payload.unit_of_measure ?? null,
    unit_cost: payload.unit_cost ?? 0,
    total_cost: Number(payload.quantity ?? 0) * Number(payload.unit_cost ?? 0),
    markup_type: payload.markup_type ?? null,
    created_at: "2026-07-18T00:00:00.000Z",
    updated_at: "2026-07-18T00:00:00.000Z",
  };
}

function createStore({
  existing = null,
  failLineNumber,
}: {
  existing?: Pick<PrimeContractRow, "id"> | null;
  failLineNumber?: number;
} = {}) {
  const contractInserts: PrimeContractInsert[] = [];
  const lineItemInserts: ContractLineItemInsert[] = [];

  const store: PrimeContractCreationStore = {
    async findContractByNumber() {
      return existing;
    },
    async insertContract(payload) {
      contractInserts.push(payload);
      return primeContractRow({
        ...payload,
        id: "11111111-1111-4111-8111-111111111111",
      });
    },
    async insertLineItem(payload) {
      lineItemInserts.push(payload);
      if (payload.line_number === failLineNumber) {
        throw new Error("Budget code is not valid for this project.");
      }
      return lineItemRow(payload);
    },
  };

  return { store, contractInserts, lineItemInserts };
}

describe("createPrimeContract", () => {
  it("derives the contract value and creates SOV rows through one boundary", async () => {
    const { store, contractInserts, lineItemInserts } = createStore();

    const result = await createPrimeContract({
      store,
      userId: "22222222-2222-4222-8222-222222222222",
      contract: BASE_CONTRACT,
      lineItems: [
        {
          line_number: 1,
          description: "General conditions",
          quantity: 1,
          unit_cost: 12_500,
        },
        {
          line_number: 2,
          description: "Concrete",
          quantity: 2,
          unit_cost: 18_750,
        },
      ],
    });

    expect(contractInserts[0]).toMatchObject({
      project_id: 42,
      contract_number: "PC-0042",
      original_contract_value: 50_000,
      revised_contract_value: 50_000,
      created_by: "22222222-2222-4222-8222-222222222222",
    });
    expect(lineItemInserts.map((line) => line.contract_id)).toEqual([
      result.contract.id,
      result.contract.id,
    ]);
    expect(result.receipt).toMatchObject({
      status: "complete",
      totalValue: 50_000,
      lineItems: { attempted: 2, created: 2, failed: [] },
    });
  });

  it("blocks duplicate contract numbers before writing", async () => {
    const { store, contractInserts } = createStore({
      existing: { id: "existing-contract" },
    });

    await expect(
      createPrimeContract({
        store,
        userId: "22222222-2222-4222-8222-222222222222",
        contract: BASE_CONTRACT,
      }),
    ).rejects.toMatchObject<Partial<PrimeContractCreationError>>({
      code: "DUPLICATE_CONTRACT_NUMBER",
    });
    expect(contractInserts).toEqual([]);
  });

  it("rejects duplicate SOV line numbers before creating the base contract", async () => {
    const { store, contractInserts } = createStore();

    await expect(
      createPrimeContract({
        store,
        userId: "22222222-2222-4222-8222-222222222222",
        contract: BASE_CONTRACT,
        lineItems: [
          { line_number: 1, description: "One", quantity: 1, unit_cost: 10 },
          { line_number: 1, description: "Two", quantity: 1, unit_cost: 20 },
        ],
      }),
    ).rejects.toMatchObject<Partial<PrimeContractCreationError>>({
      code: "INVALID_LINE_ITEMS",
    });
    expect(contractInserts).toEqual([]);
  });

  it("returns an actionable partial receipt when an SOV row fails", async () => {
    const { store } = createStore({ failLineNumber: 2 });

    const result = await createPrimeContract({
      store,
      userId: "22222222-2222-4222-8222-222222222222",
      contract: BASE_CONTRACT,
      lineItems: [
        { line_number: 1, description: "One", quantity: 1, unit_cost: 10 },
        { line_number: 2, description: "Two", quantity: 1, unit_cost: 20 },
      ],
    });

    expect(result.receipt).toMatchObject({
      status: "partial",
      contractId: result.contract.id,
      lineItems: {
        attempted: 2,
        created: 1,
        failed: [
          {
            lineNumber: 2,
            description: "Two",
            message:
              "This SOV line could not be saved. Open the contract to retry it.",
            code: "SOV_LINE_INSERT_FAILED",
          },
        ],
      },
    });
  });

  it("keeps the creator authorized on a private prime contract", async () => {
    const { store, contractInserts } = createStore();

    await createPrimeContract({
      store,
      userId: "22222222-2222-4222-8222-222222222222",
      contract: {
        ...BASE_CONTRACT,
        is_private: true,
        allowed_user_ids: ["33333333-3333-4333-8333-333333333333"],
      },
    });

    expect(contractInserts[0].allowed_user_ids).toEqual([
      "33333333-3333-4333-8333-333333333333",
      "22222222-2222-4222-8222-222222222222",
    ]);
  });

  it("maps database constraint failures to safe recovery messages", async () => {
    const { store } = createStore();
    store.insertLineItem = async () => {
      throw new PrimeContractPersistenceError(
        'insert or update on table "contract_line_items" violates foreign key constraint',
        "23503",
      );
    };

    const result = await createPrimeContract({
      store,
      userId: "22222222-2222-4222-8222-222222222222",
      contract: BASE_CONTRACT,
      lineItems: [
        { line_number: 1, description: "One", quantity: 1, unit_cost: 10 },
      ],
    });

    expect(result.receipt.lineItems.failed).toEqual([
      {
        lineNumber: 1,
        description: "One",
        message:
          "Invalid budget code: the selected code does not exist for this project.",
        code: "INVALID_BUDGET_CODE",
      },
    ]);
    expect(JSON.stringify(result.receipt)).not.toContain("foreign key");
  });

  it("prevents approved zero-dollar contracts", async () => {
    const { store, contractInserts } = createStore();

    await expect(
      createPrimeContract({
        store,
        userId: "22222222-2222-4222-8222-222222222222",
        contract: { ...BASE_CONTRACT, status: "approved" },
      }),
    ).rejects.toMatchObject<Partial<PrimeContractCreationError>>({
      code: "APPROVED_CONTRACT_REQUIRES_VALUE",
    });
    expect(contractInserts).toEqual([]);
  });
});
