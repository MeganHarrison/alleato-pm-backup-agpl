"use client";

import posthog from "posthog-js";

import type {
  BrainEntityKind,
  BrainDataState,
  BrainHealth,
  BrainRange,
} from "./company-brain-contract";

type CompanyBrainTelemetry =
  | {
      event: "company_brain_loaded";
      properties: { state: BrainDataState; range: BrainRange };
    }
  | {
      event: "company_brain_node_selected";
      properties: { kind: BrainEntityKind; status: BrainHealth };
    }
  | {
      event: "company_brain_search_used";
      properties: { result: "match" | "no_match" };
    }
  | {
      event: "company_brain_motion_changed";
      properties: { paused: boolean };
    };

/**
 * Privacy boundary for Company Brain analytics.
 * Entity names, IDs, counts, activity text, timestamps, and query text are
 * deliberately not accepted by this contract.
 */
export function captureCompanyBrain(
  payload: CompanyBrainTelemetry,
): void {
  posthog.capture(payload.event, payload.properties);
}
