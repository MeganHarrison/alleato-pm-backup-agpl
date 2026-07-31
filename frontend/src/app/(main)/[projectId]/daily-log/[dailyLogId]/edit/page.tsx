import { notFound } from "next/navigation";
import {
  getDailyLogWithSections,
  type DailyLogStatus,
} from "@/app/(main)/actions/daily-log-actions";
import { DailyLogFormClient, type DailyLogInitialData } from "@/components/daily-log/DailyLogFormClient";

export const dynamic = "force-dynamic";

export default async function EditDailyLogPage({
  params,
}: {
  params: Promise<{ projectId: string; dailyLogId: string }>;
}) {
  const { projectId, dailyLogId } = await params;

  const parsedProjectId = Number(projectId);
  if (!Number.isInteger(parsedProjectId)) {
    notFound();
  }

  const result = await getDailyLogWithSections({
    dailyLogId,
    projectId: parsedProjectId,
  });

  if ("error" in result || !result.data) {
    notFound();
  }

  const { log, weather, manpower, equipment, notes } = result.data;

  const initialData: DailyLogInitialData = {
    dailyLogId: log.id,
    logDate: log.log_date,
    status: (log.status as DailyLogStatus) ?? "draft",
    generalNotes: log.general_notes ?? "",
    weather: weather.map((row) => ({
      id: row.id,
      area: row.area ?? "All Areas",
      timeObserved: row.time_observed ?? "09:00",
      delay: row.delay,
      location: row.location ?? "",
      sky: row.sky ?? "",
      temperature: row.temperature,
      calamity: row.calamity ?? "",
      average: row.average ?? "",
      precipitation: row.precipitation ?? "",
      wind: row.wind ?? "",
      groundOrSea: row.ground_or_sea ?? "",
      comments: row.comments ?? "",
    })),
    manpower: manpower.map((row) => ({
      id: row.id,
      area: row.area ?? "All Areas",
      trade: row.trade ?? "",
      workersCount: row.workers_count,
      hoursWorked: row.hours_worked,
      costCode: row.cost_code ?? "",
      location: row.location ?? "",
      comments: row.comments ?? "",
      issueFlag: row.issue_flag,
    })),
    equipment: equipment.map((row) => ({
      id: row.id,
      area: row.area ?? "All Areas",
      equipmentName: row.equipment_name,
      hoursOperated: row.hours_operated,
      hoursIdle: row.hours_idle,
      costCode: row.cost_code ?? "",
      location: row.location ?? "",
      inspected: row.inspected,
      inspectionTime: row.inspection_time ?? "",
      comments: row.comments ?? "",
    })),
    notes: notes.map((row) => ({
      id: row.id,
      area: row.area ?? "All Areas",
      category: row.category ?? "",
      location: row.location ?? "",
      description: row.description,
      issueFlag: row.issue_flag,
    })),
  };

  return (
    <DailyLogFormClient
      projectId={parsedProjectId}
      mode="edit"
      initialData={initialData}
    />
  );
}
