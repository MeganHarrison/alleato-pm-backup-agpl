import { RagChatPage } from "@/components/ai-assistant/rag-chat-page";
import { PageShell } from "@/components/layout";

export const metadata = {
  title: "AI | Alleato",
  description: "Chat with Alleato AI and access AI workflows.",
};

export default function AiPage() {
  return (
    <PageShell
      variant="table"
      title="AI"
      showHeader={false}
      fillHeight
      className="h-full px-0 pb-0"
      contentClassName="h-full flex-1 p-0"
    >
      <RagChatPage />
    </PageShell>
  );
}
