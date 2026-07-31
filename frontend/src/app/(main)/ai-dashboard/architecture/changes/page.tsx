import { PageShell } from "@/components/layout";
import { aiDashboardPageShellProps } from "../../page-shell-config";
import { AiDashboardWorkspaceShell } from "../../workspace-shell";
import { ArchitectureChangeLogPreview } from "./architecture-change-log-preview";

export const metadata = {
  title: "Architecture Change Log | AI Dashboard | Alleato",
  description: "Accepted and published Alleato architecture changes.",
};

export default function AiDashboardArchitectureChangesPage() {
  return (
    <PageShell {...aiDashboardPageShellProps}>
      <AiDashboardWorkspaceShell>
        <ArchitectureChangeLogPreview />
      </AiDashboardWorkspaceShell>
    </PageShell>
  );
}
