import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { isAuthError, verifyProjectAccess } from "@/lib/supabase/auth-guard";

type Params = { params: Promise<{ projectId: string; drawingId: string }> };
const PIN_TYPES = ["rfi", "punch_item", "coordination_issue", "drawing", "document", "photo", "submittal", "task"] as const;

function isPinType(value: unknown): value is (typeof PIN_TYPES)[number] {
  return typeof value === "string" && (PIN_TYPES as readonly string[]).includes(value);
}

type PinRow = {
  id: string;
  project_id: number;
  pin_type: string;
  entity_id: string | null;
  entity_label: string | null;
  entity_number: string | null;
  entity_status: string | null;
  [key: string]: unknown;
};

async function enrichPinSummary(serviceClient: SupabaseClient<Database>, pin: PinRow) {
  if (!pin.entity_id) return pin;
  const base = { ...pin };
  switch (pin.pin_type) {
    case "rfi": {
      const { data } = await serviceClient.from("rfis").select("number, subject, question, status").eq("id", pin.entity_id).eq("project_id", pin.project_id).maybeSingle();
      return data ? { ...base, entity_number: `#${data.number}`, entity_label: data.subject, entity_description: data.question, entity_status: data.status } : base;
    }
    case "punch_item": {
      const { data } = await serviceClient.from("punch_items").select("number, title, description, status").eq("id", pin.entity_id).eq("project_id", pin.project_id).maybeSingle();
      return data ? { ...base, entity_number: `#${data.number}`, entity_label: data.title, entity_description: data.description, entity_status: data.status } : base;
    }
    case "document": {
      const { data } = await serviceClient.from("project_documents").select("title, description, status").eq("id", Number(pin.entity_id)).eq("project_id", pin.project_id).maybeSingle();
      return data ? { ...base, entity_label: data.title, entity_description: data.description, entity_status: data.status } : base;
    }
    case "submittal": {
      const { data } = await serviceClient.from("submittals").select("submittal_number, title, description, status").eq("id", pin.entity_id).eq("project_id", pin.project_id).maybeSingle();
      return data ? { ...base, entity_number: data.submittal_number, entity_label: data.title, entity_description: data.description, entity_status: data.status } : base;
    }
    case "drawing": {
      const { data } = await serviceClient.from("drawings").select("drawing_number, title").eq("id", pin.entity_id).eq("project_id", pin.project_id).maybeSingle();
      return data ? { ...base, entity_number: data.drawing_number, entity_label: data.title, entity_description: data.title } : base;
    }
    case "photo": {
      const { data } = await serviceClient.from("project_photos").select("title, description").eq("id", Number(pin.entity_id)).eq("project_id", pin.project_id).maybeSingle();
      return data ? { ...base, entity_label: data.title, entity_description: data.description } : base;
    }
    case "coordination_issue": {
      const { data } = await serviceClient.from("issues").select("title, description, status").eq("id", Number(pin.entity_id)).eq("project_id", pin.project_id).maybeSingle();
      return data ? { ...base, entity_label: data.title, entity_description: data.description, entity_status: data.status } : base;
    }
    case "task": {
      const { data } = await serviceClient.from("tasks").select("title, description, status").eq("id", pin.entity_id).eq("project_id", pin.project_id).maybeSingle();
      return data ? { ...base, entity_label: data.title ?? base.entity_label, entity_description: data.description, entity_status: data.status } : base;
    }
    default:
      return base;
  }
}

/**
 * GET /api/projects/[projectId]/drawings/[drawingId]/pins
 * List all markup pins for a drawing.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/drawings/[drawingId]/pins#GET",
  async ({ request, params }) => {
  const user = await getApiRouteUser();
  if (!user) throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/[drawingId]/pins#GET", message: "Authentication required." });

  const { projectId: projectIdParam, drawingId } = await params;
  const projectId = Number(projectIdParam);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new GuardrailError({ code: "VALIDATION", where: "projects/[projectId]/drawings/[drawingId]/pins#GET", message: "A valid project id is required." });
  }
  const access = await verifyProjectAccess(projectId, user);
  if (isAuthError(access)) return access;

  const { data, error } = await access.serviceClient
    .from("drawing_markup_pins")
    .select("*")
    .eq("drawing_id", drawingId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) return apiErrorResponse(error);
  const pins = await Promise.all((data ?? []).map((pin) => enrichPinSummary(access.serviceClient, pin as PinRow)));
  return NextResponse.json({ pins });
  },
);

/**
 * POST /api/projects/[projectId]/drawings/[drawingId]/pins
 * Create a new markup pin.
 * Body: { x_pct, y_pct, page, pin_type, entity_id?, entity_label?, entity_number?, entity_status?, color? }
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/drawings/[drawingId]/pins#POST",
  async ({ request, params }) => {
  const user = await getApiRouteUser();
  if (!user) throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/[drawingId]/pins#POST", message: "Authentication required." });

  const { projectId: projectIdParam, drawingId } = await params;
  const body = await request.json();
  const projectId = Number(projectIdParam);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new GuardrailError({ code: "VALIDATION", where: "projects/[projectId]/drawings/[drawingId]/pins#POST", message: "A valid project id is required." });
  }
  if (!isPinType(body?.pin_type)) {
    throw new GuardrailError({ code: "VALIDATION", where: "projects/[projectId]/drawings/[drawingId]/pins#POST", message: `pin_type must be one of: ${PIN_TYPES.join(", ")}.` });
  }
  const x = Number(body?.x_pct);
  const y = Number(body?.y_pct);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) {
    throw new GuardrailError({ code: "VALIDATION", where: "projects/[projectId]/drawings/[drawingId]/pins#POST", message: "Pin coordinates must be percentages between 0 and 100." });
  }
  const access = await verifyProjectAccess(projectId, user);
  if (isAuthError(access)) return access;

  const { data, error } = await access.serviceClient
    .from("drawing_markup_pins")
    .insert({
      drawing_id: drawingId,
      project_id: projectId,
      x_pct: x,
      y_pct: y,
      page: Number.isInteger(body.page) && body.page > 0 ? body.page : 1,
      pin_type: body.pin_type,
      entity_id: body.entity_id ?? null,
      entity_label: body.entity_label ?? null,
      entity_number: body.entity_number ?? null,
      entity_status: body.entity_status ?? null,
      color: body.color ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return apiErrorResponse(error);
  return NextResponse.json({ pin: data }, { status: 201 });
  },
);
