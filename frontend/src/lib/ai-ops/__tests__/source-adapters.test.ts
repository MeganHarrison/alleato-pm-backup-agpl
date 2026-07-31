import type { SourceHealthSnapshot } from "../contracts";
import {
  sourceAdapterRunResultsFromHealth,
  sourceAdapterRunStepsFromHealth,
} from "../source-adapters";

const CHECKED_AT = "2026-06-19T12:00:00.000Z";

function health(
  overrides: Partial<SourceHealthSnapshot>,
): SourceHealthSnapshot {
  return {
    sourceFamily: "meeting",
    resourceId: "meeting-source",
    resourceName: "Meeting source",
    status: "loaded",
    checkedAt: CHECKED_AT,
    loadedCount: 1,
    missingCount: 0,
    metadata: {},
    ...overrides,
  };
}

describe("Executive Daily Brief source adapters", () => {
  it("maps source health to all workflow source adapters", () => {
    const results = sourceAdapterRunResultsFromHealth([
      health({
        sourceFamily: "meeting",
        resourceId: "meeting-source",
        loadedCount: 15,
      }),
      health({
        sourceFamily: "email",
        resourceId: "email-source",
        resourceName: "Outlook email",
        status: "missing",
        loadedCount: 0,
        missingCount: 1,
        warning: "No recent email rows were found.",
      }),
      health({
        sourceFamily: "teams",
        resourceId: "teams-source",
        resourceName: "Teams messages",
        loadedCount: 3,
      }),
      health({
        sourceFamily: "document",
        resourceId: "documents-source",
        resourceName: "Documents/RAG",
        loadedCount: 63,
      }),
    ]);

    expect(results.map((result) => result.adapter.adapterId)).toEqual(
      expect.arrayContaining([
        "fireflies_meetings",
        "outlook_email",
        "teams_messages",
        "documents_rag",
        "acumatica_financials",
        "procore_project_data",
        "project_intelligence_packets",
      ]),
    );
    expect(
      results.find((result) => result.adapter.adapterId === "outlook_email"),
    ).toMatchObject({
      status: "missing",
      failureCode: "SOURCE_ADAPTER_MISSING",
      missingCount: 1,
    });
    expect(
      results.find(
        (result) => result.adapter.adapterId === "procore_project_data",
      ),
    ).toMatchObject({
      status: "skipped",
      failureCode: null,
    });
  });

  it("creates source-fetch run steps that fail loudly for required missing adapters", () => {
    const steps = sourceAdapterRunStepsFromHealth({
      runId: "33333333-3333-4333-8333-333333333333",
      at: CHECKED_AT,
      health: [
        health({ sourceFamily: "meeting", loadedCount: 15 }),
        health({
          sourceFamily: "email",
          resourceId: "email-source",
          resourceName: "Outlook email",
          status: "missing",
          loadedCount: 0,
          missingCount: 1,
        }),
      ],
    });

    expect(
      steps.find(
        (step) => step.metadata.adapterId === "fireflies_meetings",
      ),
    ).toMatchObject({
      stepType: "source_fetch",
      status: "succeeded",
      failureCode: null,
    });
    expect(
      steps.find((step) => step.metadata.adapterId === "outlook_email"),
    ).toMatchObject({
      stepType: "source_fetch",
      status: "failed_retryable",
      failureCode: "SOURCE_ADAPTER_MISSING",
      failureMessage: "Source adapter returned no usable source coverage.",
    });
    expect(
      steps.find(
        (step) => step.metadata.adapterId === "procore_project_data",
      ),
    ).toMatchObject({
      stepType: "source_fetch",
      status: "skipped",
      failureCode: null,
    });
  });
});
