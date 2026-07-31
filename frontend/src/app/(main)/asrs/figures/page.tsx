import { GenericConfigUnifiedTable } from "@/components/tables/generic-config-unified-table";
import { PageShell } from "@/components/layout";
import {
  asrsFiguresConfig,
  asrsWorkspaceTabs,
} from "@/lib/fmds/asrs-workspace";
import { fmdsFiguresDescription } from "@/lib/fmds/fmds-figures";
import { getFmdsFiguresPageData } from "@/lib/fmds/fmds-figures.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AsrsFiguresPage() {
  try {
    const { figures, revision } = await getFmdsFiguresPageData();
    return (
      <PageShell
        variant="table"
        title="ASRS Intelligence"
        description={fmdsFiguresDescription(revision)}
        tabs={asrsWorkspaceTabs}
      >
        <GenericConfigUnifiedTable
          data={figures}
          config={asrsFiguresConfig}
          title="ASRS figures"
          hideHeader
          entityKey="asrs-fmds-figures"
          emptyTitle="No FMDS figures are available"
          emptyDescription="The selected FMDS review corpus has no extracted figures."
        />
      </PageShell>
    );
  } catch (error) {
    return (
      <PageShell
        variant="table"
        title="ASRS Intelligence"
        tabs={asrsWorkspaceTabs}
      >
        <p className="py-6 text-center text-destructive" role="alert">
          {error instanceof Error
            ? error.message
            : "ASRS figures are unavailable."}
        </p>
      </PageShell>
    );
  }
}
