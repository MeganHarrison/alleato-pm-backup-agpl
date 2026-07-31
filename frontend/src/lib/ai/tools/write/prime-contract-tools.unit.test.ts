jest.mock("ai", () => ({
  tool: jest.fn((definition) => definition),
}));

import type { ActionToolInternals } from "./action-tool-internals";
import {
  buildPrimeContractDraftWidget,
  createPrimeContractWriteTools,
} from "./prime-contract-tools";
import {
  createPrimeContract,
  createSupabasePrimeContractCreationStore,
} from "@/lib/prime-contracts/create-prime-contract";
import {
  hasPermission,
  loadUserPermissionsWithClient,
} from "@/lib/permissions";

jest.mock("@/lib/permissions", () => ({
  hasPermission: jest.fn(),
  loadUserPermissionsWithClient: jest.fn(),
}));

jest.mock("@/lib/prime-contracts/create-prime-contract", () => {
  const actual = jest.requireActual(
    "@/lib/prime-contracts/create-prime-contract",
  );
  return {
    ...actual,
    createPrimeContract: jest.fn(),
    createSupabasePrimeContractCreationStore: jest.fn(() => ({ store: true })),
  };
});

const mockedCreatePrimeContract = createPrimeContract as jest.MockedFunction<
  typeof createPrimeContract
>;
const mockedCreateStore =
  createSupabasePrimeContractCreationStore as jest.MockedFunction<
    typeof createSupabasePrimeContractCreationStore
  >;
const mockedHasPermission = hasPermission as jest.MockedFunction<
  typeof hasPermission
>;
const mockedLoadPermissions =
  loadUserPermissionsWithClient as jest.MockedFunction<
    typeof loadUserPermissionsWithClient
  >;

const USER_ID = "00000000-0000-0000-0000-000000000001";
const OWNER_ID = "00000000-0000-0000-0000-000000000002";
const CONTRACT_ID = "00000000-0000-0000-0000-000000000003";
const BUDGET_LINE_ID = "00000000-0000-0000-0000-000000000005";
const BUDGET_CODE_ID = "00000000-0000-0000-0000-000000000006";
const SECOND_BUDGET_CODE_ID = "00000000-0000-0000-0000-000000000007";
const LABOR_TYPE_ID = "00000000-0000-0000-0000-000000000008";
const EXPENSE_TYPE_ID = "00000000-0000-0000-0000-000000000010";
const THIRD_BUDGET_CODE_ID = "00000000-0000-0000-0000-000000000011";

function supabaseStub(options: {
  ownerRows?: Array<{ id: string; name: string }>;
  contractNumbers?: string[];
  budgetRows?: Array<{
    id: string;
    project_budget_code_id: string | null;
    cost_code_id: string;
    description: string | null;
    original_amount: number;
    quantity: number | null;
    unit_cost: number | null;
    unit_of_measure: string | null;
  }>;
  projectBudgetCodes?: Array<{
    id: string;
    cost_code_id?: string;
    cost_type_id?: string | null;
  }>;
  costTypes?: Array<{ id: string; code: string }>;
  savedMarkups?: Array<{
    id: string;
    markup_type: string;
    percentage: number;
    compound: boolean;
    calculation_order: number;
  }>;
} = {}) {
  const ownerRows = options.ownerRows ?? [{ id: OWNER_ID, name: "Westfield Owner LLC" }];
  const contractNumbers = options.contractNumbers ?? ["PC-0003", "Legacy-1"];
  const budgetRows = options.budgetRows ?? [];
  const projectBudgetCodes = options.projectBudgetCodes ?? [];
  const costTypes = options.costTypes ?? [];
  const savedMarkups = options.savedMarkups ?? [];
  return {
    from: jest.fn((table: string) => {
      if (table === "user_profiles") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { is_admin: true },
                error: null,
              }),
            })),
          })),
        };
      }
      if (table === "prime_contracts") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              limit: jest.fn().mockResolvedValue({
                data: contractNumbers.map((contract_number) => ({ contract_number })),
                error: null,
              }),
            })),
          })),
        };
      }
      if (table === "companies") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({
                data: ownerRows[0] ?? null,
                error: null,
              }),
            })),
            ilike: jest.fn(() => ({
              limit: jest.fn().mockResolvedValue({ data: ownerRows, error: null }),
            })),
          })),
        };
      }
      if (table === "budget_lines") {
        const terminal = {
          in: jest.fn(() => terminal),
          limit: jest.fn().mockResolvedValue({ data: budgetRows, error: null }),
        };
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => terminal),
            })),
          })),
        };
      }
      if (table === "project_budget_codes") {
        const terminal = {
          in: jest.fn(() => terminal),
          limit: jest.fn().mockResolvedValue({
            data: projectBudgetCodes,
            error: null,
          }),
        };
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => terminal),
            })),
          })),
        };
      }
      if (table === "cost_code_types") {
        const terminal = {
          limit: jest.fn().mockResolvedValue({ data: costTypes, error: null }),
        };
        return {
          select: jest.fn(() => ({
            in: jest.fn(() => terminal),
          })),
        };
      }
      if (table === "vertical_markup") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue({
                  data: savedMarkups,
                  error: null,
                }),
              })),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  } as unknown as ActionToolInternals["supabase"];
}

function internals(
  supabase: ActionToolInternals["supabase"] = supabaseStub(),
): ActionToolInternals {
  return {
    userId: USER_ID,
    options: {},
    supabase,
    enforceProjectWriteAccess: jest.fn().mockResolvedValue({
      ok: true,
      projectId: 43,
    }),
    resolveIdempotencyKey: jest.fn(() => "prime-contract-idempotency"),
    getReplayResponse: jest.fn().mockResolvedValue(null),
    recordWriteAudit: jest.fn().mockResolvedValue(undefined),
    finalizeWriteAudit: jest.fn().mockResolvedValue(undefined),
    failWriteAudit: jest.fn().mockResolvedValue(undefined),
  } as unknown as ActionToolInternals;
}

