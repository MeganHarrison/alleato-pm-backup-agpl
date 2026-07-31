import { PageShell } from "@/components/layout";
import { CompanyBrainExperience } from "@/features/company-brain/company-brain-experience";
import { aiDashboardPageShellProps } from "../page-shell-config";
import { AiDashboardWorkspaceShell } from "../workspace-shell";

export const metadata = {
  title: "Company Brain | AI Dashboard | Alleato",
  description:
    "A living map of your company’s institutional knowledge — meetings, messages, documents, decisions, and project activity flowing into the AI brain.",
};

export default function AiDashboardCompanyBrainPage() {
  return (
    <PageShell {...aiDashboardPageShellProps}>
      <AiDashboardWorkspaceShell>
        <CompanyBrainExperience />
      </AiDashboardWorkspaceShell>
    </PageShell>
  );
}
