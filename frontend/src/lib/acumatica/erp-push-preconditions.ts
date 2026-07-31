/**
 * Preconditions for pushing a job (project + its prime contracts) to Acumatica.
 *
 * Pushing a job to the ERP is a privileged, irreversible-ish write: the first
 * push CREATES the Project in Acumatica. If we push a job that has no prime
 * contracts, or whose contract companies are not linked to an Acumatica
 * customer, we would create a malformed Project in the accounting system.
 *
 * This module is a PURE function so the branching can be unit-tested without a
 * database or a live Acumatica connection. The route gathers the three facts
 * from the DB and asks this helper whether the push may proceed.
 */

export interface ErpPushFacts {
  /** The project row exists. */
  projectExists: boolean;
  /** Number of prime contracts attached to the project. */
  primeContractCount: number;
  /**
   * Number of the prime-contract companies (client_id / contract_company_id)
   * that resolve to a non-null Acumatica `companies.customer_id`.
   */
  companiesWithCustomer: number;
}

export type ErpPushPreconditionCode =
  | "ROUTE_BINDING_MISSING"
  | "PRECONDITION_FAILED";

export interface ErpPushPreconditionResult {
  ok: boolean;
  code?: ErpPushPreconditionCode;
  message?: string;
}

/**
 * Decide whether a job may be pushed to Acumatica. Returns `{ ok: true }` when
 * every precondition is satisfied, otherwise the first failing precondition
 * with a user-facing message and the guardrail error code the route should use.
 */
export function evaluateErpPushPreconditions(
  facts: ErpPushFacts,
): ErpPushPreconditionResult {
  if (!facts.projectExists) {
    return {
      ok: false,
      code: "ROUTE_BINDING_MISSING",
      message: "Project not found.",
    };
  }

  if (facts.primeContractCount <= 0) {
    return {
      ok: false,
      code: "PRECONDITION_FAILED",
      message: "This job has no prime contracts to push to the ERP.",
    };
  }

  if (facts.companiesWithCustomer <= 0) {
    return {
      ok: false,
      code: "PRECONDITION_FAILED",
      message:
        "Cannot push to Acumatica: no prime-contract company is linked to an " +
        "Acumatica customer. Set the customer on the company in the directory first.",
    };
  }

  return { ok: true };
}
