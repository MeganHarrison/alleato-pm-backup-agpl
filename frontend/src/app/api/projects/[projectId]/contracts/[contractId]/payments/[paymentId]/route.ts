import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

function readOnlyPaymentError(where: string): GuardrailError {
  return new GuardrailError({
    code: "READ_ONLY_RESOURCE",
    where,
    message:
      "Prime contract payments are synced from Acumatica and cannot be edited in Alleato.",
    status: 405,
    severity: "low",
  });
}

export const PATCH = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/payments/[paymentId]#PATCH",
  async () => {
    throw readOnlyPaymentError(
      "projects/[projectId]/contracts/[contractId]/payments/[paymentId]#PATCH",
    );
  },
);

export const DELETE = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/payments/[paymentId]#DELETE",
  async () => {
    throw readOnlyPaymentError(
      "projects/[projectId]/contracts/[contractId]/payments/[paymentId]#DELETE",
    );
  },
);
