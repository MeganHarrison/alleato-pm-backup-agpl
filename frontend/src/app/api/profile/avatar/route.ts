import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { apiErrorResponse } from "@/lib/api-error";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGES_BUCKET = "profile-images";
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

type ApiErrorPayload = {
  error: string;
  code?: string;
  hint?: string;
  details?: string;
};

function toErrorDetails(value: unknown): {
  message: string;
  code?: string;
  details?: string;
} {
  if (typeof value === "object" && value !== null) {
    const maybeMessage = "message" in value ? value.message : undefined;
    const maybeCode = "code" in value ? value.code : undefined;
    const maybeDetails = "details" in value ? value.details : undefined;

    return {
      message:
        typeof maybeMessage === "string"
          ? maybeMessage
          : "Unexpected Supabase error",
      code: typeof maybeCode === "string" ? maybeCode : undefined,
      details: typeof maybeDetails === "string" ? maybeDetails : undefined,
    };
  }

  if (value instanceof Error) {
    return { message: value.message };
  }

  return { message: "Unexpected error" };
}

function jsonError(
  status: number,
  payload: ApiErrorPayload,
): NextResponse<ApiErrorPayload> {
  return NextResponse.json(payload, { status });
}

async function ensureProfileBucket() {
  const serviceSupabase = createServiceClient();
  const { data: bucket, error: getBucketError } =
    await serviceSupabase.storage.getBucket(PROFILE_IMAGES_BUCKET);

  if (getBucketError) {
    const details = toErrorDetails(getBucketError);
    const message = details.message.toLowerCase();
    const normalizedDetails = (details.details || "").toLowerCase();
    const isNotFound =
      message.includes("not found") ||
      message.includes("does not exist") ||
      message.includes("could not find the bucket") ||
      normalizedDetails.includes("not found");

    if (!isNotFound) {
      return {
        ok: false as const,
        response: jsonError(500, {
          error: "Unable to verify profile image storage bucket",
          code: details.code,
          hint: "Check Supabase Storage permissions for the service role.",
          details: details.message,
        }),
      };
    }

    const { error: createBucketError } = await serviceSupabase.storage.createBucket(
      PROFILE_IMAGES_BUCKET,
      {
        public: true,
      },
    );

    if (createBucketError) {
      const createDetails = toErrorDetails(createBucketError);
      const createMessage = createDetails.message.toLowerCase();
      const createDetailsText = (createDetails.details || "").toLowerCase();
      const bucketAlreadyExists =
        createMessage.includes("already exists") ||
        createDetailsText.includes("already exists");

      if (bucketAlreadyExists) {
        return { ok: true as const };
      }

      return {
        ok: false as const,
        response: jsonError(500, {
          error: "Unable to create profile image storage bucket",
          code: createDetails.code,
          hint: "Create a public Storage bucket named 'profile-images' in Supabase.",
          details: createDetails.message,
        }),
      };
    }

    return { ok: true as const };
  }

  if (!bucket.public) {
    const { error: updateBucketError } = await serviceSupabase.storage.updateBucket(
      PROFILE_IMAGES_BUCKET,
      { public: true },
    );

    if (updateBucketError) {
      const updateDetails = toErrorDetails(updateBucketError);
      return {
        ok: false as const,
        response: jsonError(500, {
          error: "Unable to configure profile image bucket visibility",
          code: updateDetails.code,
          hint: "Make sure 'profile-images' bucket is public for avatar rendering.",
          details: updateDetails.message,
        }),
      };
    }
  }

  return { ok: true as const };
}

