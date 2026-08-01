import { PageShell } from "@/components/layout";
import { UserAdoptionAnalyticsPrototype } from "@/components/admin/user-adoption-analytics-prototype";

export default function UserAdoptionAnalyticsPrototypePage() {
  return (
    <PageShell variant="dashboard" title="User analytics">
      <UserAdoptionAnalyticsPrototype />
    </PageShell>
  );
}
