import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type Tables = Database["public"]["Tables"];
type PrimeContractInsert = Tables["prime_contracts"]["Insert"];
type PrimeContractRow = Tables["prime_contracts"]["Row"];
type ContractLineItemInsert = Tables["contract_line_items"]["Insert"];
type ContractLineItemRow = Tables["contract_line_items"]["Row"];

export type PrimeContractCreationLineItem = Omit<
  ContractLineItemInsert,
  "contract_id" | "created_at" | "updated_at" | "total_cost"
>;

export type PrimeContractCreationFailure = {
  lineNumber: number;
  description: string;
  message: string;
  code:
    | "DUPLICATE_LINE_NUMBER"
    | "INVALID_BUDGET_CODE"
    | "SOV_LINE_INSERT_FAILED";
};

export type PrimeContractCreationReceipt = {
  status: "complete" | "partial";
  contractId: string;
  contractNumber: string;
  totalValue: number;
  lineItems: {
    attempted: number;
    created: number;
    failed: PrimeContractCreationFailure[];
  };
};

export type PrimeContractCreationResult = {
  contract: PrimeContractRow;
  receipt: PrimeContractCreationReceipt;
};

export type PrimeContractCreationStore = {
  findContractByNumber: (
    projectId: number,
    contractNumber: string,
  ) => Promise<Pick<PrimeContractRow, "id"> | null>;
  insertContract: (payload: PrimeContractInsert) => Promise<PrimeContractRow>;
  insertLineItem: (
    payload: ContractLineItemInsert,
  ) => Promise<ContractLineItemRow>;
};

type PrimeContractCreationErrorCode =
  | "APPROVED_CONTRACT_REQUIRES_VALUE"
  | "CONTRACT_INSERT_FAILED"
  | "DUPLICATE_CONTRACT_NUMBER"
  | "INVALID_LINE_ITEMS"
  | "PRIME_CONTRACT_LOOKUP_FAILED";

export class PrimeContractCreationError extends Error {
  constructor(
    message: string,
    readonly code: PrimeContractCreationErrorCode,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PrimeContractCreationError";
  }
}

export class PrimeContractPersistenceError extends Error {
  constructor(
    message: string,
    readonly postgresCode: string | null,
    readonly details?: string | null,
  ) {
    super(message);
    this.name = "PrimeContractPersistenceError";
  }
}

function asStoreError(error: PostgrestError, fallback: string) {
  return new PrimeContractPersistenceError(
    error.message || fallback,
    error.code || null,
    error.details,
  );
}

export function createSupabasePrimeContractCreationStore(
  supabase: SupabaseClient<Database>,
): PrimeContractCreationStore {
  return {
    async findContractByNumber(projectId, contractNumber) {
      const { data, error } = await supabase
        .from("prime_contracts")
        .select("id")
        .eq("project_id", projectId)
        .eq("contract_number", contractNumber)
        .maybeSingle();

      if (error) {
        throw asStoreError(error, "Failed to check the contract number.");
      }

      return data;
    },

    async insertContract(payload) {
      const { data, error } = await supabase
        .from("prime_contracts")
        .insert(payload)
        .select("*")
        .single();

      if (error || !data) {
        throw error
          ? asStoreError(error, "Failed to create the prime contract.")
          : new PrimeContractPersistenceError(
              "The database did not return the created prime contract.",
              null,
            );
      }

      return data;
    },

    async insertLineItem(payload) {
      const { data, error } = await supabase
        .from("contract_line_items")
        .insert(payload)
        .select("*")
        .single();

      if (error || !data) {
        throw error
          ? asStoreError(error, "Failed to create the SOV line.")
          : new PrimeContractPersistenceError(
              "The database did not return the created SOV line.",
              null,
            );
      }

      return data;
    },
  };
}

function lineItemTotal(lineItem: PrimeContractCreationLineItem): number {
  return Number(lineItem.quantity ?? 0) * Number(lineItem.unit_cost ?? 0);
}

function validateLineItems(lineItems: PrimeContractCreationLineItem[]) {
  const seenLineNumbers = new Set<number>();

  for (const lineItem of lineItems) {
    if (seenLineNumbers.has(lineItem.line_number)) {
      throw new PrimeContractCreationError(
        `Line number ${lineItem.line_number} appears more than once in the SOV.`,
        "INVALID_LINE_ITEMS",
      );
    }
    seenLineNumbers.add(lineItem.line_number);
  }
}

