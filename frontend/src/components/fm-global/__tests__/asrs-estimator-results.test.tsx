import { renderToStaticMarkup } from "react-dom/server";

import { AsrsEstimatorResults } from "../asrs-estimator-results";

describe("AsrsEstimatorResults", () => {
  it("renders persisted verified and Pending Review evidence without merging them", () => {
    const markup = renderToStaticMarkup(
      <AsrsEstimatorResults
        result={{
          corpus: {
            coverage: "batch1_only",
            documentCode: "FMDS0834",
            revisionId: "11111111-1111-4111-8111-111111111111",
            revisionLabel: "2026-04",
            revisionStatus: "staging",
          },
          requirements: [
            {
              id: "hose-demand",
              label: "Hose demand and water supply",
              status: "verified",
              value: "250 gpm for 60 minutes.",
              citations: [
                {
                  label: "Table 2.1.4.5.4",
                  pageNumber: 17,
                  sourceType: "table",
                  sourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                  sourceIdentifier: "2.1.4.5.4",
                  ruleKey: "batch1.hose_demand",
                  reviewEventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                  href: "/asrs/tables/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                },
              ],
            },
            {
              id: "full-compliance",
              label: "Full FMDS 8-34 compliance determination",
              status: "pending_review",
              value: "Pending review.",
              citations: [],
            },
          ],
        }}
      />,
    );

    expect(markup).toContain("FMDS0834 2026-04");
    expect(markup).toContain("Verified");
    expect(markup).toContain("Pending Review");
    expect(markup).toContain("Table 2.1.4.5.4, page 17");
    expect(markup).toContain(
      'href="/asrs/tables/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"',
    );
    expect(markup).toContain("batch1.hose_demand");
  });
});
