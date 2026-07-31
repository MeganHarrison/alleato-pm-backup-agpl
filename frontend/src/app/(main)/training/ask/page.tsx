import { RagChatPage } from "@/components/ai-assistant/rag-chat-page";
import { PageShell } from "@/components/layout";
import { TRAINING_PAGE_SURFACE_CLASS } from "@/features/training/TrainingDetailPage";

export const metadata = {
  title: "Ask the Training Library | Alleato",
  description: "Get source-backed answers from Alleato training guides.",
};

export default function AskTrainingLibraryPage() {
  return (
    <PageShell
      variant="content"
      eyebrow="Alleato Training Library"
      title="Ask the Library"
      description="Get a source-backed answer from Alleato guides and published resources."
      className={TRAINING_PAGE_SURFACE_CLASS}
      fillHeight
      contentClassName="min-h-0 flex-1 p-0"
    >
      <RagChatPage
        surface="training_library"
        basePath="/training/ask"
        chatApi="/api/training/library/chat"
        chatMode="training"
      />
    </PageShell>
  );
}
