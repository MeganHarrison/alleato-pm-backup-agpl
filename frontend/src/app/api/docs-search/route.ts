import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";

const MAX_RESULTS = 6;

export const POST = withApiGuardrails(
  "docs-search#POST",
  async ({ request }) => {
  
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "docs-search#POST", message: "Authentication required." });
    }

    const { query } = await request.json().catch(() => ({}));
    const search = typeof query === "string" ? query.trim() : "";

    if (!search) {
      return NextResponse.json({ hits: [] });
    }
    const { data, error } = await supabase
      .from("document_metadata")
      .select(
        "id,title,summary,participants,project,date,fireflies_link,type,source,url",
      )
      .ilike("content", `%${search}%`)
      .order("date", { ascending: false })
      .limit(MAX_RESULTS);

    if (error) {
      return apiErrorResponse(error);
    }

    const hits = (data ?? []).map((record) => ({
      id: record.id,
      title: record.title ?? "Untitled document",
      summary: record.summary ?? "",
      project: record.project,
      date: record.date,
      source: record.source ?? record.url ?? "",
      fireflies_link: record.fireflies_link ?? null,
      type: record.type ?? null,
    }));

    return NextResponse.json({ hits });
    },
);
