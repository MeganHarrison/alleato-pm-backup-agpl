import { PageShell } from "@/components/layout";
import { aiDashboardPageShellProps } from "../page-shell-config";
import { AiDashboardWorkspaceShell } from "../workspace-shell";
import { ArchitectureAssurancePreview } from "./architecture-assurance-preview";

export const metadata = {
  title: "Project Architecture | AI Dashboard | Alleato",
  description:
    "Interactive guide to Alleato codebase ownership, system boundaries, and architecture guardrails.",
};

export default function AiDashboardArchitecturePage() {
  return (
    <PageShell {...aiDashboardPageShellProps}>
      <AiDashboardWorkspaceShell>
        <ArchitectureAssurancePreview />
      </AiDashboardWorkspaceShell>
    </PageShell>
  );
}
