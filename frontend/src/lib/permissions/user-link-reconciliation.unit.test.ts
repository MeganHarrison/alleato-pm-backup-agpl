import { findPermissionUserLinkDiagnostics } from "./user-link-reconciliation";

type Row = Record<string, unknown>;

/**
 * Minimal mock of the Supabase service client that honours `.range(from, to)`
 * pagination per table. This is the behaviour that broke link reconciliation:
 * Supabase caps every select at 1000 rows, so an un-paginated read silently
 * dropped every `people` row past the first page and produced false
 * `missing_person_auth_link` diagnostics.
 */
function makeServiceClient(tables: Record<string, Row[]>) {
  const buildBuilder = (rows: Row[]) => {
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        const filtered = rows.filter((row) => row[column] === value);
        return buildBuilder(filtered);
      },
      range: (from: number, to: number) =>
        Promise.resolve({ data: rows.slice(from, to + 1), error: null }),
    };
    return builder;
  };

  return {
    from: (table: string) => buildBuilder(tables[table] ?? []),
  } as unknown as Parameters<typeof findPermissionUserLinkDiagnostics>[0];
}

describe("findPermissionUserLinkDiagnostics", () => {
  it("does not flag a correctly-linked user whose person row falls past the first 1000-row page", async () => {
    // 1100 filler people so the real user's linked row lives on the second page.
    const filler: Row[] = Array.from({ length: 1100 }, (_, index) => ({
      id: `filler-person-${index}`,
      first_name: "Filler",
      last_name: `${index}`,
      email: `filler${index}@example.com`,
      auth_user_id: null,
    }));

    const authUserId = "auth-zaryll";
    const personId = "person-zaryll";

    const tables: Record<string, Row[]> = {
      user_profiles: [
        {
          id: authUserId,
          email: "zaryll@example.com",
          full_name: "Zaryll",
          is_admin: true,
          is_active: true,
          role: null,
        },
      ],
      people: [
        ...filler,
        {
          id: personId,
          first_name: "Zaryll",
          last_name: "",
          email: "zaryll@example.com",
          auth_user_id: authUserId,
        },
      ],
      users_auth: [{ person_id: personId, auth_user_id: authUserId }],
    };

    const diagnostics = await findPermissionUserLinkDiagnostics(makeServiceClient(tables));

    expect(diagnostics).toEqual([]);
  });

  it("still flags a genuinely missing person auth link", async () => {
    const tables: Record<string, Row[]> = {
      user_profiles: [
        {
          id: "auth-broken",
          email: "broken@example.com",
          full_name: "Broken",
          is_admin: false,
          is_active: true,
          role: null,
        },
      ],
      people: [],
      users_auth: [],
    };

    const diagnostics = await findPermissionUserLinkDiagnostics(makeServiceClient(tables));

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.issues).toEqual(
      expect.arrayContaining(["missing_person_auth_link", "missing_users_auth_link"]),
    );
  });
});
