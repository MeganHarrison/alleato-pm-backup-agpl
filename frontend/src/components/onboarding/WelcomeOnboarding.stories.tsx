import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type * as React from "react";
import { WelcomeOnboarding } from "./WelcomeOnboarding";
import { FoundationStep } from "./steps/FoundationStep";
import { MissionStep } from "./steps/MissionStep";
import { WidgetShowcaseStep } from "./steps/WidgetShowcaseStep";
import { WowStep } from "./steps/WowStep";
import { defaultMomentumStats, defaultOnboardingInsights } from "@/lib/onboarding/copy";

const meta: Meta<typeof WelcomeOnboarding> = {
  title: "Onboarding/WelcomeOnboarding",
  component: WelcomeOnboarding,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof WelcomeOnboarding>;

export const Modal: Story = {
  args: {
    forceOpen: true,
    storageKey: "storybook_welcome_onboarding",
  },
};

export const Foundation = {
  render: () => <StepFrame><FoundationStep firstName="Megan" stats={defaultMomentumStats} /></StepFrame>,
};

export const Wow = {
  render: () => <StepFrame><WowStep userName="Megan" insights={defaultOnboardingInsights} /></StepFrame>,
};

export const WidgetShowcase = {
  render: () => <StepFrame><WidgetShowcaseStep /></StepFrame>,
};

export const Mission = {
  render: () => <StepFrame><MissionStep onCreateTestProject={() => undefined} /></StepFrame>,
};

function StepFrame({ children }: { children: React.ReactNode }) {
  return <div className="w-full max-w-xl rounded-lg border bg-background p-7 shadow-sm">{children}</div>;
}
