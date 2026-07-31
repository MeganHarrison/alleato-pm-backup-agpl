export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  createTrainingDocSchema,
  listTrainingDocs,
  mergeTrainingDocMetadata,
  normalizeTrainingDocInput,
} from "@/lib/training-docs/server";

import { requireTrainingDocsAdmin } from "./_shared";

const WHERE_GET = "admin/training-docs#GET";
const WHERE_POST = "admin/training-docs#POST";

export const GET = withApiGuardrails(WHERE_GET, async () => {
  const { service } = await requireTrainingDocsAdmin(WHERE_GET);
  const docs = await listTrainingDocs(service);
  return NextResponse.json({ docs });
});

export const POST = withApiGuardrails(WHERE_POST, async ({ request }) => {
  const { userId, service } = await requireTrainingDocsAdmin(WHERE_POST);
  const body = await parseJsonBody(
    request,
    createTrainingDocSchema,
    WHERE_POST,
  );
  const normalized = normalizeTrainingDocInput(body);

  const { data, error } = await service
    .from("training_docs")
    .insert({
      ...normalized,
      metadata: mergeTrainingDocMetadata(null, body),
      created_by: userId,
      updated_by: userId,
    })
    .select("*")
    .single();

  if (error) {
    const isUnique = error.code === "23505";
    throw new GuardrailError({
      code: isUnique ? "INVALID_PAYLOAD" : "UPSTREAM_FAILURE",
      where: WHERE_POST,
      message: isUnique
        ? "A training doc with this slug already exists."
        : "Failed to create training doc.",
      status: isUnique ? 409 : 500,
      details: error.message,
    });
  }

  return NextResponse.json({ doc: { ...data, assets: [] } });
});
