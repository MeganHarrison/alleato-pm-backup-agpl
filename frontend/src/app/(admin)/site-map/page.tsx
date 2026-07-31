export const dynamic = "force-dynamic";

import { PageShell } from "@/components/layout";
import { readRouteInventory } from "@/lib/route-inventory";
import SiteMapClient from "./site-map-client";

export default function SiteMapPage() {
  return (
    <PageShell
      variant="table"
      title="Page Access"
      showHeader={false}
      contentClassName="space-y-0"
    >
      <SiteMapClient routes={readRouteInventory()} />
    </PageShell>
  );
}
