import { createClient } from "@/lib/supabase/server";
import type { GenericTableConfig } from "@/components/tables/generic-table-factory";
import { GenericConfigUnifiedTable } from "@/components/tables/generic-config-unified-table";
import { TablePageWrapper } from "@/components/tables/table-page-wrapper";
import { Database } from "@/types/database.types";

type DailyLog = Database["public"]["Tables"]["daily_logs"]["Row"];

const PAGE_TITLE = "Daily Logs";
const PAGE_DESCRIPTION = "View daily construction logs and weather conditions";

const config: GenericTableConfig = {
  title: "Daily Logs",
  hideHeader: true,
  description: "View daily construction logs and weather conditions",
  searchFields: ["log_date", "created_by"],
  exportFilename: "daily-logs-export.csv",
  editConfig: {
    tableName: "daily_logs",
    editableFields: [
      "log_date",
      "weather_conditions",
      "manpower",
      "equipment_used",
      "work_completed",
      "materials_delivered",
      "issues",
      "safety_incidents",
      "visitors",
      "created_by",
    ],
  },
  columns: [
    {
      id: "log_date",
      label: "Date",
      defaultVisible: true,
      type: "date",
    },
    {
      id: "project_id",
      label: "Project ID",
      defaultVisible: true,
      type: "number",
    },
    {
      id: "weather_conditions",
      label: "Weather",
      defaultVisible: true,
      renderConfig: {
        type: "json",
        maxLength: 50,
      },
    },
    {
      id: "created_by",
      label: "Created By",
      defaultVisible: true,
      type: "text",
    },
    {
      id: "created_at",
      label: "Created",
      defaultVisible: true,
      type: "date",
    },
    {
      id: "updated_at",
      label: "Updated",
      defaultVisible: false,
      type: "date",
    },
  ],
  rowClickPath: "/daily-logs/{id}",
};

export default async function DailyLogsPage() {
  const supabase = await createClient();

  const { data: dailyLogs, error } = await supabase
    .from("daily_logs")
    .select("*")
    .order("log_date", { ascending: false });

  if (error) {
    return (
      <TablePageWrapper title={PAGE_TITLE} description={PAGE_DESCRIPTION}>
        <div className="text-center text-destructive p-6">
          Error loading daily logs. Please try again later.
        </div>
      </TablePageWrapper>
    );
  }

  return (
    <GenericConfigUnifiedTable
      data={(dailyLogs || []) as DailyLog[]}
      config={config}
      title={PAGE_TITLE}
      description={PAGE_DESCRIPTION}
      entityKey="daily-logs"
      emptyTitle="No daily logs found"
      emptyDescription="No daily construction logs have been created yet."
    />
  );
}