function extractStoragePathFromPublicUrl(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${PROFILE_IMAGES_BUCKET}/`;
  const markerIndex = publicUrl.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }
  return decodeURIComponent(publicUrl.slice(markerIndex + marker.length));
}

export const POST = withApiGuardrails(
  "profile/avatar#POST",
  async ({ request }) => {
  
    const serviceSupabase = createServiceClient();
    const bucketReady = await ensureProfileBucket();
    if (!bucketReady.ok) {
      return bucketReady.response;
    }

    const requestUser = await getApiRouteUser();
    if (!requestUser) {
      return jsonError(401, {
        error: "Unauthorized",
        hint: "Sign in again and retry the upload.",
      });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Image file is required" },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported image type. Use PNG, JPG, WEBP, or GIF." },
        { status: 400 },
      );
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Image must be smaller than 5MB" },
        { status: 400 },
      );
    }

    const extensionByMimeType: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const fileExt = extensionByMimeType[file.type] || "png";
    const filePath = `avatars/${requestUser.id}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await serviceSupabase.storage
      .from(PROFILE_IMAGES_BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      const details = toErrorDetails(uploadError);
      const normalized = details.message.toLowerCase();
      const isRlsError =
        normalized.includes("row-level security") ||
        normalized.includes("not allowed");
      const isBucketError =
        normalized.includes("bucket") &&
        (normalized.includes("not found") || normalized.includes("does not exist"));

      return jsonError(isRlsError ? 403 : 500, {
        error: "Profile photo upload failed",
        code: details.code,
        hint: isRlsError
          ? "Storage policy rejected this write. Check storage.objects INSERT policy for bucket 'profile-images'."
          : isBucketError
            ? "Bucket 'profile-images' is missing or inaccessible."
            : "Check Supabase Storage configuration and server environment variables.",
        details: details.message,
      });
    }

    const {
      data: { publicUrl },
    } = serviceSupabase.storage.from(PROFILE_IMAGES_BUCKET).getPublicUrl(filePath);

    const { data: authUserData, error: authUserError } =
      await serviceSupabase.auth.admin.getUserById(requestUser.id);

    if (authUserError || !authUserData.user) {
      const details = toErrorDetails(authUserError);
      return jsonError(500, {
        error: "Profile photo uploaded but user profile lookup failed",
        code: details.code,
        hint: "Check service-role auth admin permissions.",
        details: details.message,
      });
    }

    const mergedMetadata = {
      ...(authUserData.user.user_metadata || {}),
      avatar_url: publicUrl,
    };

    const { error: updateError } =
      await serviceSupabase.auth.admin.updateUserById(requestUser.id, {
        user_metadata: mergedMetadata,
      });

    if (updateError) {
      const details = toErrorDetails(updateError);
      return jsonError(500, {
        error: "Profile photo uploaded but metadata update failed",
        code: details.code,
        hint: "Verify service-role key and Supabase Auth admin access.",
        details: details.message,
      });
    }

    return NextResponse.json({ avatarUrl: publicUrl }, { status: 200 });
    },
);

export const DELETE = withApiGuardrails(
  "profile/avatar#DELETE",
  async () => {
  
    const serviceSupabase = createServiceClient();
    const requestUser = await getApiRouteUser();

    if (!requestUser) {
      return jsonError(401, {
        error: "Unauthorized",
        hint: "Sign in again and retry removing your photo.",
      });
    }

    const { data: authUserData, error: authUserError } =
      await serviceSupabase.auth.admin.getUserById(requestUser.id);

    if (authUserError || !authUserData.user) {
      const details = toErrorDetails(authUserError);
      return jsonError(500, {
        error: "Failed to look up current user metadata",
        code: details.code,
        details: details.message,
      });
    }

    const currentAvatarUrl = authUserData.user.user_metadata?.avatar_url as
      | string
      | undefined;
    if (currentAvatarUrl) {
      const storagePath = extractStoragePathFromPublicUrl(currentAvatarUrl);
      if (storagePath) {
        await serviceSupabase.storage
          .from(PROFILE_IMAGES_BUCKET)
          .remove([storagePath]);
      }
    }

    const mergedMetadata = {
      ...(authUserData.user.user_metadata || {}),
      avatar_url: null,
    };

    const { error: updateError } =
      await serviceSupabase.auth.admin.updateUserById(requestUser.id, {
        user_metadata: mergedMetadata,
      });

    if (updateError) {
      const details = toErrorDetails(updateError);
      return jsonError(500, {
        error: "Failed to remove profile image",
        code: details.code,
        details: details.message,
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
    },
);