function sovEditSupabaseStub(options: {
  contractStatus?: string;
  isPrivate?: boolean;
  allowedUserIds?: string[];
  createdBy?: string | null;
  projectBudgetCodes?: Array<{
    id: string;
    cost_code_id: string;
    cost_type_id: string | null;
    description: string;
  }>;
  budgetLines?: Array<{
    project_budget_code_id: string | null;
    cost_code_id: string;
    cost_type_id: string;
    original_amount: number;
  }>;
  costTypes?: Array<{ id: string; code: string; description: string }>;
  rpcError?: { message: string; code?: string } | null;
} = {}) {
  const contract = {
    id: CONTRACT_ID,
    project_id: 43,
    contract_number: "PC-0004",
    title: "Westfield Construction Agreement",
    status: options.contractStatus ?? "draft",
    executed: false,
    original_contract_value: 1000,
    revised_contract_value: 1000,
    is_private: options.isPrivate ?? false,
    allowed_user_ids: options.allowedUserIds ?? [],
    created_by: options.createdBy ?? OWNER_ID,
    updated_at: "2026-07-22T15:00:00.000Z",
  };
  const existingRows = [
    {
      id: "00000000-0000-0000-0000-000000000009",
      contract_id: CONTRACT_ID,
      line_number: 1,
      description: "Vice President",
      budget_code_id: BUDGET_CODE_ID,
      cost_code_id: "01-3120",
      quantity: 1,
      unit_cost: 1000,
      unit_of_measure: "EA",
      markup_type: null,
      updated_at: "2026-07-22T14:00:00.000Z",
    },
  ];
  const projectBudgetCodes = options.projectBudgetCodes ?? [
    {
      id: BUDGET_CODE_ID,
      cost_code_id: "01-3120",
      cost_type_id: LABOR_TYPE_ID,
      description: "Vice President",
    },
    {
      id: SECOND_BUDGET_CODE_ID,
      cost_code_id: "01-3127",
      cost_type_id: LABOR_TYPE_ID,
      description: "Project Manager",
    },
  ];
  const costTypes = options.costTypes ?? [
    { id: LABOR_TYPE_ID, code: "L", description: "Labor" },
  ];
  const budgetLines = options.budgetLines ?? [
    {
      project_budget_code_id: BUDGET_CODE_ID,
      cost_code_id: "01-3120",
      cost_type_id: LABOR_TYPE_ID,
      original_amount: 5000,
    },
    {
      project_budget_code_id: SECOND_BUDGET_CODE_ID,
      cost_code_id: "01-3127",
      cost_type_id: LABOR_TYPE_ID,
      original_amount: 19050,
    },
  ];
  const rpc = jest.fn().mockResolvedValue({
    data: options.rpcError
      ? null
      : {
          sovTotal: 24050,
          updatedRows: 1,
          appendedRows: 1,
          contractUpdatedAt: "2026-07-22T15:01:00.000Z",
        },
    error: options.rpcError ?? null,
  });
  const from = jest.fn((table: string) => {
    if (table === "prime_contracts") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({ data: contract, error: null }),
            })),
          })),
        })),
      };
    }
    if (table === "contract_line_items") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn().mockResolvedValue({ data: existingRows, error: null }),
          })),
        })),
      };
    }
    if (table === "project_budget_codes") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              limit: jest.fn().mockResolvedValue({
                data: projectBudgetCodes,
                error: null,
              }),
            })),
          })),
        })),
      };
    }
    if (table === "budget_lines") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue({
              data: budgetLines,
              error: null,
            }),
          })),
        })),
      };
    }
    if (table === "cost_code_types") {
      return {
        select: jest.fn(() => ({
          in: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue({ data: costTypes, error: null }),
          })),
        })),
      };
    }
    throw new Error(`Unexpected SOV edit table: ${table}`);
  });

  return {
    supabase: { from, rpc } as unknown as ActionToolInternals["supabase"],
    from,
    rpc,
  };
}

function sovEditInput(overrides: Record<string, unknown> = {}) {
  return {
    projectId: 43,
    contractId: CONTRACT_ID,
    rows: [
      {
        costCode: "013120",
        costType: "Labor",
        description: "Vice President",
        amount: 5000,
      },
      {
        costCode: "01-3127",
        costType: "L",
        description: "Project Manager",
        amount: 19050,
      },
    ],
    confirmed: false,
    ...overrides,
  };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    projectId: 43,
    title: "Westfield Construction Agreement",
    ownerCompanyName: "Westfield Owner LLC",
    status: "draft" as const,
    retentionPercentage: 10,
    isPrivate: false,
    allowedUserIds: [],
    allowSovView: false,
    sovSource: "manual" as const,
    lineItems: [
      {
        description: "General conditions",
        amount: 125000,
      },
    ],
    confirmed: false,
    ...overrides,
  };
}

