export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  deleteTrainingAdminRecord,
  updateTrainingAdminRecord,
} from "@/features/training-admin/server";
import { isTrainingAdminTableKey } from "@/features/training-admin/training-admin-config";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

import { requireTrainingDataAdmin } from "../../_shared";

type RouteParams = { tableKey: string; recordId: string };

function resolveTableKey(value: string, where: string) {
  if (!isTrainingAdminTableKey(value)) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where,
      status: 404,
      message: `Training table '${value}' is not available in the admin editor.`,
    });
  }
  return value;
}

export const PATCH = withApiGuardrails<RouteParams>(
  "admin/training-data/[tableKey]/[recordId]#PATCH",
  async ({ request, params }) => {
    const userId = await requireTrainingDataAdmin(
      "admin/training-data/[tableKey]/[recordId]#PATCH",
    );
    const { tableKey: requestedTable, recordId } = await params;
    const tableKey = resolveTableKey(
      requestedTable,
      "admin/training-data/[tableKey]/[recordId]#PATCH",
    );
    const payload = await request.json().catch(() => null);
    if (!payload) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "admin/training-data/[tableKey]/[recordId]#PATCH",
        status: 400,
        message: "A JSON record payload is required.",
      });
    }
    const record = await updateTrainingAdminRecord(
      tableKey,
      recordId,
      payload,
      userId,
    );
    return NextResponse.json({ record });
  },
);

export const DELETE = withApiGuardrails<RouteParams>(
  "admin/training-data/[tableKey]/[recordId]#DELETE",
  async ({ params }) => {
    await requireTrainingDataAdmin(
      "admin/training-data/[tableKey]/[recordId]#DELETE",
    );
    const { tableKey: requestedTable, recordId } = await params;
    const tableKey = resolveTableKey(
      requestedTable,
      "admin/training-data/[tableKey]/[recordId]#DELETE",
    );
    await deleteTrainingAdminRecord(tableKey, recordId);
    return NextResponse.json({ success: true });
  },
);
