export interface InitialSubmittalWorkflowStep {
  user_id: string;
  step_type: string;
}

export interface InsertedSubmittalWorkflowStep {
  id: string;
  step_order: number;
}

export function buildSubmittalWorkflowStepRows(
  submittalId: string,
  steps: InitialSubmittalWorkflowStep[],
) {
  return steps.map((step, index) => ({
    submittal_id: submittalId,
    step_order: index + 1,
    step_type: step.step_type,
  }));
}

export function buildSubmittalWorkflowResponseRows(
  submittalId: string,
  requestedSteps: InitialSubmittalWorkflowStep[],
  insertedSteps: InsertedSubmittalWorkflowStep[],
) {
  if (insertedSteps.length !== requestedSteps.length) {
    throw new Error("Inserted workflow step count does not match requested workflow.");
  }

  return insertedSteps.map((step) => {
    const sourceStep = requestedSteps[step.step_order - 1];
    if (!sourceStep) {
      throw new Error("Inserted workflow step order is outside the requested workflow.");
    }

    return {
      submittal_id: submittalId,
      workflow_step_id: step.id,
      responder_id: sourceStep.user_id,
      response_status: "Pending",
    };
  });
}
