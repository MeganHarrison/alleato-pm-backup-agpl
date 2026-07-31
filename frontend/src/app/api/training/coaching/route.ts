import { NextResponse } from "next/server";

import { createCoachingSessionSchema } from "@/features/training/coaching-session";
import { createCoachingDataAccess } from "@/features/training/coaching-session-server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient } from "@/lib/supabase/server";

const WHERE = "training/coaching";

async function requireCoachingAccess(where: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Sign in again to use coaching sessions.",
    });
  }
  return createCoachingDataAccess(await createClient(), user.id);
}

export const GET = withApiGuardrails(`${WHERE}#GET`, async () => {
  const dal = await requireCoachingAccess(`${WHERE}#GET`);
  const [managing, coached] = await Promise.all([
    dal.listForManager(),
    dal.listForEmployee(),
  ]);
  return NextResponse.json({ managing, coached });
});

export const POST = withApiGuardrails(`${WHERE}#POST`, async ({ request }) => {
  const dal = await requireCoachingAccess(`${WHERE}#POST`);
  const input = await parseJsonBody(
    request,
    createCoachingSessionSchema,
    `${WHERE}#POST`,
  );
  const session = await dal.createSession({
    employeeUserId: input.employeeUserId,
    roleId: input.roleId,
    roleContextKey: input.roleContextKey,
    cycle: input.cycle,
    meetingId: input.meetingId,
  });
  return NextResponse.json({ session });
});
