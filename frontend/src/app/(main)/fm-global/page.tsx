import type { ReactElement } from "react";
import Link from "next/link";

import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  fmdsTablesConfig,
  fmdsTablesDescription,
} from "@/lib/fmds/fmds-tables";
import { getFmdsTablesPageData } from "@/lib/fmds/fmds-tables.server";
import {
  fmdsFiguresConfig,
  fmdsFiguresDescription,
} from "@/lib/fmds/fmds-figures";
import { getFmdsFiguresPageData } from "@/lib/fmds/fmds-figures.server";

import { FmGlobalDashboardClient } from "./fm-global-dashboard-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FMGlobalDashboardPage(): Promise<ReactElement> {
  try {
    const [fmds, figures] = await Promise.all([
      getFmdsTablesPageData(),
      getFmdsFiguresPageData(),
    ]);

    const tablesDescription = fmdsTablesDescription(fmds.revision);
    const figuresDescription = fmdsFiguresDescription(figures.revision);

    return (
      <PageShell
        variant="dashboard"
        title="FM Global Dashboard"
        description={`Updated FMDS tables: ${tablesDescription}.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/fm-global/form">Open FM Global Form</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/fm-global/fm_global_tables">Tables Directory</Link>
            </Button>
          </div>
        }
      >
        <section>
          <FmGlobalDashboardClient
            tables={fmds.tables}
            figures={figures.figures}
            tablesConfig={fmdsTablesConfig}
            figuresConfig={fmdsFiguresConfig}
            tablesDescription={tablesDescription}
            figuresDescription={figuresDescription}
          />
        </section>
      </PageShell>
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "FM Global dashboard is unavailable because its data sources could not be loaded.";

    return (
      <PageShell
        variant="dashboard"
        title="FM Global Dashboard"
        description="Dedicated ASRS FMDS corpus"
      >
        <p className="py-6 text-center text-destructive" role="alert">
          {message}
        </p>
      </PageShell>
    );
  }
}
