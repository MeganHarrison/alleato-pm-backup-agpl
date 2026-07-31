export const dynamic = "force-dynamic";

import { PageShell } from "@/components/layout";
import { readRouteInventory } from "@/lib/route-inventory";
import { BRANDONS_DASHBOARD_TAG_SLUG } from "@/lib/page-tags";
import TaggedDashboardClient from "../megans-dashboard/megans-dashboard-client";

export default function BrandonsDashboardPage() {
  return (
    <PageShell
      variant="table"
      title="Brandon's Dashboard"
      showHeader={false}
      contentClassName="space-y-0"
    >
      <TaggedDashboardClient
        routes={readRouteInventory()}
        tagSlug={BRANDONS_DASHBOARD_TAG_SLUG}
        dashboardTitle="Brandon's Dashboard"
      />
    </PageShell>
  );
}
