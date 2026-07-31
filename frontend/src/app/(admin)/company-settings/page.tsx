import { requireAppAdminPageAccess } from "@/lib/auth/require-app-admin";
import { PageShell } from "@/components/layout";

import { CompanySettingsClient } from "./company-settings-client";

export default async function CompanySettingsPage() {
  await requireAppAdminPageAccess();

  return (
    <PageShell
      variant="detailWide"
      title="Company Settings"
      description="Control company-wide defaults without disrupting active project workflows."
    >
      <CompanySettingsClient />
    </PageShell>
  );
}
