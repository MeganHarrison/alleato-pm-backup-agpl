import { PageShell } from "@/components/layout";
import { aiDashboardPageShellProps } from "./page-shell-config";
import { AiOsDashboard } from "./ai-os/ai-os-preview";
import { AiDashboardWorkspaceShell } from "./workspace-shell";

export const metadata = {
  title: "AI Operating System | Alleato",
  description:
    "Executive operating view for AI health, active work, knowledge flow, and company intelligence.",
};

export default function AiDashboardPage() {
  return (
    <PageShell {...aiDashboardPageShellProps}>
      <AiDashboardWorkspaceShell>
        <AiOsDashboard />
      </AiDashboardWorkspaceShell>
    </PageShell>
  );
}
