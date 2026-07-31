export const dynamic = "force-dynamic";

import { PageShell } from "@/components/layout";
import {
  getTrainingPageShellProps,
  PROMPT_ITEMS,
  PROMPTS_INTRO,
  PromptList,
  TrainingPageContent,
} from "@/features/training";

export default function TrainingPromptsPage() {
  return (
    <PageShell
      {...getTrainingPageShellProps({
        title: "AI Prompt Starters",
        description: PROMPTS_INTRO,
      })}
    >
      <TrainingPageContent>
        <PromptList prompts={PROMPT_ITEMS} />
      </TrainingPageContent>
    </PageShell>
  );
}
