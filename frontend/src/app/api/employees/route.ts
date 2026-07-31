import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { GuardrailError } from "@/lib/guardrails/errors";
import { validateResponseContract, withApiGuardrails } from "@/lib/guardrails/api";

/**
 * GET /api/employees
 * Returns people with person_type = 'employee' or 'user' and status = 'active'.
 * Used by the Command Center assignee dropdown.
 */
const EmployeeSchema = z.object({
  id: z.string(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  job_title: z.string().nullable().optional(),
  person_type: z.string().nullable().optional(),
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

const TEST_NAME_PATTERNS: RegExp[] = [
  /^codex\b/i,
  /\btest\b/i,
  /\btemplate\b/i,
  /\binvite\b/i,
  /^support\b/i,
  /^system$/i,
];

function isTestEmployee(person: {
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): boolean {
  const email = person.email ?? "";
  if (email && TEST_EMAIL_PATTERNS.some((re) => re.test(email))) {
    return true;
  }

  const name = [person.first_name, person.last_name].filter(Boolean).join(" ").trim();
  return Boolean(name && TEST_NAME_PATTERNS.some((re) => re.test(name)));
}

export const GET = withApiGuardrails("/api/employees#GET", async () => {
  const supabase = await createClient();
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "/api/employees#GET",
      message: "Unauthorized employee list request.",
      status: 401,
      severity: "medium",
    });
  }

  const { data, error } = await supabase
    .from("people")
    .select("id, first_name, last_name, email, job_title, person_type")
    .in("person_type", ["employee", "user"])
    .eq("status", "active")
    .order("first_name", { ascending: true });

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/employees#GET",
      message: "Failed to fetch employees.",
      details: { reason: error.message },
      cause: error,
    });
  }

  const employees = (data ?? []).filter((person) => !isTestEmployee(person));

  validateResponseContract(
    z.array(EmployeeSchema),
    employees,
    "/api/employees#GET",
  );

  return NextResponse.json(employees);
});
