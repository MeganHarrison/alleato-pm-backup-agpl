import { PageShell } from "@/components/layout";
import {
  CompanyBrainPageContent,
  type CompanyBrainSearchParams,
} from "@/features/company-brain/company-brain-page";
import { aiDashboardPageShellProps } from "./page-shell-config";
import { AiDashboardWorkspaceShell } from "./workspace-shell";

export const metadata = {
  title: "AI Operating System | Alleato",
  description:
    "Executive operating view for AI health, active work, knowledge flow, and company intelligence.",
};

export const dynamic = "force-dynamic";

export default function AiDashboardPage({
  searchParams,
}: {
  searchParams: CompanyBrainSearchParams;
}) {
  return (
    <PageShell {...aiDashboardPageShellProps}>
      <AiDashboardWorkspaceShell>
        <CompanyBrainPageContent searchParams={searchParams} />
      </AiDashboardWorkspaceShell>
    </PageShell>
  );
}
