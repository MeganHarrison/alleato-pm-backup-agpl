export const dynamic = "force-dynamic";

import { z } from "zod";
import { withApiGuardrails, parseJsonBody } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { updateMarketingContentAsset } from "@/lib/ai/services/marketing-service";
import { marketingError } from "../../_utils";

type RouteParams = { assetId: string };

const WHERE_PATCH = "ai-assistant/marketing/assets/[assetId]#PATCH";

const updateAssetSchema = z.object({
  status: z.enum(["draft", "needs_review", "approved", "revision_requested", "published", "archived"]).optional(),
  reviewNotes: z.string().optional(),
});

export const PATCH = withApiGuardrails<RouteParams>(
  WHERE_PATCH,
  async ({ request, params }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: WHERE_PATCH,
        message: "Authentication required to update marketing assets.",
      });
    }

    const body = await parseJsonBody(request, updateAssetSchema, WHERE_PATCH);
    if (!body.status && body.reviewNotes === undefined) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: WHERE_PATCH,
        message: "At least one asset update field is required.",
      });
    }

    try {
      const asset = await updateMarketingContentAsset(params.assetId, {
        ...(body.status ? { status: body.status } : {}),
        ...(body.reviewNotes ? { review_notes: body.reviewNotes } : {}),
      });
      return Response.json({ asset, reviewedBy: user.id });
    } catch (error) {
      throw marketingError(error, WHERE_PATCH);
    }
  },
);
