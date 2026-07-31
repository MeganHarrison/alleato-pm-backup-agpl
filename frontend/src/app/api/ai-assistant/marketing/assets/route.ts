export const dynamic = "force-dynamic";

import { z } from "zod";
import { withApiGuardrails, parseJsonBody } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createMarketingContentAsset } from "@/lib/ai/services/marketing-service";
import { marketingError } from "../_utils";
import type { Json } from "@/types/database.types";

const WHERE_POST = "ai-assistant/marketing/assets#POST";

const createAssetSchema = z.object({
  calendarItemId: z.string().min(1),
  assetType: z.enum([
    "linkedin_post",
    "blog_outline",
    "blog_draft",
    "email_draft",
    "case_study_outline",
    "video_script",
    "image_prompt",
    "sales_blurb",
  ]),
  title: z.string().min(1),
  body: z.string().min(1),
  sourceCitations: z.array(z.record(z.string(), z.unknown())).default([]),
  status: z.enum(["draft", "needs_review", "approved", "revision_requested", "published", "archived"]).default("needs_review"),
});

export const POST = withApiGuardrails(WHERE_POST, async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: WHERE_POST,
      message: "Authentication required to create marketing assets.",
    });
  }

  const body = await parseJsonBody(request, createAssetSchema, WHERE_POST);

  try {
    const asset = await createMarketingContentAsset({
      calendar_item_id: body.calendarItemId,
      asset_type: body.assetType,
      title: body.title,
      body: body.body,
      source_citations: body.sourceCitations as Json,
      status: body.status,
      created_by: user.id,
    });
    return Response.json({ asset }, { status: 201 });
  } catch (error) {
    throw marketingError(error, WHERE_POST);
  }
});
