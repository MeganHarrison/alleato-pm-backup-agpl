import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/direct-costs/bulk#POST",
  async ({ request, params }) => {
    void request;
    void params;

    throw new GuardrailError({
      code: "READ_ONLY_RESOURCE",
      where: "projects/[projectId]/direct-costs/bulk#POST",
      message: "Direct costs are read-only in Alleato. Bulk edits and deletes are disabled.",
      status: 405,
      severity: "medium",
    });
  },
);
