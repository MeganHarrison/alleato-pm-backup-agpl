import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { requireCurrentUserAppCapability } from "@/lib/app-capabilities";
import { createServiceClient } from "@/lib/supabase/service";
import { buildWipPortfolio } from "@/lib/accounting/wip-portfolio";

export const GET = withApiGuardrails("/api/accounting/wip#GET", async () => {
  await requireCurrentUserAppCapability(
    "view_accounting",
    "/api/accounting/wip#GET",
    "Accounting access required.",
  );

  const supabase = createServiceClient();
  const { rows, summary, forecastDataAvailable } = await buildWipPortfolio(
    supabase,
    "/api/accounting/wip#GET",
  );

  return NextResponse.json({
    rows,
    summary,
    forecastDataAvailable,
    generatedAt: new Date().toISOString(),
  });
});