function describeLineItemFailure(
  lineItem: PrimeContractCreationLineItem,
  error: unknown,
): PrimeContractCreationFailure {
  const storeError =
    error instanceof PrimeContractPersistenceError ? error : null;
  const code =
    storeError?.postgresCode === "23503"
      ? "INVALID_BUDGET_CODE"
      : storeError?.postgresCode === "23505"
        ? "DUPLICATE_LINE_NUMBER"
        : "SOV_LINE_INSERT_FAILED";
  const message =
    code === "INVALID_BUDGET_CODE"
      ? "Invalid budget code: the selected code does not exist for this project."
      : code === "DUPLICATE_LINE_NUMBER"
        ? `Line number ${lineItem.line_number} already exists for this contract.`
        : "This SOV line could not be saved. Open the contract to retry it.";

  return {
    lineNumber: lineItem.line_number,
    description: lineItem.description,
    message,
    code,
  };
}

export async function createPrimeContract({
  store,
  userId,
  contract,
  lineItems = [],
}: {
  store: PrimeContractCreationStore;
  userId: string;
  contract: PrimeContractInsert;
  lineItems?: PrimeContractCreationLineItem[];
}): Promise<PrimeContractCreationResult> {
  validateLineItems(lineItems);

  const totalValue =
    lineItems.length > 0
      ? lineItems.reduce((sum, lineItem) => sum + lineItemTotal(lineItem), 0)
      : Number(contract.original_contract_value ?? 0);

  if (contract.status === "approved" && totalValue <= 0) {
    throw new PrimeContractCreationError(
      "Cannot approve a prime contract with a zero-dollar SOV.",
      "APPROVED_CONTRACT_REQUIRES_VALUE",
    );
  }

  let existingContract: Pick<PrimeContractRow, "id"> | null;
  try {
    existingContract = await store.findContractByNumber(
      Number(contract.project_id),
      contract.contract_number,
    );
  } catch (error) {
    throw new PrimeContractCreationError(
      "The contract number could not be checked. No contract was created.",
      "PRIME_CONTRACT_LOOKUP_FAILED",
      error,
    );
  }

  if (existingContract) {
    throw new PrimeContractCreationError(
      `Prime contract ${contract.contract_number} already exists in this project.`,
      "DUPLICATE_CONTRACT_NUMBER",
    );
  }

  let createdContract: PrimeContractRow;
  try {
    const allowedUserIds =
      contract.is_private === true
        ? Array.from(
            new Set([...(contract.allowed_user_ids ?? []), userId]),
          )
        : contract.allowed_user_ids;

    createdContract = await store.insertContract({
      ...contract,
      created_by: userId,
      allowed_user_ids: allowedUserIds,
      original_contract_value: totalValue,
      revised_contract_value: totalValue,
    });
  } catch (error) {
    const storeError =
      error instanceof PrimeContractPersistenceError ? error : null;
    const duplicate =
      storeError?.postgresCode === "23505";

    throw new PrimeContractCreationError(
      duplicate
        ? `Prime contract ${contract.contract_number} already exists in this project.`
        : "The prime contract could not be saved. No SOV lines were written.",
      duplicate ? "DUPLICATE_CONTRACT_NUMBER" : "CONTRACT_INSERT_FAILED",
      error,
    );
  }

  const failedLineItems: PrimeContractCreationFailure[] = [];
  let createdLineItemCount = 0;

  // Keep writes sequential because the database enforces
  // UNIQUE(contract_id, line_number). A structured partial receipt preserves
  // the successfully created base contract and identifies exact recovery work.
  for (const lineItem of lineItems) {
    try {
      await store.insertLineItem({
        ...lineItem,
        contract_id: createdContract.id,
      });
      createdLineItemCount += 1;
    } catch (error) {
      failedLineItems.push(describeLineItemFailure(lineItem, error));
    }
  }

  return {
    contract: createdContract,
    receipt: {
      status: failedLineItems.length > 0 ? "partial" : "complete",
      contractId: createdContract.id,
      contractNumber: createdContract.contract_number,
      totalValue,
      lineItems: {
        attempted: lineItems.length,
        created: createdLineItemCount,
        failed: failedLineItems,
      },
    },
  };
}
