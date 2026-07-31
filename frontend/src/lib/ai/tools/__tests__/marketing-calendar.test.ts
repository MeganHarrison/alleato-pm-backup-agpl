import { z } from "zod";

jest.mock("ai", () => ({
  tool: <T>(definition: T) => definition,
}));

jest.mock("@/lib/ai/services/marketing-service", () => ({
  getMarketingCalendar: jest.fn(),
}));

import { getMarketingCalendar } from "@/lib/ai/services/marketing-service";
import { createMarketingTools } from "../marketing";

const mockedGetMarketingCalendar = jest.mocked(getMarketingCalendar);

describe("getMarketingCalendar tool", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses provider-safe nullable defaults and executes without invented filters", async () => {
    mockedGetMarketingCalendar.mockResolvedValue([]);

    const definition = createMarketingTools("user-1", {
      pinnedProjectId: 1009,
    }).getMarketingCalendar as unknown as {
      inputSchema: z.ZodTypeAny;
      execute: (input: {
        dateRange: { start: string | null; end: string | null } | null;
        status: string | null;
        projectId: number | null;
      }) => Promise<unknown>;
    };
    const providerSchema = z.toJSONSchema(definition.inputSchema) as {
      required?: string[];
      properties?: Record<string, { default?: unknown }>;
    };

    expect(providerSchema.required).toEqual([
      "dateRange",
      "status",
      "projectId",
    ]);
    expect(providerSchema.properties?.dateRange?.default).toBeNull();
    expect(providerSchema.properties?.status?.default).toBeNull();
    expect(providerSchema.properties?.projectId?.default).toBeNull();

    const parsedInput = definition.inputSchema.parse({});
    expect(parsedInput).toEqual({
      dateRange: null,
      status: null,
      projectId: null,
    });

    await definition.execute(parsedInput);

    expect(mockedGetMarketingCalendar).toHaveBeenCalledWith({
      dateRange: undefined,
      status: undefined,
      projectId: undefined,
    });
  });
});
