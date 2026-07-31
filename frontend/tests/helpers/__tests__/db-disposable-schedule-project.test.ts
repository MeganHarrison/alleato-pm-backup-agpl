import {
  assertDisposableScheduleProjectName,
  deleteDisposableScheduleProject,
  deleteDisposableScheduleTasksByProject,
  DISPOSABLE_SCHEDULE_PROJECT_PREFIX,
} from "../db";

const mockDelete = jest.fn();
const mockMaybeSingle = jest.fn(async () => ({
  data: {
    id: 67,
    name: `${DISPOSABLE_SCHEDULE_PROJECT_PREFIX}forged`,
    created_via: "automation",
    creation_run_id: "playwright-schedule:different-run",
  },
  error: null,
}));
const mockQuery = {
  select: jest.fn(),
  eq: jest.fn(),
  maybeSingle: mockMaybeSingle,
  delete: mockDelete,
};
mockQuery.select.mockReturnValue(mockQuery);
mockQuery.eq.mockReturnValue(mockQuery);
mockDelete.mockReturnValue(mockQuery);

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => mockQuery),
  })),
}));

describe("disposable scheduling project guard", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.select.mockReturnValue(mockQuery);
    mockQuery.eq.mockReturnValue(mockQuery);
    mockDelete.mockReturnValue(mockQuery);
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 67,
        name: `${DISPOSABLE_SCHEDULE_PROJECT_PREFIX}forged`,
        created_via: "automation",
        creation_run_id: "playwright-schedule:different-run",
      },
      error: null,
    });
  });

  it("accepts only the dedicated scheduling E2E project namespace", () => {
    expect(() =>
      assertDisposableScheduleProjectName(
        `${DISPOSABLE_SCHEDULE_PROJECT_PREFIX}regression 8a8c6bc2`,
      ),
    ).not.toThrow();
  });

  it.each(["Nexcom", "E2E-Regression", "Scheduling test", ""])(
    "rejects shared or ambiguous project name %p before destructive cleanup",
    (name) => {
      expect(() => assertDisposableScheduleProjectName(name)).toThrow(
        `Disposable project names must start with "${DISPOSABLE_SCHEDULE_PROJECT_PREFIX}".`,
      );
    },
  );

  it.each([
    ["project cleanup", deleteDisposableScheduleProject],
    ["task cleanup", deleteDisposableScheduleTasksByProject],
  ])("refuses %s before issuing a delete for a shared project", async (_label, cleanup) => {
    await expect(cleanup({
      id: 67,
      name: `${DISPOSABLE_SCHEDULE_PROJECT_PREFIX}forged`,
      creationRunId: "playwright-schedule:expected-run",
    })).rejects.toThrow(
      "the persisted project does not match its disposable fixture ownership token",
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
