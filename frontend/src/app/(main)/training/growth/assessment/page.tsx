export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AssessmentClient } from "@/features/training/assessment/AssessmentClient";
import { skillDateKey } from "@/features/training/skill-growth";
import { createSkillGrowthDataAccess } from "@/features/training/skill-growth-server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getRoles, resolveViewerRole } from "@/lib/training/server";
import { loadCurrentUserProfilePayload } from "@/lib/users/current-user-profile-server";

export const metadata = {
  title: "Skill Wheel assessment — Alleato Training",
};

export default async function TrainingAssessmentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const access = createSkillGrowthDataAccess(await createClient(), user.id);
  const [initialData, roles, profile] = await Promise.all([
    access.load(),
    getRoles(),
    loadCurrentUserProfilePayload({
      serviceClient: createServiceClient(),
      user,
      where: "/training/growth/assessment#viewer",
    }),
  ]);

  return (
    <Suspense fallback={null}>
      <AssessmentClient
        initialData={initialData}
        today={skillDateKey()}
        suggestedRoleSlug={resolveViewerRole(profile.title ?? null, roles)}
      />
    </Suspense>
  );
}
