import { notFound } from "next/navigation";

import { getSiteLeadChecklistForDate } from "@/app/(main)/actions/daily-log-actions";
import { PageShell } from "@/components/layout";
import { SiteLeadChecklistClient } from "./site-lead-checklist-client";

function todayIsoDate() {
  return new Date().toISOString().split("T")[0];
}

export const dynamic = "force-dynamic";

export default async function SiteLeadChecklistPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ date?: string }>;
}) {
  const { projectId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const parsedProjectId = Number(projectId);
  if (!Number.isInteger(parsedProjectId)) {
    notFound();
  }

  const selectedDate =
    typeof resolvedSearchParams.date === "string" && resolvedSearchParams.date
      ? resolvedSearchParams.date
      : todayIsoDate();

  const result = await getSiteLeadChecklistForDate({
    projectId: parsedProjectId,
    logDate: selectedDate,
  });

  if ("error" in result) {
    return (
      <PageShell variant="content" title="Site Lead Checklist">
        <p className="py-6 text-sm text-destructive">{result.error}</p>
      </PageShell>
    );
  }

  return (
    <SiteLeadChecklistClient
      projectId={parsedProjectId}
      initialDate={selectedDate}
      initialChecklist={result.data.checklist}
      linkedDailyLogStatus={result.data.status}
    />
  );
}
