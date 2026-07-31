export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getTrainingDoc } from "@/lib/training-docs/server";
import {
  persistTrainingDocQa,
  runTrainingDocQa,
} from "@/lib/training-docs/qa";

import { requireTrainingDocsAdmin } from "../../_shared";

const WHERE_POST = "admin/training-docs/[docId]/qa#POST";

const runQaSchema = z.object({
  useLlm: z.boolean().optional(),
});

export const POST = withApiGuardrails(WHERE_POST, async ({ request, params }) => {
  const { service } = await requireTrainingDocsAdmin(WHERE_POST);
  const body = await parseJsonBody(request, runQaSchema, WHERE_POST);
  const docId = params.docId;

  const doc = await getTrainingDoc(service, docId);
  if (!doc) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: WHERE_POST,
      message: "Training doc not found.",
      status: 404,
    });
  }

  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: WHERE_POST,
      message:
        "A signed-in browser session is required before QA can open the live workflow.",
      status: 401,
    });
  }

  const origin = new URL(request.url).origin;

  const result = await runTrainingDocQa({
    doc,
    origin,
    cookieHeader,
    useLlm: body.useLlm ?? true,
  });

  await persistTrainingDocQa(service, docId, result);

  const updated = await getTrainingDoc(service, docId);
  return NextResponse.json({
    doc: updated,
    qa: {
      status: result.qa_status,
      notes: result.qa_notes,
      checkedRoute: result.checkedRoute,
      usedLlm: result.usedLlm,
    },
  });
});
