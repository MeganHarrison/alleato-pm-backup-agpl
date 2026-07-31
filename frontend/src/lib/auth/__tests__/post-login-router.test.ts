import {
  getPostLoginRedirect,
  type PostLoginSupabaseClient,
} from "@/lib/auth/post-login-router";

type TableResults = {
  user_profiles?: { is_admin?: boolean } | null;
  users_auth?: { person_id: string } | null;
  project_directory_memberships?: Array<{
    project_id: number;
    user_type: string | null;
  }>;
};

/**
 * Builds a Supabase client mock whose `.from(table)` returns a query builder
 * that is both chainable (.select().eq().eq()) and awaitable. `.maybeSingle()`
 * and a direct `await` both resolve to the configured `{ data }`.
 */
function mockSupabase(results: TableResults): PostLoginSupabaseClient {
  const from = (table: keyof TableResults) => {
    const data =
      table === "project_directory_memberships"
        ? (results.project_directory_memberships ?? [])
        : (results[table] ?? null);
    const payload = { data, error: null };
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => payload,
      then: (resolve: (value: typeof payload) => unknown) => resolve(payload),
    };
    return builder;
  };
  return { from: from as PostLoginSupabaseClient["from"] };
}

const USER_ID = "auth-user-1";
const PERSON_ID = "person-1";

describe("getPostLoginRedirect", () => {
  it("sends a single-project subcontractor to /my-work (not /home)", async () => {
    const supabase = mockSupabase({
      user_profiles: { is_admin: false },
      users_auth: { person_id: PERSON_ID },
      project_directory_memberships: [
        { project_id: 1102, user_type: "subcontractor" },
      ],
    });
    expect(await getPostLoginRedirect(supabase, USER_ID)).toBe("/1102/my-work");
  });

  it("drops a callbackUrl pointing at a project the user is NOT a member of", async () => {
    const supabase = mockSupabase({
      user_profiles: { is_admin: false },
      users_auth: { person_id: PERSON_ID },
      project_directory_memberships: [
        { project_id: 1102, user_type: "subcontractor" },
      ],
    });
    // Was trying to reach project 1009 (no membership) → fall back to their project.
    expect(await getPostLoginRedirect(supabase, USER_ID, "/1009/home")).toBe(
      "/1102/my-work",
    );
  });

  it("honors a callbackUrl pointing at a project the user CAN access", async () => {
    const supabase = mockSupabase({
      user_profiles: { is_admin: false },
      users_auth: { person_id: PERSON_ID },
      project_directory_memberships: [
        { project_id: 1102, user_type: "subcontractor" },
      ],
    });
    expect(
      await getPostLoginRedirect(supabase, USER_ID, "/1102/submittals"),
    ).toBe("/1102/submittals");
  });

  it("honors a company-wide (non-project) callbackUrl", async () => {
    const supabase = mockSupabase({
      user_profiles: { is_admin: false },
      users_auth: { person_id: PERSON_ID },
      project_directory_memberships: [
        { project_id: 1102, user_type: "subcontractor" },
      ],
    });
    expect(await getPostLoginRedirect(supabase, USER_ID, "/ai")).toBe("/ai");
  });

  it("does not honor /home as a post-login callback while the page is held back", async () => {
    const supabase = mockSupabase({
      user_profiles: { is_admin: false },
      users_auth: { person_id: PERSON_ID },
      project_directory_memberships: [
        { project_id: 1, user_type: "employee" },
        { project_id: 2, user_type: "employee" },
      ],
    });
    expect(await getPostLoginRedirect(supabase, USER_ID, "/home")).toBe("/");
  });

  it("lets an admin reach any project via callbackUrl even without membership", async () => {
    const supabase = mockSupabase({
      user_profiles: { is_admin: true },
      users_auth: null,
      project_directory_memberships: [],
    });
    expect(await getPostLoginRedirect(supabase, USER_ID, "/9999/home")).toBe(
      "/9999/home",
    );
  });

  it("routes a single-project client to /client-dashboard", async () => {
    const supabase = mockSupabase({
      user_profiles: { is_admin: false },
      users_auth: { person_id: PERSON_ID },
      project_directory_memberships: [{ project_id: 50, user_type: "client" }],
    });
    expect(await getPostLoginRedirect(supabase, USER_ID)).toBe(
      "/50/client-dashboard",
    );
  });

  it("routes a single-project employee to the stable portfolio landing", async () => {
    const supabase = mockSupabase({
      user_profiles: { is_admin: false },
      users_auth: { person_id: PERSON_ID },
      project_directory_memberships: [{ project_id: 7, user_type: "employee" }],
    });
    expect(await getPostLoginRedirect(supabase, USER_ID)).toBe("/");
  });

  it("sends multi-project users to the stable portfolio landing when no callbackUrl is given", async () => {
    const supabase = mockSupabase({
      user_profiles: { is_admin: false },
      users_auth: { person_id: PERSON_ID },
      project_directory_memberships: [
        { project_id: 1, user_type: "employee" },
        { project_id: 2, user_type: "employee" },
      ],
    });
    expect(await getPostLoginRedirect(supabase, USER_ID)).toBe("/");
  });

  it("sends admins with no callbackUrl to the stable portfolio landing", async () => {
    const supabase = mockSupabase({
      user_profiles: { is_admin: true },
      users_auth: null,
      project_directory_memberships: [],
    });
    expect(await getPostLoginRedirect(supabase, USER_ID)).toBe("/");
  });

  it("sends users with no memberships to the stable portfolio landing", async () => {
    const supabase = mockSupabase({
      user_profiles: { is_admin: false },
      users_auth: null,
      project_directory_memberships: [],
    });
    expect(await getPostLoginRedirect(supabase, USER_ID)).toBe("/");
  });
});
