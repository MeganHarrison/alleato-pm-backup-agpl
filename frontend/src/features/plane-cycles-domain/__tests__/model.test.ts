import { getPlaneCycleStatus } from "../model";
import { resolveCycleTaskProject } from "../task-project";

describe("Plane cycles domain model", () => {
  const today = new Date("2026-07-31T12:00:00.000Z");

  it.each([
    ["draft", null, null, null],
    ["upcoming", "2026-08-01", "2026-08-15", null],
    ["current", "2026-07-20", "2026-08-02", null],
    ["completed", "2026-07-01", "2026-07-15", null],
    ["archived", "2026-07-20", "2026-08-02", "2026-07-30T00:00:00Z"],
  ] as const)(
    "classifies a %s cycle",
    (status, start_date, end_date, archived_at) => {
      expect(
        getPlaneCycleStatus({ start_date, end_date, archived_at }, today),
      ).toBe(status);
    },
  );

  it("uses direct task project ownership before legacy values", () => {
    expect(
      resolveCycleTaskProject({
        project_id: 31,
        project_ids: [99],
        document_metadata: { project_id: 88 },
      }),
    ).toEqual({ status: "resolved", projectId: 31 });
  });

  it("accepts bigint project IDs that remain safe JavaScript integers", () => {
    expect(
      resolveCycleTaskProject({
        project_id: 3_000_000_000,
        project_ids: null,
        document_metadata: null,
      }),
    ).toEqual({ status: "resolved", projectId: 3_000_000_000 });
  });

  it("supports the single legacy and metadata fallbacks", () => {
    expect(
      resolveCycleTaskProject({
        project_id: null,
        project_ids: [31],
        document_metadata: { project_id: 31 },
      }),
    ).toEqual({ status: "resolved", projectId: 31 });
    expect(
      resolveCycleTaskProject({
        project_id: null,
        project_ids: [],
        document_metadata: { project_id: 31 },
      }),
    ).toEqual({ status: "resolved", projectId: 31 });
  });

  it("rejects ambiguous task ownership", () => {
    expect(
      resolveCycleTaskProject({
        project_id: null,
        project_ids: [31],
        document_metadata: { project_id: 32 },
      }),
    ).toEqual(
      expect.objectContaining({
        status: "invalid",
      }),
    );
  });
});
