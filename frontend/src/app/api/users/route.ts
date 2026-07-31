import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { GuardrailError } from "@/lib/guardrails/errors";
import { validateResponseContract, withApiGuardrails } from "@/lib/guardrails/api";

/**
 * GET /api/users
 *
 * Returns user profiles for the mention/people picker. Filters out obvious
 * test/system accounts that pollute the dropdown — without this, real
 * teammates are buried under dozens of `*@test.com`, `*@alleato.test`,
 * `final-proof-*`, `rls-test-*` etc. seed users.
 *
 * Requires authenticated user.
 */
const UserSchema = z.object({
  id: z.string(),
  email: z.string().nullable().optional(),
  full_name: z.string().nullable().optional(),
  person_id: z.string().nullable().optional(),
});

const TEST_EMAIL_PATTERNS: RegExp[] = [
  /@.*\.test$/i,
  /@test\.com$/i,
  /@example\.com$/i,
  /^rls-test-/i,
  /^codex[-.](?:directory|subcontractor|ssov)/i,
  /\+(?:alleato-(?:invite|template)-test|resend-user-invite-test|confirm-flow|inspect-invite)/i,
  /^(?:debug|debug-resp|final-proof|working-chat|console-check|response-test|stream-test|verify|quick|demo)[-\d]/i,
  /^testadmin\d+@/i,
  /^test\d+@/i,
  /^test\.user@/i,
];

function isTestAccount(email: string | null | undefined): boolean {
  if (!email) return false;
  return TEST_EMAIL_PATTERNS.some((re) => re.test(email));
}

export const GET = withApiGuardrails("/api/users#GET", async () => {
  const requestUser = await getApiRouteUser();
  if (!requestUser) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "/api/users#GET",
      message: "Unauthorized users request.",
      status: 401,
      severity: "medium",
    });
  }

  const supabase = createServiceClient();
  const { data, error } = await serviceDb.from("user_profiles")
    .select("id, email, full_name")
    .order("full_name", { ascending: true, nullsFirst: false });

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/users#GET",
      message: "Failed to fetch users.",
      details: { reason: error.message },
      cause: error,
    });
  }

  // Filter out test/system accounts but always keep the current user visible
  // (so people see themselves in directory listings even on a test domain).
  const users = (data ?? []).filter(
    (user) => user.id === requestUser.id || !isTestAccount(user.email),
  );
  const userIds = users.map((user) => user.id);
  const emails = users
    .map((user) => user.email)
    .filter((email): email is string => Boolean(email));

  const { data: peopleData, error: peopleError } = userIds.length > 0 || emails.length > 0
    ? await serviceDb.from("people")
        .select("id, auth_user_id, email")
        .or(
          [
            userIds.length > 0 ? `auth_user_id.in.(${userIds.join(",")})` : null,
            emails.length > 0 ? `email.in.(${emails.join(",")})` : null,
          ]
            .filter(Boolean)
            .join(","),
        )
    : { data: [], error: null };

  if (peopleError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/users#GET",
      message: "Failed to fetch user directory links.",
      details: { reason: peopleError.message },
      cause: peopleError,
    });
  }

  const peopleByAuthId = new Map((peopleData ?? []).map((person) => [person.auth_user_id, person.id]));
  const peopleByEmail = new Map(
    (peopleData ?? [])
      .filter((person) => person.email)
      .map((person) => [person.email?.toLowerCase(), person.id]),
  );

  const payload = {
    users: users.map((user) => ({
      ...user,
      person_id:
        peopleByAuthId.get(user.id) ??
        (user.email ? peopleByEmail.get(user.email.toLowerCase()) : null) ??
        null,
    })),
  };
  validateResponseContract(
    z.object({ users: z.array(UserSchema) }),
    payload,
    "/api/users#GET",
  );

  return NextResponse.json(payload);
});
