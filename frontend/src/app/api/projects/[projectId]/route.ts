import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";

export const PATCH = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]#PATCH",
  async ({ request, params }) => {

    const { projectId } = await params;
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]#PATCH", message: "Authentication required." });
    }
    const supabase = createServiceClient();
    const body = await request.json();

    // Ensure team_members is properly formatted as an array of objects
    if (body.team_members && Array.isArray(body.team_members)) {
      body.team_members = body.team_members.map((member: unknown) => {
        // If member is a string, try to parse it
        if (typeof member === 'string') {
          try {
            return JSON.parse(member);
          } catch {
            return member;
          }
        }
        return member;
      });
    }

    // Update the project with the provided fields
    const { data, error } = await serviceDb.from("projects")
      .update(body)
      .eq("id", Number(projectId))
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update project" },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
    },
);

export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]#GET",
  async ({ request, params }) => {

    const { projectId } = await params;
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]#GET", message: "Authentication required." });
    }

    const supabase = createServiceClient();
    const { data, error } = await serviceDb.from("projects")
      .select("*")
      .eq("id", Number(projectId))
      .single();

    if (error) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Development-only projects are visible ONLY to developers. For anyone else,
    // hide their existence with a 404 (not 403) so a direct URL reveals nothing.
    if ((data as { is_development?: boolean | null } | null)?.is_development === true) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("is_developer")
        .eq("id", user.id)
        .maybeSingle();
      if ((profile as { is_developer?: boolean | null } | null)?.is_developer !== true) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    return NextResponse.json(data);
    },
);

export const DELETE = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]#DELETE",
  async ({ request, params }) => {

    const { projectId } = await params;
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]#DELETE", message: "Authentication required." });
    }

    const supabase = createServiceClient();
    const archiveTimestamp = new Date().toISOString();

    const { data, error } = await serviceDb.from("projects")
      .update({
        archived: true,
        archived_at: archiveTimestamp,
        archived_by: user.id,
        phase: "Archive",
      })
      .eq("id", Number(projectId))
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to archive project" },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
    },
);
