import { z } from "zod";
import { NextResponse } from "next/server";
import { withApiGuardrails, parseJsonBody } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createOutlookIntakeServiceClient } from "@/lib/supabase/service";

const PatchSchema = z.union([
  // Project assignment
  z.object({
    project_id: z.number().int().positive().nullable(),
    match_status: z.undefined(),
    user_tags: z.undefined(),
  }),
  // Explicit status override (e.g. "ignored" / "filtered")
  z.object({
    project_id: z.undefined(),
    match_status: z.enum(["ignored", "unassigned"]),
    user_tags: z.undefined(),
  }),
  // Manual review tags stored under source_metadata.user_tags.
  z.object({
    project_id: z.undefined(),
    match_status: z.undefined(),
    user_tags: z.array(z.string().trim().min(1).max(48)).max(12),
  }),
]);

async function assertAdminAccess(where: string) {
  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Authentication required.",
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where,
      message: profileError.message,
    });
  }

  if (!profile?.is_admin) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where,
      message: "Admin access required.",
      status: 403,
    });
  }

  return supabase;
}

export const PATCH = withApiGuardrails(
  "outlook-intake/[intakeId]#PATCH",
  async ({ request, params }) => {
    await assertAdminAccess("outlook-intake/[intakeId]#PATCH");
    const intakeService = createOutlookIntakeServiceClient();
    const { intakeId: rawIntakeId } = await params;
    const intakeId = parseInt(rawIntakeId, 10);

    if (!Number.isFinite(intakeId) || intakeId <= 0) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "outlook-intake/[intakeId]#PATCH",
        message: "Invalid intake record ID.",
        status: 400,
      });
    }

    const parsed = await parseJsonBody(request, PatchSchema, "outlook-intake/[intakeId]#PATCH");

    let update: Record<string, unknown>;

    if ("user_tags" in parsed && parsed.user_tags !== undefined) {
      const { data: current, error: readError } = await intakeService
        .from("outlook_email_intake")
        .select("source_metadata")
        .eq("id", intakeId)
        .is("deleted_at", null)
        .single();

      if (readError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "outlook-intake/[intakeId]#PATCH",
          message: readError.message,
        });
      }

      const sourceMetadata =
        current?.source_metadata &&
        typeof current.source_metadata === "object" &&
        !Array.isArray(current.source_metadata)
          ? (current.source_metadata as Record<string, unknown>)
          : {};
      const userTags = [...new Set(parsed.user_tags.map((tag) => tag.trim()))]
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right));

      update = {
        source_metadata: {
          ...sourceMetadata,
          user_tags: userTags,
        },
      };
    } else if ("match_status" in parsed && parsed.match_status !== undefined) {
      // Explicit status override — preserve project_id, just change status
      update = {
        match_status: parsed.match_status,
        assignment_method: "manual",
        ...(parsed.match_status === "ignored"
          ? {
              triage_action: "delete",
              triage_reason: "Manually filtered from Outlook intake review.",
              triage_at: new Date().toISOString(),
            }
          : {}),
      };
    } else {
      // Project assignment
      const { project_id } = parsed as { project_id: number | null };
      update = {
        project_id,
        match_status: project_id ? "matched" : "unassigned",
        assignment_method: "manual",
        assignment_confidence: project_id ? 1.0 : null,
      };
    }

    const { data, error } = await intakeService
      .from("outlook_email_intake")
      .update(update)
      .eq("id", intakeId)
      .is("deleted_at", null)
      .select("id, project_id, match_status, assignment_method, assignment_confidence, source_metadata, triage_action, triage_reason, triage_at")
      .single();

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "outlook-intake/[intakeId]#PATCH",
        message: error.message,
      });
    }

    return NextResponse.json(data);
  },
);
