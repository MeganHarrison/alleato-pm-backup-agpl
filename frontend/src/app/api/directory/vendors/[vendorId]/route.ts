import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const GET = withApiGuardrails<{ vendorId: string }>(
  "directory/vendors/[vendorId]#GET",
  async ({ request, params }) => {
  const { vendorId } = await params;
  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "directory/vendors/[vendorId]#GET",
      message: "Authentication required.",
    });
  }

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", vendorId)
    .eq("is_vendor", true)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
  },
);

export const PATCH = withApiGuardrails<{ vendorId: string }>(
  "directory/vendors/[vendorId]#PATCH",
  async ({ request, params }) => {
  const { vendorId } = await params;
  const supabase = await createClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("companies")
    .update(body)
    .eq("id", vendorId)
    .eq("is_vendor", true)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
  },
);

export const DELETE = withApiGuardrails<{ vendorId: string }>(
  "directory/vendors/[vendorId]#DELETE",
  async ({ request, params }) => {
  const { vendorId } = await params;
  const supabase = await createClient();

  const { error } = await supabase
    .from("companies")
    .update({ status: "inactive" })
    .eq("id", vendorId)
    .eq("is_vendor", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
  },
);
