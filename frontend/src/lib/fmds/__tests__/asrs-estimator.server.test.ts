import { evaluateAsrsConfiguration } from "../asrs-estimator.server";
import { requestAsrsJson } from "../asrs-rest.server";

jest.mock("server-only", () => ({}));
jest.mock("../asrs-rest.server", () => ({ requestAsrsJson: jest.fn() }));

const requestAsrsJsonMock = requestAsrsJson as jest.MockedFunction<
  typeof requestAsrsJson
>;
const REVISION_ID = "11111111-1111-4111-8111-111111111111";

describe("ASRS estimator server adapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns reviewed results and keeps unsupported capabilities pending", async () => {
    requestAsrsJsonMock
      .mockResolvedValueOnce([{ id: REVISION_ID }])
      .mockResolvedValueOnce({
        status: "evaluated",
        revision_id: REVISION_ID,
        coverage: "batch1_only",
        document_code: "FMDS0834",
        revision_label: "2026-04",
        revision_status: "staging",
        hose_demand: {
          status: "applied",
          rule_key: "batch1.hose_demand",
          design_sprinkler_count: 12,
          hose_demand_gpm: 250,
          hose_demand_lpm: 950,
          water_supply_duration_min: 60,
          citations: [
            {
              citation_label: "Table 2.1.4.5.4",
              page_number: 17,
              source_type: "table",
              source_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              identifier: "2.1.4.5.4",
              review_event_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            },
          ],
        },
        minimum_width: {
          status: "escalated",
          rule_key: "batch1.tfs.noncompliance_escalation",
          nominal_horizontal_distance_ft: 11,
          citations: [
            {
              citation_label: "Figure 2.2.1.4.1.3(a)",
              page_number: 24,
              source_type: "figure",
              source_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              identifier: "2.2.1.4.1.3(a)",
              review_event_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            },
          ],
        },
      });

    const result = await evaluateAsrsConfiguration({
      ceilingSprinklerType: "standard_coverage",
      designSprinklerCount: 12,
      transverseFlue: { nominalHorizontalDistanceFt: 11 },
    });

    expect(result.corpus).toEqual({
      coverage: "batch1_only",
      documentCode: "FMDS0834",
      revisionId: REVISION_ID,
      revisionLabel: "2026-04",
      revisionStatus: "staging",
    });
    expect(result.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "hose-demand",
          status: "verified",
          value:
            "12 design sprinklers require 250 gpm (950 L/min) for 60 minutes.",
        }),
        expect.objectContaining({
          id: "minimum-width-escalation",
          status: "verified",
          value:
            "In-rack sprinklers are required. See Section 2.2.1.5 to determine if vertical barriers are required.",
        }),
        expect.objectContaining({
          id: "sprinkler-head-count",
          status: "pending_review",
        }),
      ]),
    );
    expect(result.requirements.find((item) => item.id === "hose-demand"))
      .toMatchObject({
        status: "verified",
        citations: [
          {
            sourceType: "table",
            sourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            sourceIdentifier: "2.1.4.5.4",
            ruleKey: "batch1.hose_demand",
            reviewEventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            href: "/asrs/tables/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          },
        ],
      });
    expect(requestAsrsJsonMock).toHaveBeenLastCalledWith(
      "rpc/evaluate_fmds_batch1_rules_scoped",
      "ASRS estimator",
      expect.objectContaining({
        method: "POST",
        body: {
          requested_revision_id: REVISION_ID,
          requested_inputs: {
            hose_demand: {
              ceiling_sprinkler_type: "standard_coverage",
              design_sprinkler_count: 12,
            },
            transverse_flue: { nominal_horizontal_distance_ft: 11 },
          },
        },
      }),
    );
    expect(requestAsrsJsonMock).toHaveBeenNthCalledWith(
      1,
      "fmds_corpus_revisions?select=id&document_code=eq.FMDS0834&status=in.(staging,active)&order=publication_date.desc,created_at.desc&limit=1",
      "ASRS estimator",
    );
  });

  it("fails closed when the revision selected for the turn is no longer eligible", async () => {
    requestAsrsJsonMock.mockResolvedValueOnce([]);

    await expect(
      evaluateAsrsConfiguration(
        { ceilingSprinklerType: "standard_coverage", designSprinklerCount: 12 },
        { revisionId: REVISION_ID },
      ),
    ).rejects.toThrow("no eligible FMDS0834 corpus revision was found");

    expect(requestAsrsJsonMock).toHaveBeenCalledWith(
      `fmds_corpus_revisions?select=id&id=eq.${REVISION_ID}&document_code=eq.FMDS0834&status=in.(staging,active)&limit=1`,
      "ASRS estimator",
    );
    expect(requestAsrsJsonMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the evaluator reports a different revision", async () => {
    const differentRevisionId = "22222222-2222-4222-8222-222222222222";
    requestAsrsJsonMock
      .mockResolvedValueOnce([{ id: REVISION_ID }])
      .mockResolvedValueOnce({ revision_id: differentRevisionId });

    await expect(
      evaluateAsrsConfiguration(
        { ceilingSprinklerType: "standard_coverage", designSprinklerCount: 12 },
        { revisionId: REVISION_ID },
      ),
    ).rejects.toThrow("evaluator returned a different corpus revision");
  });

  it("downgrades an applied requirement when reviewed source provenance is missing", async () => {
    requestAsrsJsonMock
      .mockResolvedValueOnce([{ id: REVISION_ID }])
      .mockResolvedValueOnce({
        status: "evaluated",
        revision_id: REVISION_ID,
        coverage: "batch1_only",
        document_code: "FMDS0834",
        revision_label: "2026-04",
        revision_status: "staging",
        hose_demand: {
          status: "applied",
          rule_key: "batch1.hose_demand",
          design_sprinkler_count: 12,
          hose_demand_gpm: 250,
          hose_demand_lpm: 950,
          water_supply_duration_min: 60,
          citations: [{ citation_label: "Table 2.1.4.5.4", page_number: 17 }],
        },
      });

    const result = await evaluateAsrsConfiguration({
      ceilingSprinklerType: "standard_coverage",
      designSprinklerCount: 12,
    });

    expect(result.requirements.find((item) => item.id === "hose-demand"))
      .toMatchObject({
        status: "pending_review",
        value: expect.stringContaining("reviewed source provenance"),
        citations: [],
      });
  });

  it("downgrades an applied requirement when its reviewed citation lacks a source page", async () => {
    requestAsrsJsonMock
      .mockResolvedValueOnce([{ id: REVISION_ID }])
      .mockResolvedValueOnce({
        status: "evaluated",
        revision_id: REVISION_ID,
        coverage: "batch1_only",
        document_code: "FMDS0834",
        revision_label: "2026-04",
        revision_status: "staging",
        hose_demand: {
          status: "applied",
          rule_key: "batch1.hose_demand",
          design_sprinkler_count: 12,
          hose_demand_gpm: 250,
          hose_demand_lpm: 950,
          water_supply_duration_min: 60,
          citations: [
            {
              citation_label: "Table 2.1.4.5.4",
              source_type: "table",
              source_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              identifier: "2.1.4.5.4",
              review_event_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            },
          ],
        },
      });

    const result = await evaluateAsrsConfiguration({
      ceilingSprinklerType: "standard_coverage",
      designSprinklerCount: 12,
    });

    expect(result.requirements.find((item) => item.id === "hose-demand"))
      .toMatchObject({
        status: "pending_review",
        value: expect.stringContaining("reviewed source provenance"),
        citations: [],
      });
  });
});
