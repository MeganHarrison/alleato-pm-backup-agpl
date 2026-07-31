import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { verifyProjectAccess, isAuthError } from "@/lib/supabase/auth-guard";
import { apiErrorResponse } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// GET /api/projects/[projectId]/directory/vendors
export const GET = withApiGuardrails(
  "projects/[projectId]/directory/vendors#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    const authResult = await verifyProjectAccess(projectIdNum);
    if (isAuthError(authResult)) return authResult;
    const supabase = authResult.serviceClient;

    const { data, error } = await supabase
      .from("project_vendors")
      .select(
        `
        id,
        added_at,
        added_by,
        notes,
        companies(
          id,
          name,
          legal_name,
          vendor_class,
          contact_name,
          contact_email,
          contact_phone,
          city,
          state,
          status,
          acumatica_vendor_id
        )
      `,
      )
      .eq("project_id", projectIdNum)
      .order("added_at", { ascending: false });

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ data: data ?? [] });
    },
);

// POST /api/projects/[projectId]/directory/vendors
export const POST = withApiGuardrails(
  "projects/[projectId]/directory/vendors#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    const authResult = await verifyProjectAccess(projectIdNum);
    if (isAuthError(authResult)) return authResult;
    const supabase = authResult.serviceClient;

    const body = await request.json();
    const { vendor_id, notes } = body;

    if (!vendor_id) {
      return NextResponse.json(
        { error: "vendor_id is required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("project_vendors")
      .insert({ project_id: projectIdNum, vendor_id, notes: notes ?? null })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This vendor is already on the project" },
          { status: 409 },
        );
      }
      return apiErrorResponse(error);
    }

    return NextResponse.json({ data }, { status: 201 });
    },
);

// DELETE /api/projects/[projectId]/directory/vendors
export const DELETE = withApiGuardrails(
  "projects/[projectId]/directory/vendors#DELETE",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    const authResult = await verifyProjectAccess(projectIdNum);
    if (isAuthError(authResult)) return authResult;
    const supabase = authResult.serviceClient;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("project_vendors")
      .delete()
      .eq("id", id)
      .eq("project_id", projectIdNum);

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ success: true });
    },
);
