import { PageShell } from "@/components/layout";
import { aiDashboardPageShellProps } from "../../page-shell-config";
import { AiDashboardWorkspaceShell } from "../../workspace-shell";
import { AccountingDetailPreview } from "../accounting-detail-preview";

export const metadata = {
  title: "WIP | AI Dashboard | Alleato",
};

export default function AiDashboardWipPage() {
  return (
    <PageShell {...aiDashboardPageShellProps}>
      <AiDashboardWorkspaceShell>
        <AccountingDetailPreview report="wip" />
      </AiDashboardWorkspaceShell>
    </PageShell>
  );
}
