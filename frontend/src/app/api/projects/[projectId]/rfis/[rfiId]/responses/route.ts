/**
 * Internal RFI responses endpoint (authenticated).
 *
 * Lists the formal responses captured from the no-login channels (web page /
 * email reply) for a given RFI, and lets an internal user designate one as the
 * official response.
 *
 * GET   /api/projects/[projectId]/rfis/[rfiId]/responses
 * PATCH /api/projects/[projectId]/rfis/[rfiId]/responses  { responseId, is_official }
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { apiErrorResponse } from "@/lib/api-error";

export const GET = withApiGuardrails<{ projectId: string; rfiId: string }>(
  "projects/[projectId]/rfis/[rfiId]/responses#GET",
  async ({ params }) => {
    const { rfiId } = await params;
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/rfis/[rfiId]/responses#GET",
        message: "Authentication required.",
      });
    }

    const supabase = createServiceClient();
    const { data, error } = await serviceDb.from("rfi_responses")
      .select(
        "id, responder_name, responder_email, body, source, is_official, created_at",
      )
      .eq("rfi_id", rfiId)
      .order("created_at", { ascending: true });

    if (error) return apiErrorResponse(error);
    return NextResponse.json({ responses: data ?? [] });
  },
);

export const PATCH = withApiGuardrails<{ projectId: string; rfiId: string }>(
  "projects/[projectId]/rfis/[rfiId]/responses#PATCH",
  async ({ request, params }) => {
    const { rfiId } = await params;
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/rfis/[rfiId]/responses#PATCH",
        message: "Authentication required.",
      });
    }

    const body = (await request.json().catch(() => ({}))) as {
      responseId?: string;
      is_official?: boolean;
    };
    if (!body.responseId || typeof body.is_official !== "boolean") {
      return NextResponse.json(
        { error: "responseId and is_official are required." },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // Only one official response per RFI: clear the others when marking official.
    if (body.is_official) {
      await serviceDb.from("rfi_responses")
        .update({ is_official: false })
        .eq("rfi_id", rfiId);
    }

    const { data, error } = await serviceDb.from("rfi_responses")
      .update({ is_official: body.is_official })
      .eq("id", body.responseId)
      .eq("rfi_id", rfiId)
      .select("id, is_official")
      .single();

    if (error) return apiErrorResponse(error);
    return NextResponse.json({ response: data });
  },
);
