"use client";

import { useParams, usePathname, useRouter } from "next/navigation";

import { CompanyCrmSections } from "@/components/domain/crm/company-crm-sections";
import { EmptyState, StatusBadge } from "@/components/ds";
import { ContentSectionStack, PageShell } from "@/components/layout";
import { buildCrmWorkspaceTabs } from "@/features/crm/crm-workspace-tabs";
import { useCrmWorkspace } from "@/hooks/use-crm";

export default function CrmCompanyPage() {
  const params = useParams<{ companyId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { accounts, isLoading } = useCrmWorkspace();
  const companyId = params?.companyId ?? "";
  const account = accounts.find(
    (candidate) => candidate.companyId === companyId,
  );

  if (isLoading) {
    return (
      <PageShell
        variant="detail"
        title="Loading CRM company"
        onBack={() => router.push("/crm")}
        tabs={buildCrmWorkspaceTabs(pathname)}
      >
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
      </PageShell>
    );
  }

  if (!account) {
    return (
      <PageShell
        variant="detail"
        title="CRM company not found"
        onBack={() => router.push("/crm")}
        tabs={buildCrmWorkspaceTabs(pathname)}
      >
        <EmptyState
          title="CRM company not found"
          description="Return to relationships and choose an active CRM account."
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      variant="detail"
      eyebrow="CRM relationship"
      title={account.name}
      onBack={() => router.push("/crm")}
      statusBadge={<StatusBadge status={account.healthStatus} />}
      tabs={buildCrmWorkspaceTabs(pathname)}
    >
      <ContentSectionStack>
        <CompanyCrmSections
          companyId={account.companyId}
          companyName={account.name}
        />
      </ContentSectionStack>
    </PageShell>
  );
}
