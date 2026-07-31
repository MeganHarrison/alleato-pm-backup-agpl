import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiRouteUser } from "@/lib/supabase/server";
import { isAuthError, verifyProjectAccess } from "@/lib/supabase/auth-guard";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";

const createIssueSchema = z.object({
  title: z.string().trim().min(1, "A title is required.").max(500),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  category: z.literal("Other").default("Other"),
  severity: z.literal("Medium").default("Medium"),
});

async function getProjectContext(params: { projectId: string }): Promise<
  | { response: NextResponse }
  | { projectId: number; user: NonNullable<Awaited<ReturnType<typeof getApiRouteUser>>>; access: Exclude<Awaited<ReturnType<typeof verifyProjectAccess>>, NextResponse> }
> {
  const user = await getApiRouteUser();
  if (!user) throw new GuardrailError({ code: "AUTH_EXPIRED", where: "/coordination-issues", message: "Authentication required." });
  const { projectId: rawProjectId } = params;
  const projectId = Number(rawProjectId);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new GuardrailError({ code: "VALIDATION", where: "/coordination-issues", message: "A valid project id is required." });
  }
  const access = await verifyProjectAccess(projectId, user);
  if (isAuthError(access)) return { response: access };
  return { projectId, user, access };
}

export const GET = withApiGuardrails<{ projectId: string }>("projects/[projectId]/coordination-issues#GET", async ({ params }): Promise<Response> => {
  const result = await getProjectContext(params);
  if ("response" in result) return result.response;
  const { data, error } = await result.access.serviceClient
    .from("issues")
    .select("id, title, description, category, severity, status, created_at")
    .eq("project_id", result.projectId)
    .order("created_at", { ascending: false });
  if (error) throw new GuardrailError({ code: "DATABASE_ERROR", where: "/coordination-issues#GET", message: "Could not load coordination issues.", details: { error: error.message } });
  return NextResponse.json({ issues: data ?? [] });
});

export const POST = withApiGuardrails<{ projectId: string }>("projects/[projectId]/coordination-issues#POST", async ({ request, params }): Promise<Response> => {
  const result = await getProjectContext(params);
  if ("response" in result) return result.response;
  const body = createIssueSchema.parse(await request.json());
  const { data, error } = await result.access.serviceClient
    .from("issues")
    .insert({
      project_id: result.projectId,
      title: body.title,
      description: body.description || null,
      category: body.category,
      severity: body.severity,
      status: "Open",
      reported_by: result.user.id,
    })
    .select("id, title, description, category, severity, status, created_at")
    .single();
  if (error) throw new GuardrailError({ code: "DATABASE_ERROR", where: "/coordination-issues#POST", message: "Could not create the coordination issue.", details: { error: error.message } });
  return NextResponse.json({ issue: data }, { status: 201 });
});
