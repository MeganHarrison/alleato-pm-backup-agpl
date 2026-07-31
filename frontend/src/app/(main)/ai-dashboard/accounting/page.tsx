import { PageShell } from "@/components/layout";
import { aiDashboardPageShellProps } from "../page-shell-config";
import { AiDashboardWorkspaceShell } from "../workspace-shell";
import { AccountingOverviewPreview } from "./accounting-overview-preview";

export const metadata = {
  title: "Accounting | AI Dashboard | Alleato",
  description: "Live executive accounting position and canonical report access.",
};

export default function AiDashboardAccountingPage() {
  return (
    <PageShell {...aiDashboardPageShellProps}>
      <AiDashboardWorkspaceShell>
        <AccountingOverviewPreview />
      </AiDashboardWorkspaceShell>
    </PageShell>
  );
}
