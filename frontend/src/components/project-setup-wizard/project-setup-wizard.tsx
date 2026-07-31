"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle } from "lucide-react";
import { CostCodeSetup } from "./cost-code-setup";
import { ProjectDirectorySetup } from "./project-directory-setup";
import { DrawingsSetup } from "./drawings-setup";
import { SpecificationsSetup } from "./specifications-setup";
import { ScheduleSetup } from "./schedule-setup";
import { BudgetSetup } from "./budget-setup";

interface ProjectSetupWizardProps {
  projectId: string;
}

export type SetupStep = {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<StepComponentProps>;
  required: boolean;
};

export interface StepComponentProps {
  projectId: string;
  onNext: () => void;
  onSkip: () => void;
}

const setupSteps: SetupStep[] = [
  {
    id: "cost-codes",
    title: "Cost Code Configuration",
    description: "Cost code structure for budget tracking",
    component: CostCodeSetup,
    required: true,
  },
  {
    id: "project-directory",
    title: "Project Directory",
    description: "Assign roles to your project",
    component: ProjectDirectorySetup,
    required: false,
  },
  {
    id: "drawings",
    title: "Drawings",
    description: "Upload project drawings and plans",
    component: DrawingsSetup,
    required: false,
  },
  {
    id: "specifications",
    title: "Specifications",
    description: "Upload project specifications",
    component: SpecificationsSetup,
    required: false,
  },
  {
    id: "schedule",
    title: "Schedule",
    description: "Upload project schedule documents",
    component: ScheduleSetup,
    required: false,
  },
  {
    id: "budget",
    title: "Budget Setup",
    description: "Configure your initial project budget",
    component: BudgetSetup,
    required: false,
  },
];

export function ProjectSetupWizard({ projectId }: ProjectSetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const router = useRouter();

  const handleNext = () => {
    setCompletedSteps((prev) => new Set(prev).add(currentStep));

    if (currentStep < setupSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Wizard complete
      router.push(`/${projectId}/home`);
    }
  };

  const handleSkip = () => {
    if (!setupSteps[currentStep].required) {
      handleNext();
    }
  };

  const handleStepClick = (stepIndex: number) => {
    // Allow navigation to completed steps or the next uncompleted step
    if (completedSteps.has(stepIndex) || stepIndex <= currentStep) {
      setCurrentStep(stepIndex);
    }
  };

  const CurrentStepComponent = setupSteps[currentStep].component;
  const progress = ((currentStep + 1) / setupSteps.length) * 100;

  return (
    <div className="w-full">
      <div className="w-full">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-3xl font-bold">Project Setup</h1>
          <p className="text-muted-foreground">
            Complete the setup steps to configure your project
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground mt-2">
            Step {currentStep + 1} of {setupSteps.length}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 xl:grid-cols-6 gap-8">
          {/* Step Navigation */}
          <div className="lg:col-span-1">
            <nav className="space-y-2">
              {setupSteps.map((step, index) => {
                const isCompleted = completedSteps.has(index);
                const isCurrent = index === currentStep;
                const isClickable = isCompleted || index <= currentStep;

                return (
                  <Button
                    key={step.id}
                    variant="ghost"
                    onClick={() => handleStepClick(index)}
                    disabled={!isClickable}
                    className={`w-full text-left px-4 py-4 h-auto rounded-lg transition-colors flex items-start gap-4 justify-start ${
                      isCurrent
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : isCompleted
                          ? "bg-muted hover:bg-muted/80"
                          : "bg-background hover:bg-muted/50 text-muted-foreground"
                    } ${!isClickable ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 mt-0.5 text-green-600" />
                    ) : (
                      <Circle className="h-5 w-5 mt-0.5" />
                    )}
                    <div>
                      <div className="font-medium">{step.title}</div>
                      <div className="text-sm opacity-80">
                        {step.description}
                      </div>
                    </div>
                  </Button>
                );
              })}
            </nav>
          </div>

          {/* Step Content */}
          <div className="lg:col-span-4 xl:col-span-5">
            <div className="p-0">
              {/* eslint-disable-next-line design-system/no-raw-heading */}
              <h2 className="text-2xl font-semibold mb-4">
                {setupSteps[currentStep].title}
              </h2>
              <CurrentStepComponent
                projectId={projectId}
                onNext={handleNext}
                onSkip={handleSkip}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
