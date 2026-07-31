import { NextResponse } from "next/server";

import {
  createSkillGrowthDataAccess,
} from "@/features/training/skill-growth-server";
import { saveSkillCheckinSchema } from "@/features/training/skill-growth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { withApiGuardrails, parseJsonBody } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient } from "@/lib/supabase/server";

const WHERE = "training/growth#POST";

export const POST = withApiGuardrails(WHERE, async ({ request }) => {
  const user = await getCurrentUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: WHERE,
      message: "Sign in again before saving your Skill Wheel check-in.",
    });
  }

  const input = await parseJsonBody(
    request,
    saveSkillCheckinSchema,
    WHERE,
  );
  const checkin = await createSkillGrowthDataAccess(
    await createClient(),
    user.id,
  ).save(input);

  return NextResponse.json({ checkin });
});
