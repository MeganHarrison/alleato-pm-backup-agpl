import { NextResponse } from "next/server";
import { requireCurrentUserAppCapability } from "@/lib/app-capabilities";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createServiceClient } from "@/lib/supabase/service";
import {
  updateSopBacklogRecord,
  updateSopBacklogSchema,
} from "@/lib/accounting/sop-backlog";

const WHERE = "/api/accounting/sop-backlog/[sopId]";

type RouteParams = {
  sopId: string;
};

export const PATCH = withApiGuardrails<RouteParams>(
  `${WHERE}#PATCH`,
  async ({ request, params }) => {
    await requireCurrentUserAppCapability(
      "view_accounting",
      `${WHERE}#PATCH`,
      "Accounting access required.",
    );

    const body = await request.json().catch(() => null);
    const parsed = updateSopBacklogSchema.safeParse(body);
    if (!parsed.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: `${WHERE}#PATCH`,
        message: "SOP backlog update payload is invalid.",
        details: parsed.error.flatten(),
        status: 400,
      });
    }

    const record = await updateSopBacklogRecord(
      createServiceClient(),
      params.sopId,
      parsed.data,
    );

    return NextResponse.json({ record });
  },
);