describe("Prime Contract assistant write tool", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLoadPermissions.mockResolvedValue({ isAdmin: true } as never);
    mockedHasPermission.mockReturnValue(true);
  });

  it("returns a no-write draft with the next contract number", async () => {
    const dependencies = internals();
    const execute = createPrimeContractWriteTools(dependencies).createPrimeContract.execute;
    if (!execute) throw new Error("createPrimeContract execute was not registered");

    const output = await execute(input());

    expect(output).toMatchObject({
      success: true,
      action: "preview",
      widget: {
        type: "prime_contract_draft",
        status: "draft",
        contractNumber: "PC-0004",
        totalAmount: 125000,
        plannedWrites: { contractRows: 1, sovRows: 1 },
      },
    });
    expect(mockedCreatePrimeContract).not.toHaveBeenCalled();
    expect(dependencies.recordWriteAudit).not.toHaveBeenCalled();
  });

  it("treats model-emitted zero quantity and unit-cost placeholders as amount-only input", async () => {
    const dependencies = internals();
    const execute = createPrimeContractWriteTools(dependencies).createPrimeContract.execute;
    if (!execute) throw new Error("createPrimeContract execute was not registered");

    const output = await execute(
      input({
        lineItems: [
          {
            description: "General conditions",
            amount: 1234,
            quantity: 0,
            unitCost: 0,
          },
        ],
      }),
    );

    expect(output).toMatchObject({
      success: true,
      action: "preview",
      widget: { totalAmount: 1234, validation: expect.not.arrayContaining([
        expect.objectContaining({ status: "fail" }),
      ]) },
    });
  });

  it("shows saved project markups without adding synthetic SOV rows", async () => {
    const dependencies = internals(
      supabaseStub({
        savedMarkups: [
          {
            id: "markup-1",
            markup_type: "fee",
            percentage: 5,
            compound: false,
            calculation_order: 1,
          },
        ],
      }),
    );
    const execute = createPrimeContractWriteTools(dependencies).createPrimeContract.execute;
    if (!execute) throw new Error("createPrimeContract execute was not registered");

    const output = await execute(input());

    expect(output).toMatchObject({
      widget: {
        savedMarkups: [
          {
            id: "markup-1",
            markupType: "fee",
            percentage: 5,
            compound: false,
          },
        ],
        plannedWrites: { contractRows: 1, sovRows: 1 },
        lineItems: [expect.objectContaining({ description: "General conditions" })],
      },
    });
  });

  it("blocks an ambiguous owner instead of guessing", async () => {
    const dependencies = internals(
      supabaseStub({
        ownerRows: [
          { id: OWNER_ID, name: "Westfield Owner LLC" },
          {
            id: "00000000-0000-0000-0000-000000000004",
            name: "Westfield Owner LLC",
          },
        ],
      }),
    );
    const execute = createPrimeContractWriteTools(dependencies).createPrimeContract.execute;
    if (!execute) throw new Error("createPrimeContract execute was not registered");

    const output = await execute(input());

    expect(output).toMatchObject({
      success: false,
      action: "blocked",
      widget: {
        status: "blocked",
        validation: expect.arrayContaining([
          expect.objectContaining({ label: "Owner / client", status: "fail" }),
        ]),
      },
    });
    expect(mockedCreatePrimeContract).not.toHaveBeenCalled();
  });

  it("blocks a single fuzzy owner match until the exact company is selected", async () => {
    const dependencies = internals();
    const execute = createPrimeContractWriteTools(dependencies).createPrimeContract.execute;
    if (!execute) throw new Error("createPrimeContract execute was not registered");

    const output = await execute(input({ ownerCompanyName: "Westfield" }));

    expect(output).toMatchObject({
      success: false,
      action: "blocked",
      widget: {
        status: "blocked",
        validation: expect.arrayContaining([
          expect.objectContaining({
            label: "Owner / client",
            status: "fail",
            message: expect.stringContaining("not an exact company name"),
          }),
        ]),
      },
    });
    expect(mockedCreatePrimeContract).not.toHaveBeenCalled();
  });

  it("blocks creation when no owner/client is provided", async () => {
    const dependencies = internals();
    const execute = createPrimeContractWriteTools(dependencies).createPrimeContract.execute;
    if (!execute) throw new Error("createPrimeContract execute was not registered");

    const output = await execute(input({ ownerCompanyName: undefined }));

    expect(output).toMatchObject({
      success: false,
      action: "blocked",
      widget: {
        status: "blocked",
        validation: expect.arrayContaining([
          expect.objectContaining({
            label: "Owner / client",
            status: "fail",
            message: "No owner/client is linked yet.",
          }),
        ]),
      },
    });
    expect(mockedCreatePrimeContract).not.toHaveBeenCalled();
  });

  it("builds a budget-backed SOV from project-scoped budget lines", async () => {
    const dependencies = internals(
      supabaseStub({
        budgetRows: [
          {
            id: BUDGET_LINE_ID,
            project_budget_code_id: BUDGET_CODE_ID,
            cost_code_id: "03-3000",
            description: "Cast-in-place concrete",
            original_amount: 250000,
            quantity: 10,
            unit_cost: 25000,
            unit_of_measure: "LS",
          },
        ],
      }),
    );
    const execute = createPrimeContractWriteTools(dependencies).createPrimeContract.execute;
    if (!execute) throw new Error("createPrimeContract execute was not registered");

    const output = await execute(
      input({ sovSource: "budget", budgetLineIds: [BUDGET_LINE_ID], lineItems: [] }),
    );

    expect(output).toMatchObject({
      success: true,
      action: "preview",
      widget: {
        sovSource: "budget",
        sourceLineIds: [BUDGET_LINE_ID],
        totalAmount: 250000,
        lineItems: [
          expect.objectContaining({
            budgetCodeId: BUDGET_CODE_ID,
            costCodeId: "03-3000",
            amount: 250000,
          }),
        ],
      },
    });
    expect(mockedCreatePrimeContract).not.toHaveBeenCalled();
  });

  it("blocks budget rows that lack a project budget-code link", async () => {
    const dependencies = internals(
      supabaseStub({
        budgetRows: [
          {
            id: BUDGET_LINE_ID,
            project_budget_code_id: null,
            cost_code_id: "03-3000",
            description: "Concrete",
            original_amount: 250000,
            quantity: null,
            unit_cost: null,
            unit_of_measure: null,
          },
        ],
      }),
    );
    const execute = createPrimeContractWriteTools(dependencies).createPrimeContract.execute;
    if (!execute) throw new Error("createPrimeContract execute was not registered");

    const output = await execute(
      input({ sovSource: "budget", budgetLineIds: [BUDGET_LINE_ID], lineItems: [] }),
    );

    expect(output).toMatchObject({
      success: false,
      action: "blocked",
      widget: {
        status: "blocked",
        validation: expect.arrayContaining([
          expect.objectContaining({
            label: "Budget source",
            status: "fail",
            message: expect.stringContaining("missing a project budget-code link"),
          }),
        ]),
      },
    });
    expect(mockedCreatePrimeContract).not.toHaveBeenCalled();
  });

  it("maps canonical workbook rows to exact active project budget codes", async () => {
    const dependencies = internals(
      supabaseStub({
        projectBudgetCodes: [
          {
            id: BUDGET_CODE_ID,
            cost_code_id: "03-3000",
            cost_type_id: "revenue-type",
          },
        ],
        costTypes: [{ id: "revenue-type", code: "R" }],
      }),
    );
    const execute = createPrimeContractWriteTools(dependencies).createPrimeContract.execute;
    if (!execute) throw new Error("createPrimeContract execute was not registered");

    const output = await execute(
      input({
        sovSource: "workbook",
        lineItems: [],
        workbookRows: [
          {
            sourceSheet: "Details",
            rowNumber: 2,
            costCode: "03-3000",
            costTypeCode: "R",
            description: "Concrete",
            workDescription: "Slab and footings",
            budgetAmount: 45000,
            unitQty: null,
            unitCost: null,
            unitOfMeasure: null,
            warnings: [],
          },
        ],
      }),
    );

    expect(output).toMatchObject({
      success: true,
      action: "preview",
      widget: {
        sovSource: "workbook",
        sourceLineIds: ["Details row 2"],
        totalAmount: 45000,
        lineItems: [
          expect.objectContaining({
            description: "Slab and footings",
            budgetCodeId: BUDGET_CODE_ID,
            costCodeId: "03-3000",
          }),
        ],
      },
    });
  });

  it("blocks workbook rows without an exact project cost-code and cost-type match", async () => {
    const dependencies = internals(supabaseStub());
    const execute = createPrimeContractWriteTools(dependencies).createPrimeContract.execute;
    if (!execute) throw new Error("createPrimeContract execute was not registered");

    const output = await execute(
      input({
        sovSource: "workbook",
        lineItems: [],
        workbookRows: [
          {
            sourceSheet: "Details",
            rowNumber: 2,
            costCode: "03-3000",
            costTypeCode: "R",
            description: "Concrete",
            budgetAmount: 45000,
            warnings: [],
          },
        ],
      }),
    );

    expect(output).toMatchObject({
      success: false,
      action: "blocked",
      widget: {
        validation: expect.arrayContaining([
          expect.objectContaining({
            label: "Workbook source",
            status: "fail",
            message: expect.stringContaining("no active project budget code matches"),
          }),
        ]),
      },
    });
    expect(mockedCreatePrimeContract).not.toHaveBeenCalled();
  });

  it("blocks a workbook preview when attachment rows were omitted", async () => {
    const dependencies = internals(
      supabaseStub({
        projectBudgetCodes: [
          {
            id: BUDGET_CODE_ID,
            cost_code_id: "03-3000",
            cost_type_id: "revenue-type",
          },
        ],
        costTypes: [{ id: "revenue-type", code: "R" }],
      }),
    );
    const execute = createPrimeContractWriteTools(dependencies).createPrimeContract.execute;
    if (!execute) throw new Error("createPrimeContract execute was not registered");

    const output = await execute(
      input({
        sovSource: "workbook",
        workbookOmittedRows: 3,
        lineItems: [],
        workbookRows: [
          {
            sourceSheet: "Details",
            rowNumber: 2,
            costCode: "03-3000",
            costTypeCode: "R",
            description: "Concrete",
            budgetAmount: 45000,
            warnings: [],
          },
        ],
      }),
    );

    expect(output).toMatchObject({
      success: false,
      action: "blocked",
      widget: {
        validation: expect.arrayContaining([
          expect.objectContaining({
            label: "Workbook source",
            status: "fail",
            message: expect.stringContaining("omitted by the attachment size limit"),
          }),
        ]),
      },
    });
    expect(mockedCreatePrimeContract).not.toHaveBeenCalled();
  });

  it("creates through the shared service and returns a canonical receipt link", async () => {
    mockedCreatePrimeContract.mockResolvedValue({
      contract: {
        id: CONTRACT_ID,
        project_id: 43,
        contract_number: "PC-0004",
        title: "Westfield Construction Agreement",
        status: "draft",
      },
      receipt: {
        status: "complete",
        contractId: CONTRACT_ID,
        contractNumber: "PC-0004",
        totalValue: 125000,
        lineItems: { attempted: 1, created: 1, failed: [] },
      },
    } as never);
    const dependencies = internals();
    const execute = createPrimeContractWriteTools(dependencies).createPrimeContract.execute;
    if (!execute) throw new Error("createPrimeContract execute was not registered");

    const output = await execute(input({ confirmed: true }));

    expect(mockedCreateStore).toHaveBeenCalledWith(dependencies.supabase);
    expect(mockedCreatePrimeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        contract: expect.objectContaining({
          project_id: 43,
          contract_number: "PC-0004",
          client_id: OWNER_ID,
          contract_company_id: OWNER_ID,
        }),
        lineItems: [
          expect.objectContaining({
            line_number: 1,
            description: "General conditions",
            quantity: 1,
            unit_cost: 125000,
          }),
        ],
      }),
    );
    expect(output).toMatchObject({
      success: true,
      action: "created",
      record: { id: CONTRACT_ID },
      widget: {
        status: "created",
        recordHref: `/${43}/prime-contracts/${CONTRACT_ID}`,
      },
    });
    expect(dependencies.recordWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending" }),
    );
    expect(dependencies.finalizeWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "prime-contract-idempotency",
        response: expect.objectContaining({ action: "created" }),
      }),
    );
  });

  it("replays an idempotent write before calling the creation service", async () => {
    const dependencies = internals();
    (dependencies.getReplayResponse as jest.Mock).mockResolvedValue({
      success: true,
      action: "created",
      record: { id: CONTRACT_ID },
    });
    const execute = createPrimeContractWriteTools(dependencies).createPrimeContract.execute;
    if (!execute) throw new Error("createPrimeContract execute was not registered");

    const output = await execute(input({ confirmed: true }));

    expect(output).toMatchObject({ record: { id: CONTRACT_ID } });
    expect(mockedCreatePrimeContract).not.toHaveBeenCalled();
  });

  it("does not write when the pre-write idempotency reservation fails", async () => {
    const dependencies = internals();
    (dependencies.recordWriteAudit as jest.Mock).mockRejectedValueOnce(
      new Error("audit unavailable"),
    );
    const execute = createPrimeContractWriteTools(dependencies).createPrimeContract.execute;
    if (!execute) throw new Error("createPrimeContract execute was not registered");

    const output = await execute(input({ confirmed: true }));

    expect(output).toMatchObject({
      success: false,
      action: "blocked",
      error: expect.stringContaining("was not created"),
    });
    expect(mockedCreatePrimeContract).not.toHaveBeenCalled();
  });

  it("leaves a replayable reservation when the final receipt audit fails", async () => {
    mockedCreatePrimeContract.mockResolvedValue({
      contract: {
        id: CONTRACT_ID,
        project_id: 43,
        contract_number: "PC-0004",
        title: "Westfield Construction Agreement",
        status: "draft",
      },
      receipt: {
        status: "complete",
        contractId: CONTRACT_ID,
        contractNumber: "PC-0004",
        totalValue: 125000,
        lineItems: { attempted: 1, created: 1, failed: [] },
      },
    } as never);
    const dependencies = internals();
    (dependencies.finalizeWriteAudit as jest.Mock).mockRejectedValueOnce(
      new Error("final audit unavailable"),
    );
    const execute = createPrimeContractWriteTools(dependencies).createPrimeContract.execute;
    if (!execute) throw new Error("createPrimeContract execute was not registered");

    const output = await execute(input({ confirmed: true }));

    expect(output).toMatchObject({
      success: false,
      action: "partial",
      record: { id: CONTRACT_ID },
      error: expect.stringContaining("do not retry"),
    });
    expect(dependencies.recordWriteAudit).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        status: "pending",
        response: expect.objectContaining({
          success: false,
          action: "blocked",
          error: expect.stringContaining("already started"),
        }),
      }),
    );
    expect(mockedCreatePrimeContract).toHaveBeenCalledTimes(1);
  });

  it("fails the pending reservation instead of leaving a replayable blocker when create throws", async () => {
    mockedCreatePrimeContract.mockRejectedValueOnce(new Error("insert failed"));
    const dependencies = internals();
    const execute = createPrimeContractWriteTools(dependencies).createPrimeContract.execute;
    if (!execute) throw new Error("createPrimeContract execute was not registered");

    const output = await execute(input({ confirmed: true }));

    expect(output).toMatchObject({
      success: false,
      action: "blocked",
      error: "The Prime Contract could not be created. No unreported write was attempted.",
    });
    expect(dependencies.recordWriteAudit).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ status: "pending" }),
    );
    expect(dependencies.failWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "prime-contract-idempotency",
        response: expect.objectContaining({
          success: false,
          action: "blocked",
          error:
            "The Prime Contract could not be created. No unreported write was attempted.",
        }),
      }),
    );
  });
});

