import { OperationsReadinessPanel } from "@/components/ai-intelligence/operations-readiness-panel";
import { PageShell } from "@/components/layout";

export const dynamic = "force-dynamic";

export default function OperationsReadinessPage() {
  return (
    <PageShell
      variant="dashboard"
      title="Operations Readiness"
      description="Four operating answers: source data, generated tasks, project intelligence packets, and the daily brief."
      contentClassName="space-y-8"
    >
      <OperationsReadinessPanel />
    </PageShell>
  );
}
