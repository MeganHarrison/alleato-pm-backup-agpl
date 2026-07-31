import "server-only";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient } from "@/lib/supabase/server";
import { requireTrainingReviewer } from "@/lib/training/reviewer-access";

import { createLearningDataAccess } from "./data-access";
import type { LearnerCourseDetail } from "./types";

async function getAccess() {
  return createLearningDataAccess(await createClient());
}

export async function getLearningLibrary() {
  return (await getAccess()).getLibrary();
}

export async function getLearningCatalog() {
  await requireTrainingReviewer("learning.getCatalog");
  return (await getAccess()).getCatalog();
}

export async function getContentStudioData() {
  const currentUserId = await requireTrainingReviewer(
    "learning.getContentStudioData",
  );
  const access = await getAccess();
  const [items, managers] = await Promise.all([
    access.getCatalog(),
    access.getManagers(),
  ]);
  return { currentUserId, items, managers };
}

export async function getLearnerAssignments() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  return (await getAccess()).getLearnerAssignments(user.id);
}

export async function getLearningCourseBySlug(slug: string) {
  return (await getAccess()).getCourse(slug, { by: "slug" });
}

export async function getLearningCourseForManagement(courseId: string) {
  await requireTrainingReviewer("learning.getCourseForManagement");
  return (await getAccess()).getCourse(courseId, {
    by: "id",
    includeDrafts: true,
  });
}

export async function getLearnerCourse(
  enrollmentId: string,
): Promise<LearnerCourseDetail | null> {
  const supabase = await createClient();
  const { data: enrollment, error } = await supabase
    .from("learning_enrollment")
    .select("course_id")
    .eq("id", enrollmentId)
    .maybeSingle();
  if (error) {
    throw new Error(`Learning enrollment lookup failed: ${error.message}`);
  }
  if (!enrollment) return null;
  const course = await createLearningDataAccess(supabase).getCourse(
    enrollment.course_id,
    {
      by: "id",
      enrollmentId,
    },
  );
  if (!course || !("enrollment" in course)) return null;
  return course as LearnerCourseDetail;
}

export async function getLearningContent(contentItemId: string) {
  return (await getAccess()).getNativeContent(contentItemId);
}

export async function getContentGovernanceExceptions() {
  await requireLearningAdmin("learning.getGovernanceExceptions");
  return (await getAccess()).getGovernanceExceptions();
}

export async function getLearningTaxonomy() {
  await requireTrainingReviewer("learning.getTaxonomy");
  const access = await getAccess();
  const [roles, topics] = await Promise.all([
    access.getRoles(),
    access.getTopics(),
  ]);
  return { roles, topics };
}

export async function canCurrentUserManageLearning() {
  const user = await getCurrentUser();
  if (!user) return false;
  const { data, error } = await (
    await createClient()
  ).rpc("current_is_learning_admin");
  if (error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "learning.manageAccess",
      message: `Learning administration access check failed: ${error.message}`,
    });
  }
  return data === true;
}

export async function requireLearningAdmin(where: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Sign in before accessing learning administration.",
      status: 401,
    });
  }
  if (!(await canCurrentUserManageLearning())) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where,
      message: "Learning administrator or leadership access required.",
      status: 403,
    });
  }
  return user.id;
}

export async function requireLearningAdminPageAccess() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  if (!(await canCurrentUserManageLearning())) {
    redirect("/access-denied?reason=learning-administrator");
  }
  return user.id;
}
