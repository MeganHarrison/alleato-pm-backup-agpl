import { PageShell } from "@/components/layout";
import { ProgressReportEditor } from "./progress-report-editor";

export default async function ProgressReportDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; reportId: string }>;
}) {
  const { projectId, reportId } = await params;
  return (
    <PageShell variant="detailWide" title="Progress Report">
      <ProgressReportEditor
        projectId={Number.parseInt(projectId, 10)}
        reportId={reportId}
      />
    </PageShell>
  );
}
