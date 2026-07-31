export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  createTrainingAdminRecord,
  listTrainingAdminRecords,
} from "@/features/training-admin/server";
import { isTrainingAdminTableKey } from "@/features/training-admin/training-admin-config";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

import { requireTrainingDataAdmin } from "../_shared";

type RouteParams = { tableKey: string };

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

export const GET = withApiGuardrails<RouteParams>(
  "admin/training-data/[tableKey]#GET",
  async ({ params }) => {
    await requireTrainingDataAdmin("admin/training-data/[tableKey]#GET");
    const { tableKey: requestedTable } = await params;
    const tableKey = resolveTableKey(
      requestedTable,
      "admin/training-data/[tableKey]#GET",
    );
    return NextResponse.json(await listTrainingAdminRecords(tableKey));
  },
);

export const POST = withApiGuardrails<RouteParams>(
  "admin/training-data/[tableKey]#POST",
  async ({ request, params }) => {
    const userId = await requireTrainingDataAdmin(
      "admin/training-data/[tableKey]#POST",
    );
    const { tableKey: requestedTable } = await params;
    const tableKey = resolveTableKey(
      requestedTable,
      "admin/training-data/[tableKey]#POST",
    );
    const payload = await request.json().catch(() => null);
    if (!payload) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "admin/training-data/[tableKey]#POST",
        status: 400,
        message: "A JSON record payload is required.",
      });
    }
    const record = await createTrainingAdminRecord(tableKey, payload, userId);
    return NextResponse.json({ record }, { status: 201 });
  },
);
