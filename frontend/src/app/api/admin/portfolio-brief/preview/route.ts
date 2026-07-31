export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/admin/portfolio-brief/preview
 *
 * L4 review path: synthesizes ACROSS the per-project L2 packets into one
 * cross-portfolio brief and RETURNS it as JSON. Preview only — it never delivers
 * to Teams/email (Phase 5 delivery is human-gated). Use this to satisfy Gate G6:
 * a human reads the output and confirms it reads like an advisor, not a card dump.
 *
 * Auth: Bearer CRON_SECRET
 */

import { NextResponse } from "next/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { buildPortfolioSynthesisBrief } from "@/lib/executive/portfolio-synthesis-brief";

export const POST = withApiGuardrails(
  "/api/admin/portfolio-brief/preview#POST",
  async ({ request }) => {
    const cronSecret = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "/api/admin/portfolio-brief/preview#POST",
        message: "Unauthorized.",
        status: 401,
        severity: "medium",
      });
    }

    const body = await request.json().catch(() => ({}));
    const model: string | undefined = typeof body.model === "string" ? body.model : undefined;

    const brief = await buildPortfolioSynthesisBrief({ model });
    return NextResponse.json({ ok: true, brief });
  },
);
