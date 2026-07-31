import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";

const execAsync = promisify(exec);

const crawlSchema = z.object({
  /** The procore_tools slug to crawl (e.g. "budget", "change-events") */
  slug: z.string().trim().min(1).max(100),
});

async function requireAdmin() {
  const user = await getApiRouteUser();
  if (!user) return null;

  const supabase = createServiceClient();
  const { data: profile } = await serviceDb.from("user_profiles")
    .select("id, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.is_admin ? user : null;
}

export const POST = withApiGuardrails("/api/admin/feedback/crawl#POST", async ({ request }) => {
  const admin = await requireAdmin();
  if (!admin) throw new GuardrailError({ code: "FORBIDDEN", where: "/api/admin/feedback/crawl#POST", message: "Admin access required.", status: 403 });

  const body = await request.json();
  const parsed = crawlSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { slug } = parsed.data;

  // Validate slug exists in procore_tools
  const supabase = createServiceClient();
  const { data: tool } = await serviceDb.from("procore_tools")
    .select("id, name, slug, procore_link")
    .eq("slug", slug)
    .maybeSingle();

  if (!tool) {
    return NextResponse.json({ error: `No tool found with slug "${slug}"` }, { status: 404 });
  }

  // Resolve the project root (two levels up from frontend/src/app/api/...)
  const projectRoot = path.resolve(process.cwd(), "..");
  const scriptPath = path.join(projectRoot, "scripts/playwright-crawl/procore-deep-crawl.js");

  const { stdout, stderr } = await execAsync(
    `node "${scriptPath}" ${slug}`,
    {
      cwd: projectRoot,
      timeout: 120_000, // 2 minute timeout
      env: { ...process.env },
    },
  );

  return NextResponse.json({
    success: true,
    tool: { id: tool.id, name: tool.name, slug: tool.slug },
    output: stdout.slice(-2000), // Last 2000 chars of output
    manifestPath: `.claude/procore-manifests/${slug}/manifest.json`,
    screenshotsFolder: `.claude/procore-manifests/${slug}/screenshots/`,
    warnings: stderr ? stderr.slice(-500) : null,
  });
});
