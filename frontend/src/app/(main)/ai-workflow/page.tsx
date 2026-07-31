import { DurableAiChatPage } from "@/components/ai-assistant/durable-ai-chat-page";
import { PageShell } from "@/components/layout";

export const metadata = {
  title: "Durable AI canary | Alleato",
  description: "Vercel Workflow-backed Alleato AI canary.",
};

export default function DurableAiWorkflowPage() {
  return (
    <PageShell
      variant="table"
      title="Durable AI canary"
      description="Vercel Workflow runtime with resumable streams"
      fillHeight
      className="h-full px-0 pb-0"
      contentClassName="h-full flex-1 p-0"
    >
      <DurableAiChatPage />
    </PageShell>
  );
}
