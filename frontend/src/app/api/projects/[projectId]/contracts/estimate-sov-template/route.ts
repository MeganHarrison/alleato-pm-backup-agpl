import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requirePermission } from "@/lib/permissions-guard";
import { createAlleatoEstimateWorkbookTemplate } from "@/lib/prime-contracts/estimate-workbook-sov";

const WHERE = "projects/[projectId]/contracts/estimate-sov-template#GET";

export const GET = withApiGuardrails<{ projectId: string }>(
  WHERE,
  async ({ params }) => {
    const numericProjectId = Number.parseInt(params.projectId, 10);

    if (Number.isNaN(numericProjectId)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: WHERE,
        message: "Invalid project ID.",
      });
    }

    const guard = await requirePermission(
      numericProjectId,
      "contracts",
      "read",
    );
    if (guard.denied) return guard.response;

    const workbook = createAlleatoEstimateWorkbookTemplate();

    return new NextResponse(workbook, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="prime-contract-sov-template.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  },
);
