import { GenericConfigUnifiedTable } from "@/components/tables/generic-config-unified-table";
import { PageShell } from "@/components/layout";
import {
  fmdsTablesConfig,
  fmdsTablesDescription,
} from "@/lib/fmds/fmds-tables";
import { getFmdsTablesPageData } from "@/lib/fmds/fmds-tables.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FMGlobalTablesPage() {
  try {
    const { revision, tables } = await getFmdsTablesPageData();
    const description = fmdsTablesDescription(revision);

    return (
      <GenericConfigUnifiedTable
        data={tables}
        config={fmdsTablesConfig}
        title="FM Global Tables"
        description={description}
        entityKey="fmds-tables-directory"
        emptyTitle="No FMDS tables are available"
        emptyDescription="The selected ASRS FMDS revision has no extracted table rows. Import the source PDF before retrying."
      />
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "FMDS tables are unavailable: an unexpected ASRS data-source failure occurred.";

    return (
      <PageShell
        variant="table"
        title="FM Global Tables"
        description="Dedicated ASRS FMDS corpus"
      >
        <p className="py-6 text-center text-destructive" role="alert">
          {message}
        </p>
      </PageShell>
    );
  }
}
