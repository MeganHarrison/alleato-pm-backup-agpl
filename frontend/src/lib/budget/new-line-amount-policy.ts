import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const TRUTHY = new Set(["1", "true", "yes", "on"]);

function parseBooleanFlag(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined || value === "") return defaultValue;
  return TRUTHY.has(value.trim().toLowerCase());
}

/**
 * Feature flag: when ON (default), new budget line items created after a
 * prime contract is marked executed must have a $0.00 amount. Budget amount
 * changes flow through change orders. Set the env var to "false" to disable
 * the lock and restore unrestricted line creation.
 *
 * Both the API and UI read NEXT_PUBLIC_* so the toggle stays in sync.
 */
export function isPostExecutionAmountLockEnabled(): boolean {
  return parseBooleanFlag(
    process.env
      .NEXT_PUBLIC_LOCK_NEW_BUDGET_LINE_AMOUNTS_AFTER_CONTRACT_EXECUTION,
    true,
  );
}

export interface BudgetLineAmountPolicy {
  /** True when new lines must be created at $0.00. */
  requireZeroAmount: boolean;
  /** Feature flag state, independent of project context. */
  flagEnabled: boolean;
  /** Whether the project has at least one executed prime contract. */
  primeContractExecuted: boolean;
}

export async function getBudgetLineAmountPolicy(
  supabase: SupabaseClient<Database>,
  projectId: number,
): Promise<BudgetLineAmountPolicy> {
  const flagEnabled = isPostExecutionAmountLockEnabled();

  if (!flagEnabled) {
    return {
      requireZeroAmount: false,
      flagEnabled,
      primeContractExecuted: false,
    };
  }

  const { data, error } = await supabase
    .from("prime_contracts")
    .select("id")
    .eq("project_id", projectId)
    .eq("executed", true)
    .limit(1)
    .maybeSingle();

  const primeContractExecuted = !error && data !== null;

  return {
    requireZeroAmount: primeContractExecuted,
    flagEnabled,
    primeContractExecuted,
  };
}

/** Tolerance for floating-point amount comparisons (half a cent). */
const ZERO_AMOUNT_TOLERANCE = 0.005;

export function isEffectivelyZero(amount: number | null | undefined): boolean {
  if (amount === null || amount === undefined) return true;
  if (Number.isNaN(amount)) return true;
  return Math.abs(amount) < ZERO_AMOUNT_TOLERANCE;
}
