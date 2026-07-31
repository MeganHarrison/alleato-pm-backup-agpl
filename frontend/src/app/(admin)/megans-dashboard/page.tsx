export const dynamic = "force-dynamic";

import { PageShell } from "@/components/layout";
import { readRouteInventory } from "@/lib/route-inventory";
import MegansDashboardClient from "./megans-dashboard-client";

export default function MegansDashboardPage() {
  return (
    <PageShell
      variant="table"
      title="Megan's Dashboard"
      showHeader={false}
      contentClassName="space-y-0"
    >
      <MegansDashboardClient routes={readRouteInventory()} />
    </PageShell>
  );
}
