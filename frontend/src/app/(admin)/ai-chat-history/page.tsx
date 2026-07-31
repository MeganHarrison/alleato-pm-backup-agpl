import { PageShell } from "@/components/layout";
import { AiChatHistoryClient } from "./ai-chat-history-client";

export const dynamic = "force-dynamic";

export default function AiChatHistoryPage() {
  return (
    <PageShell
      variant="table"
      title="AI Chat History"
      eyebrow="Admin"
      contentClassName="space-y-6"
    >
      <AiChatHistoryClient />
    </PageShell>
  );
}
