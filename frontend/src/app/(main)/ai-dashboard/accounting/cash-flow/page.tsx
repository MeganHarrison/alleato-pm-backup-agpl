import { PageShell } from "@/components/layout";
import { aiDashboardPageShellProps } from "../../page-shell-config";
import { AiDashboardWorkspaceShell } from "../../workspace-shell";
import { AccountingDetailPreview } from "../accounting-detail-preview";

export const metadata = {
  title: "Cash Flow | AI Dashboard | Alleato",
};

export default function AiDashboardCashFlowPage() {
  return (
    <PageShell {...aiDashboardPageShellProps}>
      <AiDashboardWorkspaceShell>
        <AccountingDetailPreview report="cash-flow" />
      </AiDashboardWorkspaceShell>
    </PageShell>
  );
}
