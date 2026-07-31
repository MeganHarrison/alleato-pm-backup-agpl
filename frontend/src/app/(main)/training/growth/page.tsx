export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";

import { SkillGrowthClient } from "@/features/training";
import { createSkillGrowthDataAccess } from "@/features/training/skill-growth-server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { skillDateKey } from "@/features/training/skill-growth";
import { getRoles, resolveViewerRole } from "@/lib/training/server";
import { loadCurrentUserProfilePayload } from "@/lib/users/current-user-profile-server";
import styles from "../training-theme.module.css";

export default async function TrainingGrowthPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const access = createSkillGrowthDataAccess(await createClient(), user.id);
  const [initialData, roles, profile] = await Promise.all([
    access.load(),
    getRoles(),
    loadCurrentUserProfilePayload({
      serviceClient: createServiceClient(),
      user,
      where: "/training/growth#viewer",
    }),
  ]);

  return (
    <section className={styles.wrap} id="growth">
      <div className={styles.secKick}>My Growth · Self-Assessment</div>
      <h1 className={styles.secH}>My Growth</h1>
      <p className={styles.lead}>
        Score the skills your role actually runs on, see the gaps on your wheel,
        and pick the few worth attacking this quarter.
      </p>
      <p>
        <Link
          className={`${styles.btn} ${styles.btnPrimary}`}
          href="/training/growth/assessment"
        >
          Take the assessment →
        </Link>
      </p>
      <SkillGrowthClient
        initialData={initialData}
        today={skillDateKey()}
        suggestedRoleSlug={resolveViewerRole(profile.title ?? null, roles)}
      />
    </section>
  );
}
