"use client";

import * as React from "react";

import { PageShell, PageTabs } from "@/components/layout";

import { sections, totalPages } from "./admin-dashboard-data";
import { AdminKanbanView } from "./admin-kanban-view";
import { AdminDirectoryView } from "./admin-directory-view";
import { AdminTableView } from "./admin-table-view";

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = React.useState<"directory" | "table" | "kanban">(
    "table",
  );

  return (
    <PageShell
      variant="dashboard"
      title="Admin Dashboard"
      description={`Directory of ${totalPages} internal pages across AI feedback, access, and AI features.`}
    >
      <div className="space-y-6">
        <PageTabs
          tabs={[
            {
              label: "Table",
              href: "table",
              isActive: activeTab === "table",
            },
            {
              label: "Boards",
              href: "kanban",
              isActive: activeTab === "kanban",
            },
            {
              label: "List",
              href: "directory",
              isActive: activeTab === "directory",
            },
          ]}
          variant="inline"
          className="mb-0"
          onTabClick={(href) => setActiveTab(href as "directory" | "table" | "kanban")}
        />
        {activeTab === "directory" ? (
          <AdminDirectoryView sections={sections} />
        ) : activeTab === "table" ? (
          <AdminTableView sections={sections} />
        ) : (
          <AdminKanbanView sections={sections} />
        )}
      </div>
    </PageShell>
  );
}
