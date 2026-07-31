import { buildRecentLogins, type AuthUserLike, type ProfileLike } from "../recent-logins";

const profiles: ProfileLike[] = [
  { id: "u1", email: "admin@alleatogroup.com", full_name: "Ada Admin", is_admin: true },
  { id: "u2", email: "pm@alleatogroup.com", full_name: "Pat Manager", is_admin: false },
];

describe("buildRecentLogins", () => {
  it("derives logins from auth.users.last_sign_in_at, newest first", () => {
    const authUsers: AuthUserLike[] = [
      { id: "u2", email: "pm@alleatogroup.com", last_sign_in_at: "2026-06-25T10:00:00Z" },
      { id: "u1", email: "admin@alleatogroup.com", last_sign_in_at: "2026-06-27T18:17:00Z" },
    ];

    const result = buildRecentLogins(authUsers, profiles);

    // Would have caught the original bug: reading the never-written
    // users_auth.last_login_at column yielded an empty feed.
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      authUserId: "u1",
      lastLoginAt: "2026-06-27T18:17:00Z",
      email: "admin@alleatogroup.com",
      fullName: "Ada Admin",
      isAdmin: true,
    });
    expect(result[1].authUserId).toBe("u2");
  });

  it("excludes users who have never signed in", () => {
    const authUsers: AuthUserLike[] = [
      { id: "u1", email: "admin@alleatogroup.com", last_sign_in_at: "2026-06-27T18:17:00Z" },
      { id: "u2", email: "pm@alleatogroup.com", last_sign_in_at: null },
    ];

    const result = buildRecentLogins(authUsers, profiles);

    expect(result).toHaveLength(1);
    expect(result[0].authUserId).toBe("u1");
  });

  it("falls back to the auth email when no profile matches", () => {
    const authUsers: AuthUserLike[] = [
      { id: "orphan", email: "orphan@mail.com", last_sign_in_at: "2026-06-27T00:00:00Z" },
    ];

    const result = buildRecentLogins(authUsers, profiles);

    expect(result[0]).toMatchObject({
      authUserId: "orphan",
      email: "orphan@mail.com",
      fullName: null,
      isAdmin: false,
    });
  });

  it("caps the feed at the requested limit", () => {
    const authUsers: AuthUserLike[] = Array.from({ length: 30 }, (_, i) => ({
      id: `user-${i}`,
      email: `user${i}@mail.com`,
      last_sign_in_at: new Date(2026, 0, i + 1).toISOString(),
    }));

    expect(buildRecentLogins(authUsers, [], 15)).toHaveLength(15);
  });
});