describe("Prime Contract SOV assistant edit tool", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLoadPermissions.mockResolvedValue({ isAdmin: true } as never);
    mockedHasPermission.mockReturnValue(true);
  });

  it("previews exact budget-code updates and appends without writing", async () => {
    const stub = sovEditSupabaseStub();
    const dependencies = internals(stub.supabase);
    const editTool = createPrimeContractWriteTools(dependencies).editPrimeContractSov;
    const execute = editTool.execute;
    if (!execute) throw new Error("editPrimeContractSov execute was not registered");

    const output = await execute(sovEditInput());

    expect(output).toMatchObject({
      success: true,
      action: "preview",
      previewToken: expect.any(String),
      preview: {
        contract: {
          id: CONTRACT_ID,
          contractNumber: "PC-0004",
          status: "draft",
        },
        currentSovTotal: 1000,
        proposedSovTotal: 24050,
        rows: [
          expect.objectContaining({
            action: "update",
            projectBudgetCodeId: BUDGET_CODE_ID,
            lineNumber: 1,
            amount: 5000,
          }),
          expect.objectContaining({
            action: "append",
            projectBudgetCodeId: SECOND_BUDGET_CODE_ID,
            lineNumber: 2,
            amount: 19050,
          }),
        ],
      },
    });
    expect(stub.rpc).not.toHaveBeenCalled();
    expect(dependencies.recordWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "editPrimeContractSovPreview",
        status: "success",
        idempotencyKey: expect.any(String),
      }),
    );
  });

  it("uses one atomic RPC after confirmation of the exact stored preview", async () => {
    const stub = sovEditSupabaseStub();
    const dependencies = internals(stub.supabase);
    const execute = createPrimeContractWriteTools(dependencies)
      .editPrimeContractSov.execute;
    if (!execute) throw new Error("editPrimeContractSov execute was not registered");

    const preview = await execute(sovEditInput());
    const previewToken = (preview as { previewToken?: string }).previewToken;
    expect(previewToken).toEqual(expect.any(String));
    (dependencies.getReplayResponse as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(preview);

    const output = await execute(
      sovEditInput({ confirmed: true, previewToken }),
    );

    expect(stub.rpc).toHaveBeenCalledWith(
      "ai_edit_draft_prime_contract_sov",
      expect.objectContaining({
        p_project_id: 43,
        p_contract_id: CONTRACT_ID,
        p_user_id: USER_ID,
        p_is_admin: true,
        p_expected_contract_updated_at: "2026-07-22T15:00:00.000Z",
        p_expected_sov_rows: [
          expect.objectContaining({
            id: "00000000-0000-0000-0000-000000000009",
            unit_cost: 1000,
            updated_at: "2026-07-22T14:00:00.000Z",
          }),
        ],
        p_rows: [
          expect.objectContaining({
            id: "00000000-0000-0000-0000-000000000009",
            line_number: 1,
            budget_code_id: BUDGET_CODE_ID,
            cost_code_id: "01-3120",
            quantity: 1,
            unit_cost: 5000,
          }),
          expect.objectContaining({
            id: expect.any(String),
            line_number: 2,
            budget_code_id: SECOND_BUDGET_CODE_ID,
            cost_code_id: "01-3127",
            quantity: 1,
            unit_cost: 19050,
          }),
        ],
      }),
    );
    expect(dependencies.recordWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "editPrimeContractSov",
        status: "pending",
      }),
    );
    expect(dependencies.finalizeWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "editPrimeContractSov",
        response: expect.objectContaining({ action: "updated" }),
      }),
    );
    expect(output).toMatchObject({
      success: true,
      action: "updated",
      record: {
        id: CONTRACT_ID,
        href: `/43/prime-contracts/${CONTRACT_ID}`,
      },
      receipt: { updatedRows: 1, appendedRows: 1, sovTotal: 24050 },
    });
  });

  it("replays an already completed exact SOV write before rebuilding changed row state", async () => {
    const stub = sovEditSupabaseStub();
    const dependencies = internals(stub.supabase);
    const execute = createPrimeContractWriteTools(dependencies)
      .editPrimeContractSov.execute;
    if (!execute) throw new Error("editPrimeContractSov execute was not registered");

    const completedReceipt = {
      success: true,
      action: "updated",
      record: {
        id: CONTRACT_ID,
        href: `/43/prime-contracts/${CONTRACT_ID}`,
      },
      receipt: { updatedRows: 1, appendedRows: 1, sovTotal: 24050 },
    };
    (dependencies.getReplayResponse as jest.Mock).mockResolvedValueOnce(
      completedReceipt,
    );

    const output = await execute(
      sovEditInput({
        confirmed: true,
        previewToken: "00000000-0000-0000-0000-000000000010",
      }),
    );

    expect(output).toEqual(completedReceipt);
    expect(stub.rpc).not.toHaveBeenCalled();
    expect(stub.from.mock.calls.map(([table]) => table)).not.toContain(
      "contract_line_items",
    );
  });

  it("binds a caller-supplied idempotency key to the exact confirmed SOV payload", async () => {
    const stub = sovEditSupabaseStub();
    const dependencies = internals(stub.supabase);
    const execute = createPrimeContractWriteTools(dependencies)
      .editPrimeContractSov.execute;
    if (!execute) throw new Error("editPrimeContractSov execute was not registered");

    const sharedConfirmation = {
      confirmed: true,
      previewToken: "00000000-0000-0000-0000-000000000010",
      idempotencyKey: "caller-reused-key",
    };
    await execute(sovEditInput(sharedConfirmation));
    await execute(
      sovEditInput({
        ...sharedConfirmation,
        rows: [
          {
            costCode: "013120",
            costType: "Labor",
            description: "Vice President",
            amount: 6000,
          },
        ],
      }),
    );

    const writeReplayKeys = (
      dependencies.getReplayResponse as jest.Mock
    ).mock.calls
      .filter(([toolName]) => toolName === "editPrimeContractSov")
      .map(([, idempotencyKey]) => idempotencyKey);
    expect(writeReplayKeys).toHaveLength(2);
    expect(new Set(writeReplayKeys).size).toBe(2);
    expect(stub.rpc).not.toHaveBeenCalled();
  });

  it("blocks a confirmed call that has no previously stored preview token", async () => {
    const stub = sovEditSupabaseStub();
    const dependencies = internals(stub.supabase);
    const execute = createPrimeContractWriteTools(dependencies)
      .editPrimeContractSov.execute;
    if (!execute) throw new Error("editPrimeContractSov execute was not registered");

    const output = await execute(sovEditInput({ confirmed: true }));

    expect(output).toMatchObject({
      success: false,
      action: "blocked",
      error: expect.stringContaining("preview"),
    });
    expect(stub.rpc).not.toHaveBeenCalled();
  });

  it("rejects values that cannot be represented at database precision", async () => {
    const stub = sovEditSupabaseStub();
    const dependencies = internals(stub.supabase);
    const execute = createPrimeContractWriteTools(dependencies)
      .editPrimeContractSov.execute;
    if (!execute) throw new Error("editPrimeContractSov execute was not registered");

    const output = await execute(
      sovEditInput({
        rows: [
          {
            costCode: "013120",
            costType: "Labor",
            amount: 4,
            quantity: 1000,
            unitCost: 0.004,
          },
        ],
      }),
    );

    expect(output).toMatchObject({
      success: false,
      action: "blocked",
      error: expect.stringContaining("two decimal places"),
    });
    expect(stub.rpc).not.toHaveBeenCalled();
  });

  it("blocks edits to non-draft contracts", async () => {
    const stub = sovEditSupabaseStub({ contractStatus: "approved" });
    const dependencies = internals(stub.supabase);
    const execute = createPrimeContractWriteTools(dependencies)
      .editPrimeContractSov.execute;
    if (!execute) throw new Error("editPrimeContractSov execute was not registered");

    const output = await execute(sovEditInput());

    expect(output).toMatchObject({
      success: false,
      action: "blocked",
      error: expect.stringContaining("draft Prime Contracts"),
    });
    expect(stub.rpc).not.toHaveBeenCalled();
  });

  it("resolves a screenshot row without cost type from one exact project budget amount", async () => {
    const stub = sovEditSupabaseStub({
      projectBudgetCodes: [
        {
          id: SECOND_BUDGET_CODE_ID,
          cost_code_id: "01-6500",
          cost_type_id: LABOR_TYPE_ID,
          description: "Travel labor",
        },
        {
          id: THIRD_BUDGET_CODE_ID,
          cost_code_id: "016500",
          cost_type_id: EXPENSE_TYPE_ID,
          description: "Travel",
        },
      ],
      budgetLines: [
        {
          project_budget_code_id: THIRD_BUDGET_CODE_ID,
          cost_code_id: "01-6500",
          cost_type_id: EXPENSE_TYPE_ID,
          original_amount: 12479,
        },
      ],
      costTypes: [
        { id: LABOR_TYPE_ID, code: "L", description: "Labor" },
        { id: EXPENSE_TYPE_ID, code: "E", description: "Expense" },
      ],
    });
    const dependencies = internals(stub.supabase);
    const execute = createPrimeContractWriteTools(dependencies)
      .editPrimeContractSov.execute;
    if (!execute) throw new Error("editPrimeContractSov execute was not registered");

    const output = await execute(
      sovEditInput({
        rows: [
          {
            costCode: "016500",
            description: "Travel",
            amount: 12479,
          },
        ],
      }),
    );

    expect(output).toMatchObject({
      success: true,
      action: "preview",
      preview: {
        currentSovTotal: 1000,
        proposedSovTotal: 13479,
        rows: [
          expect.objectContaining({
            action: "append",
            projectBudgetCodeId: THIRD_BUDGET_CODE_ID,
            costCode: "016500",
            costType: "Expense",
            description: "Travel",
            amount: 12479,
          }),
        ],
      },
    });
    expect(stub.rpc).not.toHaveBeenCalled();
  });

  it("blocks a screenshot row when no project budget amount resolves its cost type", async () => {
    const stub = sovEditSupabaseStub({
      projectBudgetCodes: [
        {
          id: SECOND_BUDGET_CODE_ID,
          cost_code_id: "01-6500",
          cost_type_id: LABOR_TYPE_ID,
          description: "Travel labor",
        },
        {
          id: THIRD_BUDGET_CODE_ID,
          cost_code_id: "016500",
          cost_type_id: EXPENSE_TYPE_ID,
          description: "Travel expense",
        },
      ],
      budgetLines: [
        {
          project_budget_code_id: THIRD_BUDGET_CODE_ID,
          cost_code_id: "01-6500",
          cost_type_id: EXPENSE_TYPE_ID,
          original_amount: 12000,
        },
      ],
      costTypes: [
        { id: LABOR_TYPE_ID, code: "L", description: "Labor" },
        { id: EXPENSE_TYPE_ID, code: "E", description: "Expense" },
      ],
    });
    const dependencies = internals(stub.supabase);
    const execute = createPrimeContractWriteTools(dependencies)
      .editPrimeContractSov.execute;
    if (!execute) throw new Error("editPrimeContractSov execute was not registered");

    const output = await execute(
      sovEditInput({
        rows: [
          {
            costCode: "016500",
            description: "Travel",
            amount: 12479,
          },
        ],
      }),
    );

    expect(output).toMatchObject({
      success: false,
      action: "blocked",
      error: expect.stringContaining(
        "no active project budget code whose cost code and project budget amount exactly match $12,479.00",
      ),
    });
    expect(stub.rpc).not.toHaveBeenCalled();
  });

  it("blocks ambiguous cost-code matches instead of guessing", async () => {
    const stub = sovEditSupabaseStub({
      projectBudgetCodes: [
        {
          id: BUDGET_CODE_ID,
          cost_code_id: "01-3120",
          cost_type_id: LABOR_TYPE_ID,
          description: "Vice President labor",
        },
        {
          id: SECOND_BUDGET_CODE_ID,
          cost_code_id: "013120",
          cost_type_id: EXPENSE_TYPE_ID,
          description: "Vice President expense",
        },
      ],
      budgetLines: [
        {
          project_budget_code_id: BUDGET_CODE_ID,
          cost_code_id: "01-3120",
          cost_type_id: LABOR_TYPE_ID,
          original_amount: 5000,
        },
        {
          project_budget_code_id: SECOND_BUDGET_CODE_ID,
          cost_code_id: "013120",
          cost_type_id: EXPENSE_TYPE_ID,
          original_amount: 5000,
        },
      ],
      costTypes: [
        { id: LABOR_TYPE_ID, code: "L", description: "Labor" },
        {
          id: EXPENSE_TYPE_ID,
          code: "E",
          description: "Expense",
        },
      ],
    });
    const dependencies = internals(stub.supabase);
    const execute = createPrimeContractWriteTools(dependencies)
      .editPrimeContractSov.execute;
    if (!execute) throw new Error("editPrimeContractSov execute was not registered");

    const output = await execute(
      sovEditInput({
        rows: [
          { costCode: "013120", description: "Vice President", amount: 5000 },
        ],
      }),
    );

    expect(output).toMatchObject({
      success: false,
      action: "blocked",
      error: expect.stringContaining(
        "still matches multiple active project budget codes",
      ),
    });
    expect(stub.rpc).not.toHaveBeenCalled();
  });

  it("denies the edit when the user lacks Contracts write permission", async () => {
    mockedHasPermission.mockReturnValue(false);
    const stub = sovEditSupabaseStub();
    const dependencies = internals(stub.supabase);
    const execute = createPrimeContractWriteTools(dependencies)
      .editPrimeContractSov.execute;
    if (!execute) throw new Error("editPrimeContractSov execute was not registered");

    const output = await execute(sovEditInput());

    expect(output).toMatchObject({
      success: false,
      action: "blocked",
      error: expect.stringContaining("write access to Contracts"),
    });
    expect(stub.rpc).not.toHaveBeenCalled();
  });

  it("denies the edit before database reads when project access is missing", async () => {
    const stub = sovEditSupabaseStub();
    const dependencies = internals(stub.supabase);
    (dependencies.enforceProjectWriteAccess as jest.Mock).mockResolvedValueOnce({
      ok: false,
      error: "You do not have access to project 43.",
    });
    const execute = createPrimeContractWriteTools(dependencies)
      .editPrimeContractSov.execute;
    if (!execute) throw new Error("editPrimeContractSov execute was not registered");

    const output = await execute(sovEditInput());

    expect(output).toEqual({
      success: false,
      action: "blocked",
      error: "You do not have access to project 43.",
    });
    expect((stub.supabase.from as jest.Mock)).not.toHaveBeenCalled();
  });

  it("denies a private contract that is not shared with the signed-in user", async () => {
    mockedLoadPermissions.mockResolvedValue({ isAdmin: false } as never);
    const stub = sovEditSupabaseStub({
      isPrivate: true,
      allowedUserIds: [],
      createdBy: OWNER_ID,
    });
    const dependencies = internals(stub.supabase);
    const execute = createPrimeContractWriteTools(dependencies)
      .editPrimeContractSov.execute;
    if (!execute) throw new Error("editPrimeContractSov execute was not registered");

    const output = await execute(sovEditInput());

    expect(output).toMatchObject({
      success: false,
      action: "blocked",
      error: expect.stringContaining("unavailable or is not shared"),
    });
    expect(stub.rpc).not.toHaveBeenCalled();
    expect(stub.from.mock.calls.map(([table]) => table)).not.toContain(
      "contract_line_items",
    );
  });

  it("fails closed when the contract changes after preview", async () => {
    const stub = sovEditSupabaseStub({
      rpcError: { message: "AI_SOV_STATE_CHANGED", code: "P0001" },
    });
    const dependencies = internals(stub.supabase);
    const execute = createPrimeContractWriteTools(dependencies)
      .editPrimeContractSov.execute;
    if (!execute) throw new Error("editPrimeContractSov execute was not registered");

    const preview = await execute(sovEditInput());
    const previewToken = (preview as { previewToken?: string }).previewToken;
    (dependencies.getReplayResponse as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(preview);
    const output = await execute(
      sovEditInput({ confirmed: true, previewToken }),
    );

    expect(output).toMatchObject({
      success: false,
      action: "blocked",
      error: expect.stringContaining("changed since the preview"),
    });
    expect(dependencies.failWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: "editPrimeContractSov" }),
    );
  });

  it("does not mutate when the pre-write audit reservation fails", async () => {
    const stub = sovEditSupabaseStub();
    const dependencies = internals(stub.supabase);
    const execute = createPrimeContractWriteTools(dependencies)
      .editPrimeContractSov.execute;
    if (!execute) throw new Error("editPrimeContractSov execute was not registered");

    const preview = await execute(sovEditInput());
    const previewToken = (preview as { previewToken?: string }).previewToken;
    (dependencies.getReplayResponse as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(preview);
    (dependencies.recordWriteAudit as jest.Mock).mockRejectedValueOnce(
      new Error("audit unavailable"),
    );
    const output = await execute(
      sovEditInput({ confirmed: true, previewToken }),
    );

    expect(output).toMatchObject({
      success: false,
      action: "blocked",
      error: expect.stringContaining("audit reservation"),
    });
    expect(stub.rpc).not.toHaveBeenCalled();
  });
});

describe("buildPrimeContractDraftWidget", () => {
  it("treats a missing owner/client as a hard failure", () => {
    const widget = buildPrimeContractDraftWidget({
      projectId: 43,
      title: "Ownerless contract",
      contractNumber: "PC-0004",
      owner: {
        status: "none",
        id: null,
        name: null,
        message: "No owner/client is linked yet.",
      },
      contractStatus: "draft",
      retentionPercentage: 0,
      lineItems: [
        {
          description: "General conditions",
          amount: 1000,
        },
      ],
    });

    expect(widget.validation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Owner / client",
          status: "fail",
          message: "No owner/client is linked yet.",
        }),
      ]),
    );
  });

  it("blocks an approved zero-dollar SOV", () => {
    const widget = buildPrimeContractDraftWidget({
      projectId: 43,
      title: "Zero contract",
      contractNumber: "PC-0004",
      owner: {
        status: "none",
        id: null,
        name: null,
        message: "No owner/client is linked yet.",
      },
      contractStatus: "approved",
      retentionPercentage: 0,
      lineItems: [],
    });

    expect(widget.validation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Schedule of Values",
          status: "fail",
        }),
      ]),
    );
  });
});
