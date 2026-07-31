import Link from "next/link";

import { RealtimeWorkflowBuilder } from "@/components/workflows/realtime-workflow-builder";
import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";

export default function WorkflowBuilderPage() {
  return (
    <PageShell
      variant="dashboard"
      title="Workflow builder"
      description="Shape internal automation steps with collaborators in real time."
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href="/actions">Back to actions</Link>
        </Button>
      }
    >
      <RealtimeWorkflowBuilder />
    </PageShell>
  );
}
