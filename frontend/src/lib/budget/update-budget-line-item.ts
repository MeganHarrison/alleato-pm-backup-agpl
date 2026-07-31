import { ApiError, apiFetch } from "@/lib/api-client";

export interface UpdateBudgetLineItemInput {
  quantity: number;
  uom?: string | null;
  unitCost: number;
  originalAmount: number;
}

function formatBudgetMutationError(
  error: unknown,
  fallbackMessage: string,
): string {
  const descriptionParts: string[] = [];

  if (error instanceof Error && error.message.trim()) {
    descriptionParts.push(error.message);
  }

  if (error instanceof ApiError && error.requestId) {
    descriptionParts.push(`Request ID: ${error.requestId}`);
  }

  return descriptionParts.join(" | ") || fallbackMessage;
}

/**
 * Saves editable budget line fields through the shared API client so server errors stay actionable.
 */
export async function updateBudgetLineItem(
  projectId: string,
  lineItemId: string,
  data: UpdateBudgetLineItemInput,
): Promise<void> {
  await apiFetch(`/api/projects/${projectId}/budget/lines/${lineItemId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      quantity: data.quantity,
      unit_of_measure: data.uom ?? null,
      unit_cost: data.unitCost,
      original_amount: data.originalAmount,
    }),
  });
}

/**
 * Formats budget create failures so toasts preserve the real server reason and request ID.
 */
export function formatBudgetCreateError(error: unknown): string {
  return formatBudgetMutationError(
    error,
    "An unexpected error occurred while creating the budget line.",
  );
}

/**
 * Formats budget update failures so the toast shows the real reason and trace ID instead of a generic fallback.
 */
export function formatBudgetUpdateError(error: unknown): string {
  return formatBudgetMutationError(
    error,
    "An unexpected error occurred while saving the budget line.",
  );
}
