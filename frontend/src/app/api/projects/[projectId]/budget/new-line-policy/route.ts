import { withApiGuardrails } from "@/lib/guardrails/api";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions-guard";
import { getBudgetLineAmountPolicy } from "@/lib/budget/new-line-amount-policy";

// GET /api/projects/[projectId]/budget/new-line-policy
// Returns the policy governing budget amounts on newly-created budget lines.
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget/new-line-policy#GET",
  async ({ params }) => {
    const { projectId } = await params;
    const projectIdNum = Number.parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const guard = await requirePermission(projectIdNum, "budget", "read");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const policy = await getBudgetLineAmountPolicy(supabase, projectIdNum);

    return NextResponse.json(policy);
  },
);
