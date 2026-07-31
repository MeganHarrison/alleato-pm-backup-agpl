/**
 * Shared Supabase Storage helpers for the admin-feedback bucket.
 *
 * Both the screenshot route and the screen-recording route need to guarantee
 * the bucket exists and is public before signing uploads. This module hosts
 * that bootstrap so the two routes can't drift.
 */

import { GuardrailError } from "@/lib/guardrails/errors";
import { createServiceClient } from "@/lib/supabase/service";
import { ADMIN_FEEDBACK_BUCKET } from "./constants";

function describeError(value: unknown) {
  if (value && typeof value === "object") {
    const maybeMessage = "message" in value ? value.message : undefined;
    const maybeCode = "code" in value ? value.code : undefined;
    return {
      message:
        typeof maybeMessage === "string"
          ? maybeMessage
          : "Unexpected Supabase storage error",
      code: typeof maybeCode === "string" ? maybeCode : undefined,
    };
  }
  if (value instanceof Error) {
    return { message: value.message, code: undefined };
  }
  return { message: "Unexpected error", code: undefined };
}

/**
 * Ensures the admin-feedback bucket exists and is public. Creates it if
 * missing; updates it to public if needed. Throws a GuardrailError that the
 * `withApiGuardrails` wrapper will translate into a structured 500 response.
 *
 * @param where - Caller identifier used in the GuardrailError envelope.
 */
export async function ensureAdminFeedbackBucket(where: string): Promise<void> {
  const serviceSupabase = createServiceClient();
  const { data: bucket, error: getBucketError } =
    await serviceSupabase.storage.getBucket(ADMIN_FEEDBACK_BUCKET);

  if (getBucketError) {
    const details = describeError(getBucketError);
    const isNotFound = /not found|does not exist/i.test(details.message);

    if (!isNotFound) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Unable to verify feedback storage bucket: ${details.message}`,
      });
    }

    const { error: createBucketError } =
      await serviceSupabase.storage.createBucket(ADMIN_FEEDBACK_BUCKET, {
        public: true,
      });

    if (createBucketError) {
      const createDetails = describeError(createBucketError);
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Unable to create feedback storage bucket '${ADMIN_FEEDBACK_BUCKET}': ${createDetails.message}`,
      });
    }

    return;
  }

  if (!bucket.public) {
    const { error: updateBucketError } =
      await serviceSupabase.storage.updateBucket(ADMIN_FEEDBACK_BUCKET, {
        public: true,
      });

    if (updateBucketError) {
      const updateDetails = describeError(updateBucketError);
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Unable to configure feedback storage bucket visibility: ${updateDetails.message}`,
      });
    }
  }
}

/**
 * Removes a single object from the admin-feedback bucket. Used to clean up
 * orphaned screen recordings when the user cancels the feedback dialog
 * before submitting.
 *
 * Failures are returned, not thrown — orphan cleanup must never block the
 * user-facing flow.
 */
export async function deleteAdminFeedbackObject(
  path: string,
): Promise<{ ok: true } | { ok: false; details: string }> {
  if (!path) return { ok: true };
  try {
    const serviceSupabase = createServiceClient();
    const { error } = await serviceSupabase.storage
      .from(ADMIN_FEEDBACK_BUCKET)
      .remove([path]);
    if (error) {
      return { ok: false, details: describeError(error).message };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, details: describeError(error).message };
  }
}
