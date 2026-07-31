import { getCurrentBrowserUser, resetCurrentBrowserUserCache } from "../current-user";

function createSupabaseMock(user: unknown, delayMs = 0) {
  const getUser = jest.fn(
    () =>
      new Promise((resolve) => {
        setTimeout(() => resolve({ data: { user }, error: null }), delayMs);
      }),
  );

  return {
    auth: { getUser },
  } as never;
}

describe("getCurrentBrowserUser", () => {
  beforeEach(() => {
    resetCurrentBrowserUserCache();
    jest.useRealTimers();
  });

  it("coalesces concurrent browser auth lookups", async () => {
    const user = { id: "user-1", email: "user@example.com" };
    const supabase = createSupabaseMock(user, 5);

    const [first, second] = await Promise.all([
      getCurrentBrowserUser(supabase),
      getCurrentBrowserUser(supabase),
    ]);

    expect(first).toBe(user);
    expect(second).toBe(user);
    expect(supabase.auth.getUser).toHaveBeenCalledTimes(1);
  });

  it("can be reset after auth state changes", async () => {
    const firstUser = { id: "user-1" };
    const secondUser = { id: "user-2" };
    const supabase = {
      auth: {
        getUser: jest
          .fn()
          .mockResolvedValueOnce({ data: { user: firstUser }, error: null })
          .mockResolvedValueOnce({ data: { user: secondUser }, error: null }),
      },
    } as never;

    await expect(getCurrentBrowserUser(supabase)).resolves.toBe(firstUser);
    resetCurrentBrowserUserCache();
    await expect(getCurrentBrowserUser(supabase)).resolves.toBe(secondUser);
    expect(supabase.auth.getUser).toHaveBeenCalledTimes(2);
  });
});
