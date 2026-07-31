import { FmGlobalClient } from "@/app/(public)/fm-global/form/fm-global-client";
import { PageShell } from "@/components/layout";
import { asrsWorkspaceTabs } from "@/lib/fmds/asrs-workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AsrsIntakePage() {
  return (
    <PageShell
      variant="form"
      title="ASRS assessment"
      description="Enter the storage, rack, and sprinkler details for an FMDS 8-34 review."
      tabs={asrsWorkspaceTabs}
    >
      <FmGlobalClient submissionPath="/asrs/intake/submitted" />
    </PageShell>
  );
}
