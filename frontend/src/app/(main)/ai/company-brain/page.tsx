import { PageShell } from "@/components/layout";
import {
  CompanyBrainPageContent,
  type CompanyBrainSearchParams,
} from "@/features/company-brain/company-brain-page";
import { aiDashboardPageShellProps } from "../../ai-dashboard/page-shell-config";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Company Brain | Alleato",
  description:
    "Permission-scoped sources, company knowledge, agents, and operating outcomes.",
};

export default async function CompanyBrainPage({
  searchParams,
}: {
  searchParams: CompanyBrainSearchParams;
}) {
  return (
    <PageShell {...aiDashboardPageShellProps}>
      <CompanyBrainPageContent searchParams={searchParams} />
    </PageShell>
  );
}
