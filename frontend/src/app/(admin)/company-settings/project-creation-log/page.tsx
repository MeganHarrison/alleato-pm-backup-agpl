import { requireAppAdminPageAccess } from "@/lib/auth/require-app-admin";
import { PageShell } from "@/components/layout";
import { ProjectCreationLogClient } from "./project-creation-log-client";

export default async function ProjectCreationLogPage() {
  await requireAppAdminPageAccess();
  return (
    <PageShell
      variant="table"
      title="Project Creation Log"
      showHeader={false}
      contentClassName="space-y-0"
    >
      <ProjectCreationLogClient />
    </PageShell>
  );
}
