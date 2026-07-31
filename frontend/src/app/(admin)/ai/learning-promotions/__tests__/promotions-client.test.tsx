/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import { AiLearningPromotionsClient } from "../promotions-client";

jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
  },
}));

const promotionId = "11111111-1111-4111-8111-111111111111";
const candidate = {
  id: promotionId,
  status: "candidate",
  promotion_type: "agent_prevention_prompt",
  project_id: 983,
  target_id: null,
  source_event_ids: [],
  destination_table: "agent_learnings",
  destination_record_id: null,
  confidence: 0.76,
  risk_level: "medium",
  proposed_learning: {
    title: "Verify project evidence",
    rationale: "A previous answer used the wrong source.",
  },
  review_notes: null,
  reviewed_at: null,
  reviewed_by: null,
  expires_at: null,
  superseded_by: null,
  created_at: "2026-07-27T12:00:00.000Z",
  updated_at: "2026-07-27T12:00:00.000Z",
};

describe("AiLearningPromotionsClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(apiFetch).mockImplementation(async (input, init) => {
      if (init?.method === "POST") return { ok: true } as never;
      if (String(input).includes("/activity")) return { events: [] } as never;
      return { promotions: [candidate] } as never;
    });
  });

  it("requires and sends corrective feedback when an admin rejects a candidate", async () => {
    render(
      <AiLearningPromotionsClient initialPromotions={[candidate] as never} />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Reject promotion" }),
    );

    const submit = screen.getByRole("button", { name: "Reject and teach" });
    expect(submit).toBeDisabled();

    fireEvent.change(
      screen.getByLabelText(
        "What is wrong, and what should the agent do instead?",
      ),
      {
        target: {
          value:
            "Use the project-linked source and say when current evidence is missing.",
        },
      },
    );
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/admin/ai-learning-promotions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            promotionId,
            action: "reject",
            reviewNotes:
              "Use the project-linked source and say when current evidence is missing.",
          }),
        }),
      );
    });
  });

  it("shows an explicit warning when teaching succeeds but audit logging fails", async () => {
    jest.mocked(apiFetch).mockImplementation(async (input, init) => {
      if (
        init?.method === "POST" &&
        input === "/api/admin/ai-learning-promotions"
      ) {
        return {
          ok: true,
          auditWarning:
            "Corrective teaching was activated, but its audit event could not be recorded.",
        } as never;
      }
      if (init?.method === "POST") return { ok: true } as never;
      if (String(input).includes("/activity")) return { events: [] } as never;
      return { promotions: [candidate] } as never;
    });

    render(
      <AiLearningPromotionsClient initialPromotions={[candidate] as never} />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Reject promotion" }),
    );
    fireEvent.change(
      screen.getByLabelText(
        "What is wrong, and what should the agent do instead?",
      ),
      {
        target: {
          value:
            "Keep this correction scoped to the reviewed project evidence.",
        },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Reject and teach" }));

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith("Promotion rejected", {
        description:
          "Corrective teaching was activated, but its audit event could not be recorded.",
      });
    });
  });
});
