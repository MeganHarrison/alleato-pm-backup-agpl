import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const createBudgetChangeSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(2000).optional(),
  changeEventId: z.string().uuid().optional(),
  amount: z.number().optional(),
});

async function generateNextBcNumber(projectId: number): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("budget_changes")
    .select("number")
    .eq("project_id", projectId)
    .not("number", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  let maxSeq = 0;
  for (const row of data ?? []) {
    if (!row.number) continue;
    const match = row.number.match(/BC-(\d+)$/);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  }

  const nextSeq = maxSeq + 1;
  return `BC-${String(nextSeq).padStart(3, "0")}`;
}

export const GET = withApiGuardrails(
  "projects/[projectId]/budget-changes#GET",
  async ({ request, params }) => {
    const { projectId } = await params;
    const numericProjectId = parseInt(projectId as string, 10);
    if (!Number.isFinite(numericProjectId)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const changeEventId = searchParams.get("changeEventId");

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/budget-changes#GET",
        message: "Authentication required.",
      });
    }
    let query = supabase
      .from("budget_changes")
      .select("*")
      .eq("project_id", numericProjectId)
      .order("created_at", { ascending: false });

    if (changeEventId) {
      query = query.eq("change_event_id", changeEventId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  },
);

export const POST = withApiGuardrails(
  "projects/[projectId]/budget-changes#POST",
  async ({ request, params }) => {
    const { projectId } = await params;
    const numericProjectId = parseInt(projectId as string, 10);
    if (!Number.isFinite(numericProjectId)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const body: unknown = await request.json();
    const parsed = createBudgetChangeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();

    const number = await generateNextBcNumber(numericProjectId);

    const { data: inserted, error: insertError } = await supabase
      .from("budget_changes")
      .insert({
        project_id: numericProjectId,
        number,
        title: parsed.data.title.trim(),
        description: parsed.data.description?.trim() ?? null,
        change_event_id: parsed.data.changeEventId ?? null,
        amount: parsed.data.amount ?? null,
        status: "Draft",
        created_by: user?.id ?? null,
      })
      .select("*")
      .single();

    if (insertError || !inserted) {
      return NextResponse.json(
        { error: "Failed to create budget change", details: insertError?.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: inserted }, { status: 201 });
  },
);
