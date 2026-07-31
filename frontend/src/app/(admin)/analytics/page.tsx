import { PageShell } from "@/components/layout";
import PlatformAnalyticsPanel from "@/components/admin/platform-analytics-panel-dynamic";

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  return (
    <PageShell
      variant="dashboard"
      title="Platform Analytics"
    >
      <PlatformAnalyticsPanel />
    </PageShell>
  );
}
