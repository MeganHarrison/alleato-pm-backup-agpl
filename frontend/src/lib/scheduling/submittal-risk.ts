export type LinkedSubmittalRiskInput = {
  task: { id: string; name: string; start_date: string | null };
  linkedSubmittals: Array<{
    id: string;
    number: string;
    title: string;
    required_approval_date: string | null;
    status?: string | null;
    responses: string[];
  }>;
  dependentTaskNames: string[];
};

export type LinkedSubmittalRisk = {
  status: "at_risk";
  blocking_submittal_id: string;
  reason: string;
  dependency_context: string[];
};

export type LinkedSubmittalRiskResult =
  | { status: "clear"; risks: [] }
  | LinkedSubmittalRisk;

const REJECTED_RESPONSES = new Set(["Rejected", "Revise and Resubmit"]);
const PENDING_RESPONSES = new Set(["Pending"]);

function isAfter(left: string, right: string) {
  return left > right;
}

/**
 * Returns the first deterministic blocker. A pending or rejected workflow can
 * never make the schedule activity look safe when its approval date is late.
 */
export function evaluateLinkedSubmittalRisk({
  task,
  linkedSubmittals,
  dependentTaskNames,
}: LinkedSubmittalRiskInput): LinkedSubmittalRiskResult {
  for (const submittal of linkedSubmittals) {
    const base = {
      status: "at_risk" as const,
      blocking_submittal_id: submittal.id,
      dependency_context: dependentTaskNames,
    };

    if (submittal.status?.toLowerCase() === "rejected" || submittal.responses.some((response) => REJECTED_RESPONSES.has(response))) {
      return {
        ...base,
        reason: `Submittal ${submittal.number} is rejected.`,
      };
    }

    if (
      task.start_date &&
      submittal.required_approval_date &&
      isAfter(submittal.required_approval_date, task.start_date) &&
      submittal.responses.some((response) => PENDING_RESPONSES.has(response))
    ) {
      return {
        ...base,
        reason: `Submittal ${submittal.number} approval is due after this activity starts.`,
      };
    }
  }

  return { status: "clear", risks: [] };
}
