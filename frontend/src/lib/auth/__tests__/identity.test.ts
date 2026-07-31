/**
 * Identity resolution tests — pin every branch of the auth uid → people.id walk
 * through the module's interface with an injected fake service client (no live
 * DB). These are the failure modes that made the private auth-guard copy risky
 * to reuse: which fallback fires, and the write side effects (users_auth backfill
 * + people auto-provision).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { resolvePersonId, resolveIdentity } from "@/lib/auth/identity";

interface FakeState {
  users_auth: Array<{ auth_user_id: string; person_id: string }>;
  people: Array<{ id: string; auth_user_id: string | null; email: string | null }>;
  upserts: Array<{ table: string; row: Record<string, unknown> }>;
  inserts: Array<{ table: string; row: Record<string, unknown> }>;
  nextPersonId: string;
}

function makeState(over: Partial<FakeState> = {}): FakeState {
  return {
    users_auth: [],
    people: [],
    upserts: [],
    inserts: [],
    nextPersonId: "person-new",
    ...over,
  };
}

function makeFakeClient(state: FakeState): SupabaseClient<Database> {
  const client = {
    from(table: string) {
      const q: {
        eq: Record<string, unknown>;
        ilike: [string, string] | null;
        insertRow: Record<string, unknown> | null;
      } = { eq: {}, ilike: null, insertRow: null };

      const matches = (row: Record<string, unknown>): boolean => {
        for (const [col, val] of Object.entries(q.eq)) {
          if (String(row[col]) !== String(val)) return false;
        }
        if (q.ilike) {
          const [col, val] = q.ilike;
          if (String(row[col] ?? "").toLowerCase() !== val.toLowerCase()) return false;
        }
        return true;
      };

      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (col: string, val: unknown) => {
          q.eq[col] = val;
          return chain;
        },
        ilike: (col: string, val: string) => {
          q.ilike = [col, val];
          return chain;
        },
        insert: (row: Record<string, unknown>) => {
          q.insertRow = row;
          return chain;
        },
        upsert: (row: Record<string, unknown>) => {
          state.upserts.push({ table, row });
          return Promise.resolve({ data: null, error: null });
        },
        maybeSingle: () => {
          const rows = (state as unknown as Record<string, Record<string, unknown>[]>)[table] ?? [];
          const found = rows.find(matches) ?? null;
          return Promise.resolve({ data: found, error: null });
        },
        single: () => {
          // Only used after insert (people).
          const created = { id: state.nextPersonId, ...(q.insertRow ?? {}) };
          state.inserts.push({ table, row: q.insertRow ?? {} });
          (state as unknown as Record<string, Record<string, unknown>[]>)[table].push(
            created as Record<string, unknown>,
          );
          return Promise.resolve({ data: created, error: null });
        },
      };
      return chain;
    },
  };
  return client as unknown as SupabaseClient<Database>;
}

const USER = { id: "auth-123", email: "jane.doe@example.com" };

describe("resolvePersonId — the auth uid → people.id walk", () => {
  it("returns the linked person_id from users_auth (no writes)", async () => {
    const state = makeState({
      users_auth: [{ auth_user_id: "auth-123", person_id: "person-A" }],
    });
    const client = makeFakeClient(state);

    const personId = await resolvePersonId(USER, client);

    expect(personId).toBe("person-A");
    expect(state.inserts).toHaveLength(0);
    expect(state.upserts).toHaveLength(0);
  });

  it("falls back to people.auth_user_id when users_auth has no link", async () => {
    const state = makeState({
      people: [{ id: "person-B", auth_user_id: "auth-123", email: null }],
    });
    const client = makeFakeClient(state);

    const personId = await resolvePersonId(USER, client);

    expect(personId).toBe("person-B");
    expect(state.inserts).toHaveLength(0);
  });

  it("falls back to email match and backfills the users_auth link", async () => {
    const state = makeState({
      people: [{ id: "person-C", auth_user_id: null, email: "JANE.DOE@example.com" }],
    });
    const client = makeFakeClient(state);

    const personId = await resolvePersonId(USER, client);

    expect(personId).toBe("person-C");
    expect(state.upserts).toEqual([
      { table: "users_auth", row: { auth_user_id: "auth-123", person_id: "person-C" } },
    ]);
    expect(state.inserts).toHaveLength(0);
  });

  it("returns null when nothing matches and there is no email", async () => {
    const state = makeState();
    const client = makeFakeClient(state);

    const personId = await resolvePersonId({ id: "auth-123", email: null }, client);

    expect(personId).toBeNull();
    expect(state.inserts).toHaveLength(0);
  });

  it("auto-provisions a people row (name derived from email) and links it", async () => {
    const state = makeState({ nextPersonId: "person-provisioned" });
    const client = makeFakeClient(state);

    const personId = await resolvePersonId(USER, client);

    expect(personId).toBe("person-provisioned");
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0]).toMatchObject({
      table: "people",
      row: {
        first_name: "Jane",
        last_name: "Doe",
        email: "jane.doe@example.com",
        person_type: "employee",
        auth_user_id: "auth-123",
      },
    });
    expect(state.upserts).toEqual([
      {
        table: "users_auth",
        row: { auth_user_id: "auth-123", person_id: "person-provisioned" },
      },
    ]);
  });
});

describe("resolveIdentity — all id shapes at once", () => {
  it("returns authUserId, profileId (== authUserId), and personId", async () => {
    const state = makeState({
      users_auth: [{ auth_user_id: "auth-123", person_id: "person-A" }],
    });
    const client = makeFakeClient(state);

    const identity = await resolveIdentity(USER, client);

    expect(identity).toEqual({
      authUserId: "auth-123",
      profileId: "auth-123",
      personId: "person-A",
    });
  });
});
