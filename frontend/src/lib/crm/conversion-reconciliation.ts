import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

export async function reconcileCrmConversions() {
  const db = createServiceClient();
  const { data: attempts, error: attemptsError } = await db
    .from("crm_conversion_attempts")
    .select("id, deal_id, project_id, status")
    .in("status", ["project_created", "erp_pending"])
    .not("project_id", "is", null);
  if (attemptsError) throw attemptsError;

  const projectIds = (attempts ?? [])
    .map((attempt) => attempt.project_id)
    .filter((value): value is number => typeof value === "number");
  if (!projectIds.length) return { checked: 0, completed: 0 };

  const { data: projects, error: projectsError } = await db
    .from("projects")
    .select("id, acumatica_project_id")
    .in("id", projectIds);
  if (projectsError) throw projectsError;
  const externalIdByProject = new Map(
    (projects ?? [])
      .filter((project) => Boolean(project.acumatica_project_id))
      .map((project) => [project.id, project.acumatica_project_id!]),
  );

  let completed = 0;
  for (const attempt of attempts ?? []) {
    if (!attempt.project_id) continue;
    const externalId = externalIdByProject.get(attempt.project_id);
    if (!externalId) continue;
    const { data: reconciled, error: reconciliationError } = await db.rpc(
      "crm_complete_conversion",
      {
        p_attempt_id: attempt.id,
        p_erp_external_id: externalId,
      },
    );
    if (reconciliationError) throw reconciliationError;
    if (reconciled) completed += 1;
  }
  return { checked: attempts?.length ?? 0, completed };
}
