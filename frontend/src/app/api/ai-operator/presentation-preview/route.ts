import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  parseAndRenderOperatorMessageForTeams,
} from "@/lib/ai/operator/presentation";

const WHERE = "/api/ai-operator/presentation-preview#POST";

function ensurePreviewAllowed() {
  if (process.env.VERCEL_ENV === "production") {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: WHERE,
      message:
        "Operator presentation preview is disabled in production because it is a no-send test surface.",
      status: 403,
    });
  }
}

export const POST = withApiGuardrails(WHERE, async ({ request }) => {
  ensurePreviewAllowed();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    throw new GuardrailError({
      code: "BAD_REQUEST",
      where: WHERE,
      message:
        error instanceof Error
          ? `Invalid JSON body: ${error.message}`
          : "Invalid JSON body.",
      status: 400,
    });
  }

  const rendered = parseAndRenderOperatorMessageForTeams(payload);
  if ("success" in rendered && rendered.success === false) {
    return NextResponse.json(
      {
        success: false,
        error_code: rendered.errorCode,
        field_errors: rendered.fieldErrors,
        form_errors: rendered.formErrors,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    ...rendered,
  });
});
