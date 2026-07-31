import { PageShell } from "@/components/layout";
import { aiDashboardPageShellProps } from "../../page-shell-config";
import { AiDashboardWorkspaceShell } from "../../workspace-shell";
import { AccountingDetailPreview } from "../accounting-detail-preview";

export const metadata = {
  title: "Reconciliation | AI Dashboard | Alleato",
};

export default function AiDashboardReconciliationPage() {
  return (
    <PageShell {...aiDashboardPageShellProps}>
      <AiDashboardWorkspaceShell>
        <AccountingDetailPreview report="reconciliation" />
      </AiDashboardWorkspaceShell>
    </PageShell>
  );
}
