import { getBestSupabaseAuthToken } from "@/lib/supabase/auth-cookie";

function createSessionCookie(payload: Record<string, unknown>) {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const accessToken = `${encode({ alg: "none" })}.${encode(payload)}.signature`;
  const session = Buffer.from(JSON.stringify({ access_token: accessToken })).toString(
    "base64url",
  );

  return { name: "sb-test-auth-token", value: `base64-${session}` };
}

describe("getBestSupabaseAuthToken", () => {
  it("accepts the signed app-admin claim but never user metadata", () => {
    const appAdmin = getBestSupabaseAuthToken([
      createSessionCookie({
        sub: "app-admin",
        email: "admin@example.com",
        exp: 2_000_000_000,
        app_metadata: { is_admin: true },
        user_metadata: { is_admin: false },
      }),
    ]);
    const userMetadataOnly = getBestSupabaseAuthToken([
      createSessionCookie({
        sub: "not-admin",
        email: "user@example.com",
        exp: 2_000_000_000,
        user_metadata: { is_admin: true },
      }),
    ]);

    expect(appAdmin?.isAdmin).toBe(true);
    expect(userMetadataOnly?.isAdmin).toBe(false);
  });
});
