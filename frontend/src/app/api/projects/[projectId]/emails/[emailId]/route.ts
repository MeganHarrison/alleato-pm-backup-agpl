import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { apiErrorResponse } from "@/lib/api-error";
import { buildOwnEmailsFilter } from "@/lib/emails/access";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ projectId: string; emailId: string }>;
}

const EMAIL_SELECT = `
  *,
  projects!project_emails_project_id_fkey (
    id,
    name,
    project_number
  )
`;

type EmailProjectRow = {
  id: number;
  name: string | null;
  project_number: string | null;
};

type EmailRow = {
  id: number;
  project_id: number;
  projects: EmailProjectRow | null;
  [key: string]: unknown;
};

function mapEmailProject<T extends EmailRow>(email: T) {
  const { projects, ...rest } = email;
  return {
    ...rest,
    project: projects
      ? {
          id: projects.id,
          name: projects.name,
          project_number: projects.project_number,
        }
      : null,
  };
}

const updateEmailSchema = z.object({
  subject: z.string().min(1).max(500).optional(),
  body: z.string().optional().nullable(),
  body_html: z.string().optional().nullable(),
  from_name: z.string().optional().nullable(),
  from_email: z.string().email("Invalid email address").optional().nullable(),
  to_list: z.array(z.string()).optional().nullable(),
  cc_list: z.array(z.string()).optional().nullable(),
  bcc_list: z.array(z.string()).optional().nullable(),
  status: z.enum(["Draft", "Sent", "Received", "Failed"]).optional(),
  is_private: z.boolean().optional(),
  is_starred: z.boolean().optional(),
  has_attachments: z.boolean().optional(),
  related_tool: z.string().optional().nullable(),
  related_id: z.string().optional().nullable(),
  distribution_group: z.string().optional().nullable(),
  thread_id: z.string().optional().nullable(),
  project_id: z.number().int().positive().optional(),
});

/**
 * GET /api/projects/[projectId]/emails/[emailId]
 * Fetch a single email by ID
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/emails/[emailId]#GET",
  async ({ request, params }) => {
  
    const { projectId, emailId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/emails/[emailId]#GET", message: "Authentication required." });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = profile?.is_admin === true;

    let query = supabase
      .from("project_emails")
      .select(EMAIL_SELECT)
      .eq("id", parseInt(emailId, 10))
      .eq("project_id", parseInt(projectId, 10))
      .is("deleted_at", null);

    if (!isAdmin) {
      const filter = buildOwnEmailsFilter({ authUserId: user.id, email: user.email });
      if (!filter) {
        return NextResponse.json({ error: "Email not found" }, { status: 404 });
      }
      query = query.or(filter);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Email not found" }, { status: 404 });
      }
      return apiErrorResponse(error);
    }

    return NextResponse.json(mapEmailProject(data as EmailRow));
    },
);

/**
 * PUT /api/projects/[projectId]/emails/[emailId]
 * Update an email
 */
export const PUT = withApiGuardrails(
  "projects/[projectId]/emails/[emailId]#PUT",
  async ({ request, params }) => {
  
    const { projectId, emailId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/emails/[emailId]#PUT", message: "Authentication required." });
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (profileError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/emails/[emailId]#PUT",
        message: profileError.message,
      });
    }

    if (!profile?.is_admin) {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: "projects/[projectId]/emails/[emailId]#PUT",
        message: "Admin access required.",
        status: 403,
      });
    }

    const body = await request.json();
    const validated = updateEmailSchema.parse(body);

    const updateData: Record<string, unknown> = {
      ...validated,
      updated_at: new Date().toISOString(),
    };

    // If status is changing to Sent, set sent_at
    if (validated.status === "Sent") {
      updateData.sent_at = new Date().toISOString();
    }

    const numericEmailId = parseInt(emailId, 10);
    const numericProjectId = parseInt(projectId, 10);

    const { data: existingEmail, error: existingEmailError } = await supabase
      .from("project_emails")
      .select("id, project_id")
      .eq("id", numericEmailId)
      .eq("project_id", numericProjectId)
      .is("deleted_at", null)
      .single();

    if (existingEmailError) {
      if (existingEmailError.code === "PGRST116") {
        return NextResponse.json({ error: "Email not found" }, { status: 404 });
      }
      return apiErrorResponse(existingEmailError);
    }

    const { error } = await supabase
      .from("project_emails")
      .update(updateData)
      .eq("id", existingEmail.id)
      .is("deleted_at", null);

    if (error) {
      return apiErrorResponse(error);
    }

    const { data: updatedEmail, error: updatedEmailError } = await supabase
      .from("project_emails")
      .select(EMAIL_SELECT)
      .eq("id", existingEmail.id)
      .is("deleted_at", null)
      .single();

    if (updatedEmailError) {
      return apiErrorResponse(updatedEmailError);
    }

    return NextResponse.json(mapEmailProject(updatedEmail as EmailRow));
    },
);

/**
 * DELETE /api/projects/[projectId]/emails/[emailId]
 * Soft-delete an email (sets deleted_at)
 */
export const DELETE = withApiGuardrails(
  "projects/[projectId]/emails/[emailId]#DELETE",
  async ({ request, params }) => {
  
    const { projectId, emailId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/emails/[emailId]#DELETE", message: "Authentication required." });
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (profileError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/emails/[emailId]#DELETE",
        message: profileError.message,
      });
    }

    if (!profile?.is_admin) {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: "projects/[projectId]/emails/[emailId]#DELETE",
        message: "Admin access required.",
        status: 403,
      });
    }

    const { data, error } = await supabase
      .from("project_emails")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", parseInt(emailId, 10))
      .eq("project_id", parseInt(projectId, 10))
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Email not found" }, { status: 404 });
      }
      return apiErrorResponse(error);
    }

    return NextResponse.json({ message: "Email deleted", id: data.id });
    },
);
