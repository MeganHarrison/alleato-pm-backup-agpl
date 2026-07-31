jest.mock("react", () => ({
  cache: (fn: unknown) => fn,
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

describe("current-user access helpers", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("loads developer access from user_profiles when auth metadata is missing", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const createClientMock = createClient as jest.Mock;
    const from = jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(async () => ({
        data: { is_admin: true, is_developer: true },
        error: null,
      })),
    }));

    createClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: {
            user: {
              id: "1854b4b0-3e8e-4d69-86df-32cdb3c80ee0",
              app_metadata: {},
            },
          },
        })),
      },
      from,
    });

    const { getIsAdmin, getIsDeveloper } = await import("@/lib/auth/current-user");

    await expect(getIsDeveloper()).resolves.toBe(true);
    await expect(getIsAdmin()).resolves.toBe(true);
    expect(from).toHaveBeenCalledWith("user_profiles");
  });
});
