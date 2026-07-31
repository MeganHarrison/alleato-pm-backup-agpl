import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";

// Subscribes the current user to a specification section for revision notifications.
export const POST = withApiGuardrails<{ projectId: string; sectionId: string }>(
  "projects/[projectId]/specifications/[sectionId]/subscribe#POST",
  async ({ params }) => {
    const { projectId, sectionId } = await params;
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/specifications/[sectionId]/subscribe#POST",
        message: "Authentication required.",
      });
    }

    const projectIdNum = Number.parseInt(projectId, 10);
    const sectionIdNum = Number.parseInt(sectionId, 10);
    if (!Number.isFinite(projectIdNum) || !Number.isFinite(sectionIdNum)) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "projects/[projectId]/specifications/[sectionId]/subscribe#POST",
        message: "Invalid project or section ID.",
      });
    }


    const { data: section, error: sectionError } = await serviceDb.from("specification_sections")
      .select("id")
      .eq("id", sectionIdNum)
      .eq("project_id", projectIdNum)
      .single();

    if (sectionError || !section) {
      return NextResponse.json({ error: "Specification section not found" }, { status: 404 });
    }

    const { error } = await serviceDb.from("specification_subscribers").insert({
      section_id: sectionIdNum,
      user_id: user.id,
    });

    if (error && error.code !== "23505") {
      return NextResponse.json(
        { error: "Failed to subscribe", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ subscribed: true }, { status: 200 });
  },
);

// Unsubscribes the current user from a specification section.
export const DELETE = withApiGuardrails<{ projectId: string; sectionId: string }>(
  "projects/[projectId]/specifications/[sectionId]/subscribe#DELETE",
  async ({ params }) => {
    const { projectId, sectionId } = await params;
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/specifications/[sectionId]/subscribe#DELETE",
        message: "Authentication required.",
      });
    }

    const projectIdNum = Number.parseInt(projectId, 10);
    const sectionIdNum = Number.parseInt(sectionId, 10);
    if (!Number.isFinite(projectIdNum) || !Number.isFinite(sectionIdNum)) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "projects/[projectId]/specifications/[sectionId]/subscribe#DELETE",
        message: "Invalid project or section ID.",
      });
    }


    const { data: section, error: sectionError } = await serviceDb.from("specification_sections")
      .select("id")
      .eq("id", sectionIdNum)
      .eq("project_id", projectIdNum)
      .single();

    if (sectionError || !section) {
      return NextResponse.json({ error: "Specification section not found" }, { status: 404 });
    }

    const { error } = await serviceDb.from("specification_subscribers")
      .delete()
      .eq("section_id", sectionIdNum)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to unsubscribe", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ subscribed: false }, { status: 200 });
  },
);
