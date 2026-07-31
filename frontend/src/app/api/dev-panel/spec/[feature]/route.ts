import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

import { createClient } from "@/lib/supabase/server";

export const GET = withApiGuardrails<{ feature: string }>(
  "dev-panel/spec/[feature]#GET",
  async ({ request, params }) => {
  const { feature } = await params;

  if (!/^[\w-]+$/.test(feature)) {
    return NextResponse.json({ error: "Invalid feature" }, { status: 400 });
  }

  // 1. Pull from procore_tools (description, workflow, prp_path, slug)
  const supabase = await createClient();
  const { data: tool } = await supabase
    .from("procore_tools")
    .select("name, slug, description, procore_workflow, prp_path, status, category")
    .eq("slug", `/${feature}`)
    .maybeSingle();

  // 2. Pull manifest states for field-level detail
  let manifestStates: Record<string, { description?: string; columns?: unknown[]; formSections?: unknown[] }> = {};
  try {
    const manifestPath = path.join(
      process.cwd(),
      "..",
      ".claude",
      "procore-manifests",
      feature,
      "manifest.json",
    );
    const raw = await readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(raw) as { states?: typeof manifestStates };
    manifestStates = manifest.states ?? {};
	  } catch (error) {
	    console.debug("[dev-panel/spec] Manifest unavailable for feature.", { feature, error });
	  }

  // 3. Read PRP summary (first 3000 chars to keep response lean)
  let prpSummary: string | null = null;
  if (tool?.prp_path) {
    try {
      const prpPath = path.join(process.cwd(), "..", tool.prp_path);
      const raw = await readFile(prpPath, "utf-8");
      prpSummary = raw.slice(0, 3000);
	    } catch (error) {
	      console.debug("[dev-panel/spec] PRP summary unavailable for feature.", { feature, prpPath: tool.prp_path, error });
	    }
	  }

  return NextResponse.json({
    feature,
    tool: tool ?? null,
    manifestStates,
    prpSummary,
  });
  },
);
