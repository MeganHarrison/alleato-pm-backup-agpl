/**
 * GET /api/testing/tools/[toolName]
 * Returns tool overview, features, and form fields for the reference panel.
 * toolName matches test_suites.tool_name (e.g. "drawings", "budget").
 */
import { withApiGuardrails } from "@/lib/guardrails/api";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const GET = withApiGuardrails<{ toolName: string }>(
  "testing/tools/[toolName]#GET",
  async ({ params }) => {
    const { toolName } = await params;
    const supabase = await createClient();
    const slug = `/${toolName}`;

    const { data: tool } = await supabase
      .from("procore_tools")
      .select("id, name, description, overview, procore_screenshot")
      .eq("slug", slug)
      .maybeSingle();

    if (!tool) {
      return NextResponse.json({ tool: null, features: [], formFields: [] });
    }

    const [featuresRes, fieldsRes] = await Promise.all([
      supabase
        .from("tool_features")
        .select("category, feature_key, feature_name, description, status, sort_order")
        .eq("tool_id", tool.id)
        .order("sort_order"),
      supabase
        .from("tool_form_fields")
        .select("form_name, field_name, field_type, required, description, sort_order")
        .eq("tool_id", tool.id)
        .order("form_name")
        .order("sort_order"),
    ]);

    return NextResponse.json({
      tool,
      features: featuresRes.data ?? [],
      formFields: fieldsRes.data ?? [],
    });
  }
);
