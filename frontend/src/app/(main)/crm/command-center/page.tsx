import { PageScaffold } from "@/components/layout";
import { CrmCommandCenterContent } from "@/features/crm/command-center";
import { CRM_WORKSPACE_PAGE_VARIANT } from "@/features/crm/crm-workspace-layout";
import { buildCrmWorkspaceTabs } from "@/features/crm/crm-workspace-tabs";

export default function CrmCommandCenterPage() {
  return (
    <PageScaffold
      layout="single"
      variant={CRM_WORKSPACE_PAGE_VARIANT}
      title="CRM command center"
      description="Forecast, source activity, pursuit priorities, and evidence-backed next moves"
      tabs={buildCrmWorkspaceTabs("/crm/command-center")}
    >
      <CrmCommandCenterContent />
    </PageScaffold>
  );
}
