export const dynamic = "force-dynamic";

import { PageShell } from "@/components/layout";
import {
  getTrainingPageShellProps,
  MethodContent,
  TrainingPageContent,
} from "@/features/training";

export default function TrainingMethodPage() {
  return (
    <PageShell
      {...getTrainingPageShellProps({
        title: "The Method, at a Glance",
        description:
          "List the real skills of your role, score each honestly, see the gaps on your wheel, pick 2–4 to attack, and build precise daily reps.",
      })}
    >
      <TrainingPageContent>
        <MethodContent />
      </TrainingPageContent>
    </PageShell>
  );
}
