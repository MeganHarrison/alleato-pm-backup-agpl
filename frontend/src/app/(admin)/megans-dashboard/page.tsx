export const dynamic = "force-dynamic";

import { PageShell } from "@/components/layout";
import { MEGANS_DASHBOARD_TAG_SLUG } from "@/lib/page-tags";
import { readRouteInventory } from "@/lib/route-inventory";
import TaggedDashboardClient from "./megans-dashboard-client";

export default function MegansDashboardPage() {
  return (
    <PageShell
      variant="table"
      title="Megan's Dashboard"
      showHeader={false}
      contentClassName="space-y-0"
    >
      <TaggedDashboardClient
        routes={readRouteInventory()}
        tagSlug={MEGANS_DASHBOARD_TAG_SLUG}
        dashboardTitle="Megan's Dashboard"
      />
    </PageShell>
  );
}
