import { PageShell } from "@/components/layout";
import { aiDashboardPageShellProps } from "../page-shell-config";
import { AiDashboardWorkspaceShell } from "../workspace-shell";
import { RagPipelinePreview } from "./rag-pipeline-preview";

export const metadata = {
  title: "RAG Pipeline | AI Dashboard | Alleato",
  description: "Live executive view of the canonical intelligence pipeline.",
};

export default function AiDashboardRagPipelinePage() {
  return (
    <PageShell {...aiDashboardPageShellProps}>
      <AiDashboardWorkspaceShell>
        <RagPipelinePreview />
      </AiDashboardWorkspaceShell>
    </PageShell>
  );
}
