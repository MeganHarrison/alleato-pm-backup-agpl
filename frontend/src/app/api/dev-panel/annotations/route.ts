import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Annotations endpoint — returns all agentation annotations for a given page route.
 * Includes both resolved and pending annotations so the team can see historical context.
 */
export const GET = withApiGuardrails(
  "dev-panel/annotations#GET",
  async ({ request }) => {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url") ?? "";

  // Normalise to just the pathname (strip origin if present)
  let route = url;
  try {
    route = new URL(url).pathname;
	  } catch (error) {
	    console.warn("[dev-panel/annotations] Treating annotation URL as a pathname.", { url, error });
	  }

  const supabase = await createClient();

  // Match on the route column — strip trailing slash for consistency
  const normRoute = route.replace(/\/$/, "") || "/";

  const { data, error } = await supabase
    .from("dev_annotations")
    .select(
      "id, route, comment, screenshot_url, element_selector, component_hint, status, ai_reply, ai_replied_at, resolved_at, created_at",
    )
    .eq("route", normRoute)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ annotations: [] });
  }

  // Map to the shape the AnnotationsTab expects
  const annotations = (data ?? []).map((row) => ({
    id: row.id,
    type: "agentation",
    message: row.comment,
    url: row.route,
    selector: row.element_selector ?? undefined,
    severity: "info" as const,
    created_at: row.created_at,
    acknowledged: row.status === "acknowledged" || row.status === "resolved",
    resolved: row.status === "resolved",
    resolved_at: row.resolved_at ?? undefined,
    ai_reply: row.ai_reply ?? undefined,
    screenshot_url: row.screenshot_url ?? undefined,
    component_hint: row.component_hint ?? undefined,
    status: row.status ?? "pending",
  }));

  return NextResponse.json({ annotations });
  },
);
