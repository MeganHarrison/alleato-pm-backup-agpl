import { GenericConfigUnifiedTable } from "@/components/tables/generic-config-unified-table";
import { PageShell } from "@/components/layout";
import { asrsTablesConfig, asrsWorkspaceTabs } from "@/lib/fmds/asrs-workspace";
import { getFmdsTablesPageData } from "@/lib/fmds/fmds-tables.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AsrsTablesPage() {
  try {
    const { tables } = await getFmdsTablesPageData();
    return (
      <PageShell
        variant="table"
        title="ASRS Intelligence"
        tabs={asrsWorkspaceTabs}
      >
        <GenericConfigUnifiedTable
          data={tables}
          config={asrsTablesConfig}
          title="ASRS tables"
          hideHeader
          entityKey="asrs-fmds-tables"
          emptyTitle="No FMDS tables are available"
          emptyDescription="The current FMDS 8-34 revision has no extracted tables."
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
            : "ASRS tables are unavailable."}
        </p>
      </PageShell>
    );
  }
}
