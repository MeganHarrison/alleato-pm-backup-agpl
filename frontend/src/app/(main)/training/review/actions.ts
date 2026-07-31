"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { reviewFreshnessCheck, reviewResource } from "@/lib/training/server";
import { TRAINING_REVIEW_REASON_OPTIONS } from "@/lib/training/types";

const reviewReasonValues = [
  ...TRAINING_REVIEW_REASON_OPTIONS.publish.map(([value]) => value),
  ...TRAINING_REVIEW_REASON_OPTIONS.archive.map(([value]) => value),
] as [
  (typeof TRAINING_REVIEW_REASON_OPTIONS.publish)[number][0],
  ...Array<
    | (typeof TRAINING_REVIEW_REASON_OPTIONS.publish)[number][0]
    | (typeof TRAINING_REVIEW_REASON_OPTIONS.archive)[number][0]
  >,
];
const publishReasons = new Set<string>(
  TRAINING_REVIEW_REASON_OPTIONS.publish.map(([value]) => value),
);
const archiveReasons = new Set<string>(
  TRAINING_REVIEW_REASON_OPTIONS.archive.map(([value]) => value),
);

export type TrainingReviewActionState = {
  status: "idle" | "error";
  message?: string;
};

const reviewRequestSchema = z
  .object({
    resourceId: z.string().uuid(),
    decision: z.enum(["publish", "archive"]),
    reasonCodes: z.array(z.enum(reviewReasonValues)).min(1).max(8),
    ratings: z.object({
      relevance: z.coerce.number().int().min(1).max(5).optional(),
      depth: z.coerce.number().int().min(1).max(5).optional(),
      quality: z.coerce.number().int().min(1).max(5).optional(),
    }),
    notes: z.string().trim().max(1000),
  })
  .superRefine((value, context) => {
    if (value.decision === "archive" && value.notes.length < 8) {
      context.addIssue({
        code: "custom",
        path: ["notes"],
        message:
          "Archive feedback must explain what is wrong with the resource.",
      });
    }
    const allowed =
      value.decision === "publish" ? publishReasons : archiveReasons;
    if (value.reasonCodes.some((reason) => !allowed.has(reason))) {
      context.addIssue({
        code: "custom",
        path: ["reasonCodes"],
        message: `Selected reasons do not match the ${value.decision} decision.`,
      });
    }
  });
const freshnessReviewRequestSchema = z.object({
  checkId: z.string().uuid(),
  decision: z.enum(["keep", "archive"]),
  notes: z.string().trim().min(8).max(1000),
});

function reviewRedirect(status: "success" | "error", message: string) {
  const query = new URLSearchParams({
    reviewStatus: status,
    reviewMessage: message.slice(0, 240),
  });
  return `/training/review?${query.toString()}`;
}

function optionalRating(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value ? value : undefined;
}

export async function decideTrainingResource(
  _previousState: TrainingReviewActionState,
  formData: FormData,
): Promise<TrainingReviewActionState> {
  const request = reviewRequestSchema.safeParse({
    resourceId: formData.get("resourceId"),
    decision: formData.get("decision"),
    reasonCodes: formData.getAll("reasonCodes"),
    ratings: {
      relevance: optionalRating(formData, "relevance"),
      depth: optionalRating(formData, "depth"),
      quality: optionalRating(formData, "quality"),
    },
    notes: formData.get("notes") ?? "",
  });

  if (!request.success) {
    const needsArchiveFeedback = request.error.issues.some(
      (issue) => issue.path[0] === "notes",
    );
    return {
      status: "error",
      message: needsArchiveFeedback
        ? "Explain what is wrong with the resource before archiving it."
        : "Select reasons that match your decision and use ratings from 1 to 5.",
    };
  }

  let destination: string;
  try {
    const status = await reviewResource({
      resourceId: request.data.resourceId,
      decision: request.data.decision,
      reasonCodes: request.data.reasonCodes,
      ratings: request.data.ratings,
      ...(request.data.notes ? { notes: request.data.notes } : {}),
    });
    destination = reviewRedirect(
      "success",
      status === "published"
        ? "Training resource published."
        : "Training resource archived.",
    );
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The training review decision failed unexpectedly. Refresh the queue and try again.",
    };
  }
  revalidatePath("/training/review");
  revalidatePath("/training");
  redirect(destination);
}

export async function decideTrainingFreshness(formData: FormData) {
  const request = freshnessReviewRequestSchema.safeParse({
    checkId: formData.get("checkId"),
    decision: formData.get("decision"),
    notes: formData.get("notes"),
  });

  if (!request.success) {
    redirect(
      reviewRedirect(
        "error",
        "Add a short review note before deciding this freshness finding.",
      ),
    );
  }

  let destination: string;
  try {
    const decision = await reviewFreshnessCheck(request.data);
    destination = reviewRedirect(
      "success",
      decision === "archive"
        ? "Stale training resource archived."
        : "Training resource kept; this evidence will not be queued again.",
    );
  } catch (error) {
    destination = reviewRedirect(
      "error",
      error instanceof Error
        ? error.message
        : "The training freshness decision failed unexpectedly. Refresh the queue and try again.",
    );
  }

  revalidatePath("/training/review");
  revalidatePath("/training");
  redirect(destination);
}
