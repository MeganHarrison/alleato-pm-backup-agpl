import {
  getDailyLogWithSections,
  getSiteLeadChecklistForDate,
  saveSiteLeadChecklistForDate,
} from "../daily-log-actions";
import { createClient } from "@/lib/supabase/server";
import { createEmptySiteManagementChecklist } from "@/lib/daily-log/site-management-checklist";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

type QueryResult<T> = {
  data: T;
  error: { message: string } | null;
};

type EqCall = [column: string, value: string | number];

type QueryBuilder<T> = {
  select: jest.Mock<QueryBuilder<T>, [string]>;
  eq: jest.Mock<QueryBuilder<T> | Promise<QueryResult<T>>, EqCall>;
  single: jest.Mock<Promise<QueryResult<T>>, []>;
  maybeSingle: jest.Mock<Promise<QueryResult<T>>, []>;
  eqCalls: EqCall[];
};

function createQueryBuilder<T>(
  result: QueryResult<T>,
  options: { resolveOnEq?: boolean } = {},
): QueryBuilder<T> {
  const builder = {
    eqCalls: [] as EqCall[],
  } as QueryBuilder<T>;

  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn((column: string, value: string | number) => {
    builder.eqCalls.push([column, value]);
    return options.resolveOnEq ? Promise.resolve(result) : builder;
  });
  builder.single = jest.fn(async () => result);
  builder.maybeSingle = jest.fn(async () => result);

  return builder;
}

describe("daily log server actions", () => {
  const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads daily logs by id and active project", async () => {
    const logBuilder = createQueryBuilder({
      data: {
        id: "log-1",
        project_id: 25125,
        log_date: "2026-05-21",
        status: "draft",
        general_notes: null,
      },
      error: null,
    });
    const weatherBuilder = createQueryBuilder({ data: [], error: null }, { resolveOnEq: true });
    const manpowerBuilder = createQueryBuilder({ data: [], error: null }, { resolveOnEq: true });
    const equipmentBuilder = createQueryBuilder({ data: [], error: null }, { resolveOnEq: true });
    const notesBuilder = createQueryBuilder({ data: [], error: null }, { resolveOnEq: true });

    mockCreateClient.mockResolvedValue({
      from: jest.fn((table: string) => {
        const builders: Record<string, QueryBuilder<unknown[] | object>> = {
          daily_logs: logBuilder,
          daily_log_weather: weatherBuilder,
          daily_log_manpower: manpowerBuilder,
          daily_log_equipment: equipmentBuilder,
          daily_log_notes: notesBuilder,
        };

        return builders[table];
      }),
    } as Awaited<ReturnType<typeof createClient>>);

    const result = await getDailyLogWithSections({
      dailyLogId: "log-1",
      projectId: 25125,
    });

    expect(result).toMatchObject({ success: true });
    expect(logBuilder.eqCalls).toEqual([
      ["id", "log-1"],
      ["project_id", 25125],
    ]);
  });

  it("fails fast when a section query fails", async () => {
    const logBuilder = createQueryBuilder({
      data: {
        id: "log-1",
        project_id: 25125,
        log_date: "2026-05-21",
        status: "draft",
        general_notes: null,
      },
      error: null,
    });
    const weatherBuilder = createQueryBuilder(
      { data: null, error: { message: "permission denied for daily_log_weather" } },
      { resolveOnEq: true },
    );
    const manpowerBuilder = createQueryBuilder({ data: [], error: null }, { resolveOnEq: true });
    const equipmentBuilder = createQueryBuilder({ data: [], error: null }, { resolveOnEq: true });
    const notesBuilder = createQueryBuilder({ data: [], error: null }, { resolveOnEq: true });

    mockCreateClient.mockResolvedValue({
      from: jest.fn((table: string) => {
        const builders: Record<string, QueryBuilder<unknown[] | object | null>> = {
          daily_logs: logBuilder,
          daily_log_weather: weatherBuilder,
          daily_log_manpower: manpowerBuilder,
          daily_log_equipment: equipmentBuilder,
          daily_log_notes: notesBuilder,
        };

        return builders[table];
      }),
    } as Awaited<ReturnType<typeof createClient>>);

    await expect(
      getDailyLogWithSections({
        dailyLogId: "log-1",
        projectId: 25125,
      }),
    ).resolves.toEqual({
      error:
        "Daily log sections could not be loaded: weather: permission denied for daily_log_weather",
    });
  });

  it("normalizes checklist data for a specific project date", async () => {
    const logBuilder = createQueryBuilder({
      data: {
        id: "log-9",
        status: "pending",
        site_management_checklist: {
          items: {
            "review-daily-schedule": { value: "yes", note: "" },
            "address-delays": { value: "no", note: "Waiting on revised crane delivery." },
          },
        },
      },
      error: null,
    });

    mockCreateClient.mockResolvedValue({
      from: jest.fn(() => logBuilder),
    } as Awaited<ReturnType<typeof createClient>>);

    const result = await getSiteLeadChecklistForDate({
      projectId: 876,
      logDate: "2026-07-03",
    });

    expect(result).toMatchObject({
      success: true,
      data: {
        dailyLogId: "log-9",
        status: "pending",
      },
    });
    if ("data" in result) {
      expect(result.data.checklist["review-daily-schedule"]).toEqual({ value: "yes", note: "" });
      expect(result.data.checklist["address-delays"]).toEqual({
        value: "no",
        note: "Waiting on revised crane delivery.",
      });
    }
    expect(logBuilder.eqCalls).toEqual([
      ["project_id", 876],
      ["log_date", "2026-07-03"],
    ]);
  });

  it("updates only checklist-owned fields when a linked daily log already exists", async () => {
    const existingBuilder = createQueryBuilder({
      data: { id: "log-existing" },
      error: null,
    });
    const updateBuilder = {
      eqCalls: [] as EqCall[],
      select: jest.fn(),
      eq: jest.fn(),
      single: jest.fn(async () => ({ data: { id: "log-existing" }, error: null })),
      maybeSingle: jest.fn(),
      update: jest.fn(),
    };

    updateBuilder.select.mockReturnValue(updateBuilder);
    updateBuilder.eq.mockImplementation((column: string, value: string | number) => {
      updateBuilder.eqCalls.push([column, value]);
      return updateBuilder;
    });
    updateBuilder.update.mockReturnValue(updateBuilder);

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: "user-1" } },
          error: null,
        })),
      },
      from: jest
        .fn()
        .mockImplementationOnce(() => existingBuilder)
        .mockImplementationOnce(() => updateBuilder),
    } as Awaited<ReturnType<typeof createClient>>);

    const checklist = createEmptySiteManagementChecklist();
    checklist["review-daily-schedule"] = { value: "yes", note: "" };
    checklist["address-delays"] = { value: "no", note: "Late inspection window." };

    const result = await saveSiteLeadChecklistForDate({
      projectId: 876,
      logDate: "2026-07-03",
      siteManagementChecklist: checklist,
    });

    expect(result).toMatchObject({ success: true });
    expect(existingBuilder.eqCalls).toEqual([
      ["project_id", 876],
      ["log_date", "2026-07-03"],
    ]);
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        site_management_checklist: expect.objectContaining({
          version: 1,
          items: expect.objectContaining({
            "review-daily-schedule": { value: "yes", note: "" },
            "address-delays": { value: "no", note: "Late inspection window." },
          }),
        }),
      }),
    );
    expect(updateBuilder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 876,
        log_date: "2026-07-03",
      }),
    );
    expect(updateBuilder.eqCalls).toEqual([
      ["id", "log-existing"],
      ["project_id", 876],
    ]);
  });
});
