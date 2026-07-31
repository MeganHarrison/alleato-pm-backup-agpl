import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

// POST /api/projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/mark-paid
// Subcontractor payments are read-only Acumatica inbound records.
export const POST = withApiGuardrails<{ projectId: string; invoiceId: string }>(
  "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/mark-paid#POST",
  async () => {
    throw new GuardrailError({
      code: "READ_ONLY_RESOURCE",
      where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/mark-paid#POST",
      message:
        "Subcontractor invoice payments are synced from Acumatica and cannot be recorded in Alleato.",
      status: 405,
      severity: "low",
    });
  },
);
