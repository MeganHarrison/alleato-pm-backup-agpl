"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

export async function startCourseAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const courseId = z.string().uuid().parse(formData.get("courseId"));
  const enrollmentValue = formData.get("enrollmentId");
  const enrollmentId =
    typeof enrollmentValue === "string" && enrollmentValue
      ? z.string().uuid().parse(enrollmentValue)
      : undefined;
  const { data, error } = await (await createClient()).rpc(
    "start_learning_course",
    {
      p_course_id: courseId,
      p_enrollment_id: enrollmentId,
    },
  );
  if (error || !data) {
    throw new Error(`Course start failed: ${error?.message ?? "No enrollment was returned."}`);
  }
  revalidatePath("/training");
  redirect(`/training/learn/${data}`);
}

export async function completeLearningItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const enrollmentId = z.string().uuid().parse(formData.get("enrollmentId"));
  const courseItemId = z.string().uuid().parse(formData.get("courseItemId"));
  const { error } = await (await createClient()).rpc("complete_learning_item", {
    p_enrollment_id: enrollmentId,
    p_course_item_id: courseItemId,
  });
  if (error) throw new Error(`Learning item completion failed: ${error.message}`);
  revalidatePath(`/training/learn/${enrollmentId}`);
  revalidatePath("/training");
}
