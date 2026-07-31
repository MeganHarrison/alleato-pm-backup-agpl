import { NextResponse } from "next/server";
import { requireCurrentUserAppCapability } from "@/lib/app-capabilities";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createServiceClient } from "@/lib/supabase/service";
import {
  createSopBacklogRecord,
  createSopBacklogSchema,
  listSopBacklog,
} from "@/lib/accounting/sop-backlog";

const WHERE = "/api/accounting/sop-backlog";

export const GET = withApiGuardrails(`${WHERE}#GET`, async () => {
  await requireCurrentUserAppCapability(
    "view_accounting",
    `${WHERE}#GET`,
    "Accounting access required.",
  );

  const records = await listSopBacklog(createServiceClient());
  return NextResponse.json({ records, generatedAt: new Date().toISOString() });
});

export const POST = withApiGuardrails(`${WHERE}#POST`, async ({ request }) => {
  const { user } = await requireCurrentUserAppCapability(
    "view_accounting",
    `${WHERE}#POST`,
    "Accounting access required.",
  );

  const body = await request.json().catch(() => null);
  const parsed = createSopBacklogSchema.safeParse(body);
  if (!parsed.success) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: `${WHERE}#POST`,
      message: "SOP backlog payload is invalid.",
      details: parsed.error.flatten(),
      status: 400,
    });
  }

  const record = await createSopBacklogRecord(
    createServiceClient(),
    parsed.data,
    user.id,
  );

  return NextResponse.json({ record }, { status: 201 });
});
