import { apiFetch } from "@/lib/api-client";
import type {
  BudgetCodeOption,
  CommitmentSovLineItem,
} from "@/components/domain/change-events/change-event-form/types";

/**
 * Single source of truth for matching a commitment's SOV budget code to a
 * project budget-code dropdown option, used by BOTH change-event line-item
 * editors:
 *   - ChangeEventForm (new/edit pages, via useChangeEventFormData)
 *   - ChangeEventLineItemsTable (change-event detail page inline editor)
 *
 * These two editors previously had divergent implementations: the form auto-
 * populated the budget code from the selected commitment, but the inline detail
 * editor populated only the vendor and silently left the budget code blank.
 * That drift is what this module exists to prevent — change matching here once.
 */

/** Strip formatting so "233000" matches "23-3000", "23.3000", "23/3000", etc. */
export function normCode(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function normText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function findBudgetCode(
  code: string | null,
  budgetCodes: BudgetCodeOption[],
): BudgetCodeOption | undefined {
  if (!code) return undefined;
  const q = normText(code);
  const qNorm = normCode(q);
  return (
    // 1. Canonical project_budget_codes.id from the selector/API.
    budgetCodes.find((b) => b.id === code) ||
    // 2. Exact/case-insensitive visible cost-code text.
    budgetCodes.find((b) => normText(b.code) === q) ||
    // 3. Canonical cost-code identifier.
    budgetCodes.find((b) => b.costCodeId && normText(b.costCodeId) === q) ||
    // 4. Normalized match — "233000" matches "23-3000".
    budgetCodes.find((b) => normCode(b.code) === qNorm) ||
    budgetCodes.find((b) => b.costCodeId && normCode(b.costCodeId) === qNorm) ||
    // 5. Description match.
    budgetCodes.find((b) => normText(b.description) === q) ||
    // 6. Full label prefix match.
    budgetCodes.find((b) => normText(b.fullLabel).startsWith(q))
  );
}

export interface BudgetCodeResolution {
  /** project_budget_codes.id of the matched dropdown option, if resolvable. */
  budgetCodeId?: string;
  /** Description to copy from the single SOV line, if there is exactly one. */
  description?: string;
  /** Why a budget code could NOT be resolved — for surfacing to the user. */
  reason?: "no_sov" | "multiple_codes" | "code_not_in_project";
}

/**
 * Resolve a budget code from a commitment's SOV line items.
 * Auto-fills only when every SOV line shares one budget code (unambiguous);
 * when they differ, the caller must let the user pick the specific SOV line.
 */
export function resolveBudgetCodeFromSov(
  items: CommitmentSovLineItem[],
  budgetCodes: BudgetCodeOption[],
): BudgetCodeResolution {
  if (items.length === 0) return { reason: "no_sov" };

  const projectBudgetCodeIds = [
    ...new Set(
      items
        .map((item) => item.project_budget_code_id ?? null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (projectBudgetCodeIds.length > 1) {
    return { reason: "multiple_codes" };
  }
  const singleProjectBudgetCodeId = projectBudgetCodeIds[0] ?? null;

  const firstCode = items[0].budget_code;
  const allSameCode =
    firstCode !== null && items.every((i) => i.budget_code === firstCode);

  if (!singleProjectBudgetCodeId && !allSameCode) {
    return { reason: "multiple_codes" };
  }

  const resolution: BudgetCodeResolution = {};
  const match = findBudgetCode(
    singleProjectBudgetCodeId ?? firstCode,
    budgetCodes,
  );
  if (match) {
    resolution.budgetCodeId = match.id;
  } else {
    resolution.reason = "code_not_in_project";
  }

  if (items.length === 1 && items[0].description) {
    resolution.description = items[0].description;
  }

  return resolution;
}

/** Strip the "po-"/"sub-" prefix the comboboxes use to namespace commitment ids. */
export function stripCommitmentPrefix(commitmentId: string): string {
  return commitmentId.replace(/^(po|sub)-/, "");
}

/**
 * Fetch a commitment's SOV line items, returning [] on any failure so callers
 * can cache the empty result and avoid refetching.
 */
export async function fetchCommitmentSovLineItems(
  projectId: number | string,
  commitmentId: string,
): Promise<CommitmentSovLineItem[]> {
  const rawId = stripCommitmentPrefix(commitmentId);
  try {
    const data = await apiFetch<{ data: CommitmentSovLineItem[] }>(
      `/api/projects/${projectId}/commitments/${rawId}/line-items`,
    );
    return data.data || [];
  } catch {
    return [];
  }
}
