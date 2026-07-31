import { readFileSync } from "node:fs";
import { join } from "node:path";

import { revalidatePath } from "next/cache";

import { evaluateAsrsConfiguration } from "@/lib/fmds/asrs-estimator.server";
import { PUBLIC_FMDS_EVALUATOR_KEY } from "@/lib/fmds/asrs-estimator";
import { createAsrsServiceClient } from "@/lib/supabase/service";
import { submitFmGlobalSpecs } from "../actions";

jest.mock("server-only", () => ({}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/fmds/asrs-estimator.server", () => ({
  evaluateAsrsConfiguration: jest.fn(),
}));
jest.mock("@/lib/supabase/service", () => ({
  createAsrsServiceClient: jest.fn(),
}));

const evaluateMock = evaluateAsrsConfiguration as jest.MockedFunction<
  typeof evaluateAsrsConfiguration
>;
const createClientMock = createAsrsServiceClient as jest.MockedFunction<
  typeof createAsrsServiceClient
>;
const revalidateMock = revalidatePath as jest.MockedFunction<
  typeof revalidatePath
>;
const REVISION_ID = "11111111-1111-4111-8111-111111111111";

const evaluation = {
  corpus: {
    coverage: "batch1_only",
    documentCode: "FMDS0834",
    revisionId: REVISION_ID,
    revisionLabel: "2026-04",
    revisionStatus: "staging" as const,
  },
  requirements: [
    {
      id: "hose-demand",
      label: "Hose demand and water supply",
      status: "verified" as const,
      value: "12 design sprinklers require 250 gpm for 60 minutes.",
      citations: [{ label: "Table 2.1.4.5.4", pageNumber: 17 }],
    },
    {
      id: "full-compliance",
      label: "Full FMDS 8-34 compliance determination",
      status: "pending_review" as const,
      value: "Pending review.",
      citations: [],
    },
  ],
};

const intake = {
  asrs_type: "Shuttle" as const,
  system_type: "wet" as const,
  ceiling_height_ft: 30,
  k_factor: 22.4,
  tolerance_ft: 5,
};
const evaluatorInput = {
  ceilingSprinklerType: "standard_coverage" as const,
  designSprinklerCount: 12,
  transverseFlue: {
    nominalHorizontalDistanceFt: 11,
  },
};
const metadata = {
  contact_name: "Jane Doe",
  contact_email: "jane@example.com",
  project_name: "Distribution Center",
};

describe("public FM Global 2026 evaluator action", () => {
  const single = jest.fn();
  const select = jest.fn(() => ({ single }));
  const insert = jest.fn(() => ({ select }));
  const from = jest.fn(() => ({ insert }));

  beforeEach(() => {
    jest.clearAllMocks();
    single.mockResolvedValue({ data: { id: "submission-1" }, error: null });
    createClientMock.mockReturnValue({ from } as never);
    evaluateMock.mockResolvedValue(evaluation);
  });

  it("evaluates once and atomically persists the exact revision trace", async () => {
    const result = await submitFmGlobalSpecs(intake, evaluatorInput, metadata);

    expect(evaluateMock).toHaveBeenCalledWith(evaluatorInput);
    expect(from).toHaveBeenCalledWith("fm_form_submissions");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        corpus_revision_id: REVISION_ID,
        evaluator_key: PUBLIC_FMDS_EVALUATOR_KEY,
        evaluator_inputs: evaluatorInput,
        evaluation_result: evaluation,
        evaluation_status: "pending_review",
        parsed_requirements: evaluation,
      }),
    );
    expect(result).toEqual({ submissionId: "submission-1", evaluation });
    expect(revalidateMock).toHaveBeenCalledWith(
      "/fm-global/form/submitted/submission-1",
    );
  });

  it("does not persist when the canonical evaluator fails", async () => {
    evaluateMock.mockRejectedValueOnce(new Error("ASRS evaluator unavailable"));

    await expect(
      submitFmGlobalSpecs(intake, evaluatorInput, metadata),
    ).rejects.toThrow("ASRS evaluator unavailable");
    expect(from).not.toHaveBeenCalled();
  });

  it("names the incomplete transverse-flue fact and preserves the submission boundary", async () => {
    await expect(
      submitFmGlobalSpecs(intake, {
        ...evaluatorInput,
        transverseFlue: { objectWidthIn: 4 },
      }, metadata),
    ).rejects.toThrow("Object width and angle must be entered together.");

    expect(evaluateMock).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("contains no legacy FM lookup fallback", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/(public)/fm-global/form/actions.ts"),
      "utf8",
    );
    expect(source).not.toMatch(
      /find_sprinkler_requirements|generate_optimization_recommendations|fm_global_tables|fm_global_figures|fm_sprinkler_configs/,
    );
    expect(source).not.toMatch(/export\s+(?:const|let|var)\s+/);
  });
});
