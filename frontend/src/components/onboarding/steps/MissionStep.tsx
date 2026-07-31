import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { onboardingCopy } from "@/lib/onboarding/copy";

export function MissionStep({ onCreateTestProject }: { onCreateTestProject: () => void }) {
  return (
    <div className="max-w-xl">
      <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
        <Sparkles className="size-4" />
        {onboardingCopy.mission.badge}
      </div>
      <h1 className="mb-4 text-2xl font-semibold leading-snug tracking-normal text-foreground sm:text-3xl">
        {onboardingCopy.mission.headline}
      </h1>
      <p className="mb-7 text-[15px] leading-7 text-muted-foreground">
        {onboardingCopy.mission.body}
      </p>
      <Button
        type="button"
        onClick={onCreateTestProject}
        className="h-10"
      >
        {onboardingCopy.mission.cta}
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}
