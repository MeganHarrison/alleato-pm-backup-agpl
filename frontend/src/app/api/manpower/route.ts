import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { getActiveManpowerPayload } from "@/features/manpower/server";

export const GET = withApiGuardrails(
  "manpower#GET",
  async () => {
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "manpower#GET",
        message: "Authentication required.",
      });
    }

    const payload = await getActiveManpowerPayload(supabase);
    return NextResponse.json(payload);
  },
);
