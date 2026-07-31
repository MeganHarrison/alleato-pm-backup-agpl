"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { PageShell } from "@/components/layout";
import { PageTabs } from "@/components/layout/PageTabs";

const TABS: { key: string; label: string; href: (p: string) => string }[] = [
  { key: "files", label: "Files", href: (p) => `/${p}/documents` },
  { key: "meetings", label: "Meetings", href: (p) => `/${p}/meetings` },
  { key: "emails", label: "Emails", href: (p) => `/${p}/emails` },
  { key: "teams", label: "Teams Messages", href: () => `/team-chat` },
  { key: "prime-contracts", label: "Prime Contracts", href: (p) => `/${p}/prime-contracts` },
  { key: "budget", label: "Budget", href: (p) => `/${p}/budget` },
  { key: "commitments", label: "Commitments", href: (p) => `/${p}/commitments` },
  { key: "estimates", label: "Estimates", href: (p) => `/${p}/estimates` },
  { key: "change-events", label: "Change Events", href: (p) => `/${p}/change-events` },
  { key: "change-orders", label: "Change Orders", href: (p) => `/${p}/change-orders` },
  { key: "invoices", label: "Invoices", href: (p) => `/${p}/invoices` },
  { key: "payments", label: "Payments", href: () => `/accounting/payments` },
  { key: "drawings", label: "Drawings", href: (p) => `/${p}/drawings` },
  { key: "submittals", label: "Submittals", href: (p) => `/${p}/submittals` },
  { key: "photos", label: "Photos", href: (p) => `/${p}/photos` },
  { key: "rfis", label: "RFIs", href: (p) => `/${p}/rfis` },
];

export default function ProjectHubPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = Array.isArray(params?.projectId)
    ? params.projectId[0]
    : (params?.projectId as string);

  const activeKey = searchParams?.get("tab") ?? TABS[0].key;
  const activeTab = TABS.find((t) => t.key === activeKey) ?? TABS[0];
  const iframeSrc = activeTab.href(projectId);

  const tabConfigs = TABS.map((tab) => ({
    label: tab.label,
    href: `/${projectId}/hub?tab=${tab.key}`,
    isActive: tab.key === activeKey,
  }));

  return (
    <PageShell variant="dashboard" title="Project Hub">
      <div className="flex h-screen flex-col">
        <div className="border-b px-4 sm:px-6 lg:px-8 pt-3">
          <PageTabs
            tabs={tabConfigs}
            variant="inline"
            onTabClick={(href) => router.push(href)}
          />
        </div>
        <iframe
          key={activeKey}
          src={iframeSrc}
          className="flex-1 w-full border-0"
          title={activeTab.label}
        />
      </div>
    </PageShell>
  );
}
