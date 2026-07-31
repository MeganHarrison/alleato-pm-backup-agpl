"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { runTrainingResourceFinderAdmin } from "@/lib/training/admin-finder";
import { requireTrainingReviewer } from "@/lib/training/reviewer-access";

const finderRequestSchema = z.object({
  roleSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  topicSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

function finderRedirect(status: "success" | "error", message: string) {
  const query = new URLSearchParams({
    reviewStatus: status,
    reviewMessage: message.slice(0, 240),
  });
  return `/training/review?${query.toString()}`;
}

function plural(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export async function findTrainingResources(formData: FormData) {
  const request = finderRequestSchema.safeParse({
    roleSlug: formData.get("roleSlug"),
    topicSlug: formData.get("topicSlug"),
  });

  if (!request.success) {
    redirect(
      finderRedirect(
        "error",
        "Choose a valid training role and topic before running discovery.",
      ),
    );
  }

  let destination: string;
  try {
    await requireTrainingReviewer("training.findResources");
    const result = await runTrainingResourceFinderAdmin(request.data);

    if (result.status === "failed") {
      destination = finderRedirect(
        "error",
        `No review candidates were added because ${plural(result.failedCount, "write")} failed. Check the finder request in backend logs before retrying.`,
      );
    } else if (result.status === "partial") {
      destination = finderRedirect(
        "error",
        `Added ${plural(result.insertedCount, "review candidate")}, but ${plural(result.failedCount, "write")} failed. Review the queue and backend logs before retrying.`,
      );
    } else if (result.insertedCount > 0) {
      destination = finderRedirect(
        "success",
        `Added ${plural(result.insertedCount, "review candidate")}. ${plural(result.duplicateCount, "duplicate")} and ${plural(result.rejectedCount, "ineligible result")} were skipped.`,
      );
    } else {
      destination = finderRedirect(
        "success",
        `No new review candidates were added. ${plural(result.duplicateCount, "duplicate")} and ${plural(result.rejectedCount, "ineligible result")} were skipped.`,
      );
    }
  } catch (error) {
    destination = finderRedirect(
      "error",
      error instanceof Error
        ? error.message
        : "Training resource discovery failed unexpectedly. Check backend status before retrying.",
    );
  }

  revalidatePath("/training/review");
  redirect(destination);
}
