import { PageShell } from "@/components/layout";
import { ProjectSetupWizard } from "@/components/project-setup-wizard/project-setup-wizard";

interface ProjectSetupPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ProjectSetupPage({
  params,
}: ProjectSetupPageProps) {
  const { projectId } = await params;
  return (
    <PageShell variant="content" title="Project Setup" description="Configure your project settings and details">
      <ProjectSetupWizard projectId={projectId} />
    </PageShell>
  );
}
