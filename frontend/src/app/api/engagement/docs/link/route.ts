import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { issueDocsTrainingAssertion } from "@/lib/analytics/docs-training-assertion";
import { isTrackableVideoLesson } from "@/lib/analytics/video-tracking";
import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";

const WHERE = "api.engagement.docs.link#GET";
const DOCS_ORIGIN = "https://docs.alleatogroup.com";
const ASSERTION_FRAGMENT_KEY = "alleato_training_assertion";

function docsTarget(path: string | null): URL {
  const value = path?.trim() || "/";
  if (!value.startsWith("/") || value.startsWith("//")) {
    throw new GuardrailError({
      code: "INVALID_INPUT",
      where: WHERE,
      message: "Documentation path must be an absolute path on the Alleato docs site.",
      status: 422,
    });
  }
  const target = new URL(value, DOCS_ORIGIN);
  if (target.origin !== DOCS_ORIGIN || target.hash) {
    throw new GuardrailError({
      code: "INVALID_INPUT",
      where: WHERE,
      message: "Documentation path must stay within the Alleato docs site.",
      status: 422,
    });
  }
  return target;
}

export const GET = withApiGuardrails(WHERE, async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: WHERE,
      message: "Sign in to Alleato before opening attributed training documentation.",
      status: 401,
    });
  }

  const target = docsTarget(request.nextUrl.searchParams.get("path"));
  const sourceId = decodeURIComponent(target.pathname).replace(/^\/+|\/+$/g, "");
  const { data: content, error: contentError } = await serviceDb
    .from("knowledge_content_item")
    .select("id, content_kind, source_type")
    .eq("source_type", "docs")
    .eq("source_id", sourceId)
    .maybeSingle();
  if (contentError) {
    throw new GuardrailError({
      code: "DATABASE_ERROR",
      where: WHERE,
      message: "The requested documentation lesson could not be resolved.",
      details: contentError.message,
    });
  }
  if (!isTrackableVideoLesson(content)) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: WHERE,
      message: "This documentation page is not registered as a trackable video lesson.",
      status: 404,
    });
  }
  target.hash = new URLSearchParams({
    [ASSERTION_FRAGMENT_KEY]: issueDocsTrainingAssertion(user.id, sourceId),
  }).toString();

  return NextResponse.redirect(target, {
    status: 307,
    headers: {
      "cache-control": "private, no-store, max-age=0",
      "referrer-policy": "no-referrer",
    },
  });
});
