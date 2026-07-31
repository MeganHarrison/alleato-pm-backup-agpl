import { PageShell } from "@/components/layout";
import { aiDashboardPageShellProps } from "../page-shell-config";
import { AiDashboardWorkspaceShell } from "../workspace-shell";
import { DecisionsPreview } from "./decisions-preview";

export const metadata = {
  title: "Decisions | AI Dashboard | Alleato",
  description: "Live executive decisions waiting on action.",
};

export default function AiDashboardDecisionsPage() {
  return (
    <PageShell {...aiDashboardPageShellProps}>
      <AiDashboardWorkspaceShell>
        <DecisionsPreview />
      </AiDashboardWorkspaceShell>
    </PageShell>
  );
}
