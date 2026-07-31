import { getProjectInfo } from "@/lib/supabase/project-fetcher";
import { DailyLogClient } from "./daily-log-client";
import { PageShell } from "@/components/layout";
import { getDailyLogCreatorLabel } from "@/lib/daily-log/creator-labels";

export default async function ProjectDailyLogPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { numericProjectId, supabase } = await getProjectInfo(projectId);

  const { data: dailyLogs, error } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("project_id", numericProjectId)
    .order("log_date", { ascending: false });

  if (error) {
    return (
      <PageShell variant="table" title="Daily Log">
        <p className="text-center text-destructive py-6">
          Error loading daily logs. Please try again later.
        </p>
      </PageShell>
    );
  }

  const logs = dailyLogs || [];

  const creatorIds = [
    ...new Set(logs.map((l) => l.created_by).filter(Boolean) as string[]),
  ];

  const profileMap: Record<string, string> = {};
  if (creatorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, full_name, email")
      .in("id", creatorIds);
    if (profiles) {
      for (const p of profiles) {
        profileMap[p.id] = p.full_name || p.email;
      }
    }
  }

  const enrichedLogs = logs.map((l) => ({
    ...l,
    creator_name: l.created_by ? (profileMap[l.created_by] ?? null) : null,
  }));

  return <DailyLogClient projectId={projectId} dailyLogs={enrichedLogs} />;
}
