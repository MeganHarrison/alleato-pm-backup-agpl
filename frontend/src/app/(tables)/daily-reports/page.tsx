import { createClient } from "@/lib/supabase/server";
import type { GenericTableConfig } from "@/components/tables/generic-table-factory";
import { GenericConfigUnifiedTable } from "@/components/tables/generic-config-unified-table";
import { TablePageWrapper } from "@/components/tables/table-page-wrapper";
import { Database } from "@/types/database.types";

type DailyRecap = Database["public"]["Tables"]["daily_recaps"]["Row"];

const PAGE_TITLE = "Daily Recaps";
const PAGE_DESCRIPTION =
  "AI-generated daily summaries of meetings and decisions";

const config: GenericTableConfig = {
  title: "Daily Recaps",
  hideHeader: true,
  description: "AI-generated daily summaries of meetings and decisions",
  searchFields: ["recap_text", "model_used"],
  exportFilename: "daily-recaps-export.csv",
  editConfig: {
    tableName: "daily_recaps",
    editableFields: [
      "recap_date",
      "date_range_start",
      "date_range_end",
      "recap_text",
      "model_used",
      "token_count",
    ],
  },
  columns: [
    {
      id: "recap_date",
      label: "Recap Date",
      defaultVisible: true,
      type: "date",
    },
    {
      id: "date_range_start",
      label: "Period Start",
      defaultVisible: true,
      type: "date",
    },
    {
      id: "date_range_end",
      label: "Period End",
      defaultVisible: true,
      type: "date",
    },
    {
      id: "meeting_count",
      label: "Meetings",
      defaultVisible: true,
      type: "number",
    },
    {
      id: "project_count",
      label: "Projects",
      defaultVisible: true,
      type: "number",
    },
    {
      id: "recap_text",
      label: "Summary",
      defaultVisible: true,
      renderConfig: {
        type: "truncate",
        maxLength: 100,
      },
    },
    {
      id: "sent_email",
      label: "Sent Email",
      defaultVisible: false,
      renderConfig: {
        type: "badge",
        variantMap: {
          true: "default",
          false: "outline",
        },
        defaultVariant: "outline",
      },
    },
    {
      id: "sent_teams",
      label: "Sent Teams",
      defaultVisible: false,
      renderConfig: {
        type: "badge",
        variantMap: {
          true: "default",
          false: "outline",
        },
        defaultVariant: "outline",
      },
    },
    {
      id: "model_used",
      label: "Model",
      defaultVisible: false,
      type: "text",
    },
    {
      id: "generation_time_seconds",
      label: "Generation Time (s)",
      defaultVisible: false,
      type: "number",
    },
    {
      id: "created_at",
      label: "Created",
      defaultVisible: true,
      type: "date",
    },
  ],
  rowClickPath: "/daily-recaps/{id}",
};

export default async function DailyRecapsPage() {
  const supabase = await createClient();

  const { data: dailyRecaps, error } = await supabase
    .from("daily_recaps")
    .select("*")
    .order("recap_date", { ascending: false });

  if (error) {
    return (
      <TablePageWrapper title={PAGE_TITLE} description={PAGE_DESCRIPTION}>
        <div className="text-center text-destructive p-6">
          Error loading daily recaps. Please try again later.
        </div>
      </TablePageWrapper>
    );
  }

  return (
    <GenericConfigUnifiedTable
      data={(dailyRecaps || []) as DailyRecap[]}
      config={config}
      title={PAGE_TITLE}
      description={PAGE_DESCRIPTION}
      entityKey="daily-recaps"
      emptyTitle="No daily recaps found"
      emptyDescription="No AI-generated daily recaps have been created yet."
    />
  );
}
