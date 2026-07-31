"use client";

import { useState } from "react";
import type { ReactElement } from "react";
import { PageTabs } from "@/components/layout";
import type { GenericTableConfig } from "@/components/tables/generic-table-factory";
import { GenericConfigUnifiedTable } from "@/components/tables/generic-config-unified-table";

interface FmGlobalDashboardClientProps {
  tables: Record<string, unknown>[];
  figures: Record<string, unknown>[];
  tablesConfig: GenericTableConfig;
  figuresConfig: GenericTableConfig;
  tablesDescription: string;
  figuresDescription: string;
}

export function FmGlobalDashboardClient({
  tables,
  figures,
  tablesConfig,
  figuresConfig,
  tablesDescription,
  figuresDescription,
}: FmGlobalDashboardClientProps): ReactElement {
  const [activeTab, setActiveTab] = useState<"tables" | "figures">("tables");

  return (
    <div className="w-full space-y-6">
      <PageTabs
        tabs={[
          {
            label: "FM Global Tables",
            href: "tables",
            isActive: activeTab === "tables",
          },
          {
            label: "FM Global Figures",
            href: "figures",
            isActive: activeTab === "figures",
          },
        ]}
        variant="inline"
        className="mb-0"
        onTabClick={(href) => setActiveTab(href as "tables" | "figures")}
      />
      {activeTab === "tables" ? (
        <GenericConfigUnifiedTable
          data={tables}
          config={tablesConfig}
          title="FM Global Tables"
          description={tablesDescription}
          hideHeader
          entityKey="fmds-dashboard-tables"
          emptyTitle="No FMDS tables are available"
          emptyDescription="The selected ASRS FMDS revision has no extracted table rows. Import the source PDF before retrying."
        />
      ) : null}
      {activeTab === "figures" ? (
        <GenericConfigUnifiedTable
          data={figures}
          config={figuresConfig}
          title="FM Global Figures"
          description={figuresDescription}
          hideHeader
          entityKey="fmds-dashboard-figures"
          emptyTitle="No FMDS figures are available"
          emptyDescription="The selected ASRS FMDS revision has no extracted figure rows. Import the source PDF before retrying."
        />
      ) : null}
    </div>
  );
}
