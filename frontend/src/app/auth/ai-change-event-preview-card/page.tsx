import { AssistantChangeEventFormCardV2 } from "@/components/ai-assistant/assistant-change-event-form-card-v2";
import { AssistantPreviewReviewCard } from "@/components/ai-assistant/assistant-preview-review-card";
import { PageScaffold } from "@/components/layout";
import { buildChangeRequestReviewCard } from "@/lib/ai/change-request-field-guide";

const previewFields = {
  project_id: 43,
  title: "Owner-requested lobby finish change",
  description: "Owner asked to upgrade the lobby finish package.",
  type: "Owner Change",
  scope: "TBD",
  status: "Open",
  reason: "Back Charge",
  origin: "Internal",
  origin_id: "5b769b58-6f0a-4c1f-bf51-63010c88ad5a",
  expecting_revenue: true,
  line_item_revenue_source: "Match Revenue to Latest Cost",
  prime_contract_id: "614ccdf0-25c6-4f85-a4cc-0ce94d6f36cf",
};

export default function AiChangeEventPreviewCardFixturePage() {
  const preview = {
    toolName: "createChangeEvent",
    table: "change_events",
    fields: previewFields,
    reviewCard: buildChangeRequestReviewCard(previewFields),
  };

  return (
    <PageScaffold
      layout="two-column"
      title="AI change event preview card fixture"
      description="Version 1 is the current review card. Version 2 adapts the widget builder form layout for comparison."
      left={
        <section className="space-y-2">
          <p className="text-sm font-semibold">Version 1</p>
          <AssistantPreviewReviewCard preview={preview} />
        </section>
      }
      right={
        <section className="space-y-2">
          <p className="text-sm font-semibold">Version 2</p>
          <AssistantChangeEventFormCardV2 preview={preview} />
        </section>
      }
    />
  );
}
