import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { recruitingCommandSchema } from "@/lib/recruiting/production-contracts";
import {
  executeRecruitingCommand,
  loadRecruitingWorkspace,
} from "@/lib/recruiting/service";

export const dynamic = "force-dynamic";

export const GET = withApiGuardrails(
  "recruiting#GET",
  async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get("query") ?? "workspace";
    if (query !== "workspace") {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "recruiting#GET",
        message: `Unsupported Applicant Tracker query: ${query}.`,
        status: 400,
      });
    }
    const requisitionId = url.searchParams.get("requisitionId");
    if (
      requisitionId &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        requisitionId,
      )
    ) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "recruiting#GET",
        message: "The requested requisition ID is invalid.",
        status: 400,
      });
    }
    return NextResponse.json(
      await loadRecruitingWorkspace(requisitionId),
    );
  },
);

export const POST = withApiGuardrails(
  "recruiting#POST",
  async ({ request }) => {
    const body = await request.json().catch(() => null);
    const parsed = recruitingCommandSchema.safeParse(body);
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "recruiting#POST",
        message:
          "The Applicant Tracker action is invalid. Review the required fields and try again.",
        status: 400,
        details: {
          fields: parsed.error.issues.map((issue) => issue.path.join(".")),
        },
      });
    }
    const canonicalPayload = Object.fromEntries(
      Object.entries(parsed.data).filter(
        ([key]) => key !== "idempotencyKey" && key !== "requestHash",
      ),
    );
    const requestHash = createHash("sha256")
      .update(JSON.stringify(canonicalPayload))
      .digest("hex");
    return NextResponse.json(
      await executeRecruitingCommand({ ...parsed.data, requestHash }),
    );
  },
);
